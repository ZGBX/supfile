import {ChunkSplitor} from './chunkSplitor';
import {Chunk} from './type';
import {EventEmitter} from '../event/eventEmitter';
import {calculateChunkHash} from './index';

/**
 * 基于主线程时间切片的分片器
 * 利用 requestIdleCallback 或 setTimeout 分批计算分片 hash，避免主线程长时间阻塞
 */

export class TimeSliceSplitor extends ChunkSplitor {
  calcHash(chunks: Chunk[], emitter: EventEmitter<'chunks'>): void {
    let index = 0;
    const batchSize = 2;
    const processBatch = () => {
      const batch: Chunk[] = [];
      let count = 0;
      while (index < chunks.length && count < batchSize) {
        batch.push(chunks[index]);
        count++;
        index++;
      }
      // 计算当前批次分片的 hash
      Promise.all(
        batch.map(async chunk => {
          chunk.hash = await calculateChunkHash(chunk);
          return chunk;
        }),
      ).then(doneChunks => {
        emitter.emit('chunks', doneChunks);
        if (index < chunks.length) {
          // 利用 requestIdleCallback 或 setTimeout 继续处理下一批
          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(processBatch);
          } else {
            setTimeout(processBatch, 0);
          }
        }
      });
    };

    // 启动分批处理
    processBatch();
  }
  dispose(): void {
    // 主线程时间切片无需特殊销毁逻辑
  }
}
