// MutilThreadSplitor.ts 基于多线程的分片器实现

// 导入事件管理器、分片抽象类和分片类型
import {EventEmitter} from '../event/eventEmitter';
import {EventNames} from '../event/eventNames';
import {ChunkSplitor} from './chunkSplitor';
import {Chunk} from './type';

/**
 * 基于多线程的分片器实现
 * 利用 Web Worker 并行计算分片 hash，提高大文件处理效率
 */
export class MutilThreadSplitor extends ChunkSplitor {
  // 使用浏览器的 CPU 核心数决定 Worker 数量，默认至少 4 个
  private workers: Worker[] = new Array(navigator.hardwareConcurrency || 4).fill(0).map(() => {
    return new Worker(new URL('./splitWorker.js', import.meta.url), {type: 'module'});
  });

  /**
   * 并行计算分片 hash
   * @param chunks 分片数组
   * @param emitter 事件管理器，用于通知分片处理结果
   */
  calcHash(chunks: Chunk[], emitter: EventEmitter<typeof EventNames.CHUNK_HASHED>): void {
    // 每个 worker 负责的分片数量
    const workerSize = Math.ceil(chunks.length / this.workers.length);
    for (let i = 0; i < this.workers.length; i++) {
      const worker = this.workers[i];
      // 计算当前 worker 负责的分片区间
      const start = i * workerSize;
      const end = Math.min((i + 1) * workerSize, chunks.length);
      const workerChunks = chunks.slice(start, end);
      // 向 worker 分配分片任务
      worker.postMessage(workerChunks);
      // 监听 worker 返回结果，通知主线程分片已处理
      worker.onmessage = e => {
        emitter.emit(EventNames.CHUNK_HASHED, e.data);
      };
    }
  }

  /**
   * 销毁所有 worker，释放资源
   */
  dispose(): void {
    this.workers.forEach(worker => worker.terminate());
  }
}
