import {calculateChunkHash} from '.';
import {EventEmitter} from '../event/eventEmitter';
import {ChunkSplitor} from './chunkSplitor';
import {Chunk} from './type';

/**
 * 简单分片器实现
 * 直接继承自 ChunkSplitor，无需额外处理
 */
export class SimpleSplitor extends ChunkSplitor {
  calcHash(chunks: Chunk[], emitter: EventEmitter<'chunks'>): void {
    Promise.all(
      chunks.map(async chunk => {
        chunk.hash = await calculateChunkHash(chunk);
        return chunk;
      }),
    ).then(doneChunks => {
      emitter.emit('chunks', doneChunks);
    });
  }
  dispose(): void {}
}
