import {ChunkSplitor} from '../chunk/chunkSplitor';
import {Chunk} from '../chunk/type';
import {EventEmitter} from '../event/eventEmitter';
import {Task} from '../task/task';
import {TaskQueue} from '../task/taskQueue';
import {RequestStrategy} from './requestStrategy';
import {UploadControllerEvent, EventNames} from '../event/eventNames';
import {onNetworkStatusChange} from '../../utils/netWork';
import {SimpleSplitor} from '../chunk/simpleSplitor';
import {MutilThreadSplitor} from '../chunk/mutilThreadSplitor';
import {SplitStrategyType, SplitStrategyTypes} from '../chunk/type';
import {UploadControllerOptions, UploadCallbacks} from '../../types/index';

/**
 * 分片上传控制器
 * 负责分片上传的整体流程控制，包括并发、事件、请求解耦等
 */
export class UploadController extends EventEmitter<UploadControllerEvent> {
  // --- 核心策略与状态 ---
  private requestStrategy: RequestStrategy; // 上传策略
  private splitStrategy: ChunkSplitor; // 分片策略
  private taskQueue: TaskQueue; // 任务队列
  private file: File; // 待上传文件
  private callbacks: UploadCallbacks = {}; // 上传回调

  // --- 上传状态属性 ---
  private fileHash: string = ''; // 整体文件hash值
  private token: string = ''; // 文件上传唯一标识
  private totalChunks: number = 0; // 总分片数
  private finishedChunks: number = 0; // 已完成分片数
  private failedChunks: number = 0; // 失败分片数

  // --- 控制标记 ---
  private isPaused = false; // 是否已暂停上传
  private filePatchChecked: boolean = false; // 是否已进行文件秒传检查
  private isDisposed: boolean = false; // 控制器是否已被销毁
  private missingChunkHashes: Set<string> | null = null; // 服务端确认的缺失分片hash

  // --- 配置属性 ---
  private chunkSize: number; // 分片大小
  private splitStrategyType: SplitStrategyType; // 分片策略类型

  // =================================================================
  // #region Public API Methods
  // =================================================================

  constructor(options: UploadControllerOptions) {
    super();
    this.file = options.file;
    this.requestStrategy = options.requestStrategy;

    this.splitStrategyType = options.splitStrategyType ?? SplitStrategyTypes.SIMPLE;
    this.chunkSize = options.chunkSize || 5 * 1024 * 1024; // 默认5MB

    if (this.splitStrategyType === SplitStrategyTypes.MULTI) {
      this.splitStrategy = new MutilThreadSplitor(this.file, this.chunkSize);
    } else {
      this.splitStrategy = new SimpleSplitor(this.file, this.chunkSize);
    }

    this.taskQueue = new TaskQueue(options.concurrency || 4);
    this.totalChunks = this.splitStrategy.getChunks().length;
    this.callbacks = options.callbacks || {};
  }

  /**
   * 初始化并开始上传流程
   */
  async init() {
    if (this.isDisposed) {
      console.error('Controller has been disposed and cannot be reused.');
      return;
    }
    try {
      this.token = await this.requestStrategy.createFile(this.file);

      // 监听分片事件
      this.splitStrategy.on(EventNames.CHUNK_HASHED, this.handleChunks.bind(this));
      // 监听整体文件hash计算完成事件
      this.splitStrategy.on(EventNames.WHOLE_HASH, this.handleWholeHash.bind(this));

      // 监听分片状态变更事件，判断是否全部分片处理完毕
      this.on(EventNames.CHUNK_STATUS_CHANGE, () => {
        if (this.finishedChunks + this.failedChunks === this.totalChunks) {
          // 全部分片已处理，决定是否合并或结束
          if (this.finishedChunks === this.totalChunks) {
            // 全部成功，合并
            this.mergeChunks();
          } else {
            // 有失败，结束
            this.emitError(new Error(`${this.failedChunks} 个分片上传失败`));
          }
        }
      });

      // 启动分片
      this.splitStrategy.split();

      // 监听网络状态变化，offline时暂停上传
      onNetworkStatusChange((online: boolean) => {
        if (!online) {
          this.pause();
          this.emitError(new Error('网络已断开，上传已暂停'));
        }
      });
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * 暂停上传
   */
  pause() {
    if (this.isDisposed) return;
    this.isPaused = true;
    this.taskQueue.pause();
  }

  /**
   * 继续上传
   */
  resume() {
    if (this.isDisposed || !this.isPaused) return;
    this.isPaused = false;
    this.taskQueue.start();
  }

  /**
   * 取消上传
   */
  cancel() {
    if (this.isDisposed) return;
    this.isPaused = false;
    this.finishedChunks = 0;
    this.token = '';
    this.emitError(new Error('上传已取消'));
    this._cleanup();
  }

  // #endregion

  // =================================================================
  // #region Private Event Handlers
  // =================================================================
  // 分片处理事件
  private handleChunks(chunks: Chunk[]) {
    if (this.isDisposed) return;

    if (this.filePatchChecked) {
      console.log('秒传已命中，跳过上传分片');
      return;
    }

    let chunksToUpload = chunks;

    if (this.missingChunkHashes !== null) {
      chunksToUpload = chunks.filter(chunk => this.missingChunkHashes!.has(chunk.hash));
      console.log(
        '过滤后的待上传分片:',
        chunksToUpload.map(c => ({index: c.index, hash: c.hash})),
      );
    } else {
      console.log(
        'missingChunkHashes 未设置，上传所有分片:',
        chunks.map(c => ({index: c.index, hash: c.hash})),
      );
    }

    chunksToUpload.forEach(chunk => {
      this.taskQueue.addAndStart(new Task(() => this.uploadChunk(chunk)));
    });
  }

  // 处理文件hash计算完成事件
  private async handleWholeHash(hash: string) {
    if (this.isDisposed) return;

    this.fileHash = hash;
    this.callbacks.onChunkHashed?.(hash);

    if (this.filePatchChecked) return;

    try {
      const resp = await this.requestStrategy.patchHash(this.token, hash, 'file');
      this.filePatchChecked = true; // 标记文件级别检查已完成

      if (resp && 'url' in resp && resp.hasFile) {
        // 秒传成功
        console.log('秒传成功，文件已存在于服务器');
        this.finishedChunks = this.totalChunks;
        this.failedChunks = 0;
        this.updateProgress(true); // 更新一次最终进度
        this.emitEnd(resp.url as string);
      } else if (resp && 'rest' in resp && Array.isArray(resp.rest)) {
        console.log('文件不完整，需上传缺失分片, rest:', resp.rest);
        // 文件不完整，获取到缺失的分片列表
        this.missingChunkHashes = new Set(resp.rest);

        if (this.missingChunkHashes.size === 0) {
          // 如果没有缺失的分片，直接尝试合并
          this.mergeChunks();
          return;
        } else {
          this.finishedChunks += this.totalChunks - this.missingChunkHashes.size;
          console.log('预设 finishedChunks 为:', this.finishedChunks);
        }
      } else {
        console.log('文件未上传，需上传所有分片');
        // 兜底情况：patchHash没有返回有效信息，可能是一个全新的文件，所有分片都需要上传
        this.missingChunkHashes = new Set(this.splitStrategy.getChunks().map(c => c.hash));
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  // #endregion

  // =================================================================
  // #region Private Core Logic
  // =================================================================

  // 上传单个分片
  private async uploadChunk(chunk: Chunk) {
    if (this.isDisposed) return;
    try {
      // 校验分片是否已上传
      const resp = await this.requestStrategy.patchHash(this.token, chunk.hash, 'chunk');
      if (resp.hasFile) {
        return;
      }
      await this.requestStrategy.uploadChunk(chunk);
      this.updateProgress(true);
    } catch (error) {
      this.updateProgress(false);
      this.emitError(error);
    }
  }

  // 最终合并
  private async mergeChunks() {
    if (this.isDisposed) return;

    try {
      const url = await this.requestStrategy.mergeFile(this.token);
      this.emitEnd(url);
    } catch (error) {
      this.emitError(error);
    }
  }

  // #endregion

  // =================================================================
  // #region Private Helpers
  // =================================================================
  // 发布上传进度事件处理
  private updateProgress(success: boolean) {
    if (this.isDisposed) return;

    if (success) {
      this.finishedChunks++;
    } else {
      this.failedChunks++;
    }

    const percent = Math.round((this.finishedChunks / this.totalChunks) * 100);
    this.emit(EventNames.UPLOAD_PROGRESS, percent);
    this.callbacks.onProgress?.(percent);

    if (this.finishedChunks + this.failedChunks === this.totalChunks) {
      this.emit(EventNames.CHUNK_STATUS_CHANGE);
    }
  }

  // 发布上传完成事件处理
  private emitEnd(url: string) {
    if (this.isDisposed) return;
    this.emit(EventNames.UPLOAD_END, url);
    this.callbacks.onEnd?.(url);
    this._cleanup();
  }
  // 发布上传错误事件处理
  private emitError(error: any) {
    if (this.isDisposed) return;
    this.emit(EventNames.UPLOAD_ERROR, error);
    this.callbacks.onError?.(error);
    this._cleanup();
  }
  // 清理资源
  private _cleanup() {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.taskQueue.pause();
    this.taskQueue.clear();
    this.splitStrategy.dispose();
    this.splitStrategy.off(EventNames.CHUNK_HASHED, this.handleChunks.bind(this));
    this.splitStrategy.off(EventNames.WHOLE_HASH, this.handleWholeHash.bind(this));
    this.offAll(EventNames.CHUNK_STATUS_CHANGE);
  }

  // #endregion
}
