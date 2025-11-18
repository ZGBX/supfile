import {ChunkSplitor} from '../chunk/chunkSplitor';
import {Chunk} from '../chunk/type';
import {EventEmitter} from '../event/eventEmitter';
import {Task} from '../task/task';
import {TaskQueue} from '../task/taskQueue';
import {RequestStrategy} from './requestStrategy';

/**
 * 分片上传控制器
 * 负责分片上传的整体流程控制，包括并发、事件、请求解耦等
 */
export class UploadController extends EventEmitter<'end' | 'error' | 'progress'> {
  private requestStrategy: RequestStrategy; // 请求策略
  private splitStrategy: ChunkSplitor; // 分片策略
  private taskQueue: TaskQueue; // 任务队列
  private file: File; // 待上传文件
  private token: string = ''; // 文件上传唯一标识
  private uploadEmitter: EventEmitter<'progress'>; // 上传进度事件
  private totalChunks: number = 0;
  private finishedChunks: number = 0;

  constructor(options: {
    file: File;
    requestStrategy: RequestStrategy;
    splitStrategy: ChunkSplitor;
    concurrency?: number;
  }) {
    super();
    this.file = options.file;
    this.requestStrategy = options.requestStrategy;
    this.splitStrategy = options.splitStrategy;
    this.taskQueue = new TaskQueue(options.concurrency || 4);
    this.uploadEmitter = new EventEmitter<'progress'>();
    this.uploadEmitter.on('progress', (percent: number) => {
      this.emit('progress', percent);
    });
    this.totalChunks = options.splitStrategy.getChunks().length;
  }

  // 初始化上传流程
  async init() {
    // 获取文件token
    this.token = await this.requestStrategy.createFile(this.file);

    // 分片事件监听
    this.splitStrategy.on('chunks', this.handleChunks.bind(this));
    this.splitStrategy.on('wholeHash', this.handleWholeHash.bind(this));

    // 启动分片
    this.splitStrategy.split();
  }

  // 分片事件处理
  private handleChunks(chunks: Chunk[]) {
    chunks.forEach(chunk => {
      this.taskQueue.addAndStart(new Task(this.uploadChunk.bind(this), chunk));
    });
  }

  // 分片上传任务
  async uploadChunk(chunk: Chunk) {
    // hash校验，避免重复上传
    const resp = await this.requestStrategy.patchHash(this.token, chunk.hash, 'chunk');
    if (resp.hasFile) {
      this.updateProgress();
      return;
    }
    // 分片上传
    await this.requestStrategy.uploadChunk(chunk);
    this.updateProgress();
  }

  // 更新上传进度
  private updateProgress() {
    this.finishedChunks++;
    const percent = Math.round((this.finishedChunks / this.totalChunks) * 100);
    this.uploadEmitter.emit('progress', percent);
  }

  // 整体hash事件处理
  private async handleWholeHash(hash: string) {
    // hash校验
    const resp = await this.requestStrategy.patchHash(this.token, hash, 'file');
    // file 类型
    if ('url' in resp && resp.hasFile) {
      this.emit('end', resp.url);
      return;
    }
    // chunk 类型
    if ('rest' in resp && Array.isArray(resp.rest) && resp.rest.length > 0) {
      // 需要补传缺失分片
      const missingChunks = resp.rest.map((idx: number) => (this.splitStrategy as any).chunks[idx]);
      missingChunks.forEach((chunk: Chunk) => {
        this.taskQueue.addAndStart(new Task(this.uploadChunk.bind(this), chunk));
      });
      this.taskQueue.on('drain', async () => {
        const url = await this.requestStrategy.mergeFile(this.token);
        this.emit('end', url);
      });
    } else {
      // 没有缺失分片，直接合并
      const url = await this.requestStrategy.mergeFile(this.token);
      this.emit('end', url);
    }
  }
}
