import {ChunkSplitor} from '../chunk/chunkSplitor';
import {Chunk} from '../chunk/type';
import {EventEmitter} from '../event/eventEmitter';
import {Task} from '../task/task';
import {TaskQueue} from '../task/taskQueue';
import {RequestStrategy} from './requestStrategy';
import {UploadControllerEvent, EventNames} from '../event/eventNames';

type UploadCallbacks = {
  onProgress?: (percent: number) => void;
  onEnd?: (url: string) => void;
  onError?: (error: any) => void;
};

/**
 * 分片上传控制器
 * 负责分片上传的整体流程控制，包括并发、事件、请求解耦等
 */
export class UploadController extends EventEmitter<UploadControllerEvent> {
  private requestStrategy: RequestStrategy; // 请求策略
  private splitStrategy: ChunkSplitor; // 分片策略
  private taskQueue: TaskQueue; // 任务队列
  private file: File; // 待上传文件
  private token: string = ''; // 文件上传唯一标识
  private totalChunks: number = 0; // 总分片数
  private finishedChunks: number = 0; // 已完成分片数
  private callbacks: UploadCallbacks = {}; // 上传回调
  private isPaused = false; // 是否已暂停上传

  constructor(options: {
    file: File;
    requestStrategy: RequestStrategy;
    splitStrategy: ChunkSplitor;
    concurrency?: number;
    callbacks?: UploadCallbacks;
  }) {
    super();
    this.file = options.file;
    this.requestStrategy = options.requestStrategy;
    this.splitStrategy = options.splitStrategy;
    this.taskQueue = new TaskQueue(options.concurrency || 4);
    this.totalChunks = options.splitStrategy.getChunks().length;
    this.callbacks = options.callbacks || {};
  }

  // 初始化上传流程
  async init() {
    try {
      // 获取文件token
      this.token = await this.requestStrategy.createFile(this.file);

      // 分片事件监听
      this.splitStrategy.on(EventNames.CHUNK_HASHED, this.handleChunks.bind(this));
      this.splitStrategy.on(EventNames.WHOLE_HASH, this.handleWholeHash.bind(this));

      // 启动分片
      this.splitStrategy.split();
    } catch (error) {
      this.emitError(error);
    }
  }

  // 暂停上传
  pause() {
    this.isPaused = true;
    this.taskQueue.pause();
  }

  // 继续上传
  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.taskQueue.start();
  }

  // 取消上传
  cancel() {
    this.isPaused = false;
    this.taskQueue.pause();
    this.taskQueue.clear(); // 清空所有任务
    this.splitStrategy.dispose(); // 销毁分片相关资源
    this.finishedChunks = 0;
    this.token = '';
    // 可选：通知前端已取消
    this.emitError(new Error('上传已取消'));
  }

  // 分片事件处理
  private handleChunks(chunks: Chunk[]) {
    chunks.forEach(chunk => {
      this.taskQueue.addAndStart(new Task(this.uploadChunk.bind(this), chunk));
    });
  }

  // 分片上传任务
  async uploadChunk(chunk: Chunk) {
    try {
      // hash校验，避免重复上传
      const resp = await this.requestStrategy.patchHash(this.token, chunk.hash, 'chunk');
      if (resp.hasFile) {
        this.updateProgress();
        return;
      }
      // 分片上传
      await this.requestStrategy.uploadChunk(chunk);
      this.updateProgress();
    } catch (error) {
      this.emitError(error);
    }
  }

  // 更新上传进度
  private updateProgress() {
    this.finishedChunks++;
    const percent = Math.round((this.finishedChunks / this.totalChunks) * 100);
    this.emit(EventNames.UPLOAD_PROGRESS, percent);
    this.callbacks.onProgress?.(percent);
  }
  // 上传完成事件处理
  private emitEnd(url: string) {
    this.emit(EventNames.UPLOAD_END, url);
    this.callbacks.onEnd?.(url);
  }
  // 上传错误事件处理
  private emitError(error: any) {
    this.emit(EventNames.UPLOAD_ERROR, error);
    this.callbacks.onError?.(error);
  }

  // 整体hash事件处理
  private async handleWholeHash(hash: string) {
    // 如果分片还没有全部上传完成，等待任务队列完成
    if (this.finishedChunks < this.totalChunks) {
      this.taskQueue.once(EventNames.TASK_DRAIN, () => {
        this.handleWholeHash(hash);
      });
      return;
    }

    try {
      // hash校验
      const resp = await this.requestStrategy.patchHash(this.token, hash, 'file');
      // file 类型
      if ('url' in resp && resp.hasFile) {
        this.emitEnd(resp.url as string);
        return;
      }
      // chunk 类型
      if ('rest' in resp && Array.isArray(resp.rest) && resp.rest.length > 0) {
        // 需要补传缺失分片
        const missingChunks = resp.rest.map((idx: number) => this.splitStrategy.getChunks()[idx]);
        missingChunks.forEach((chunk: Chunk) => {
          this.taskQueue.addAndStart(new Task(this.uploadChunk.bind(this), chunk));
        });

        // 先解绑之前的 drain 监听
        const drainListener = async () => {
          try {
            const url = await this.requestStrategy.mergeFile(this.token);
            this.emitEnd(url);
          } catch (err) {
            this.emitError(err);
          }
        };
        this.taskQueue.off(EventNames.TASK_DRAIN, drainListener);

        this.taskQueue.once(EventNames.TASK_DRAIN, drainListener);
      } else {
        // 没有缺失分片，直接合并
        const url = await this.requestStrategy.mergeFile(this.token);
        this.emitEnd(url);
      }
    } catch (error) {
      this.emitError(error);
    }
  }
}
