import {calculateChunkHash} from '.';
import {EventEmitter} from '../event/eventEmitter';
import {EventNames} from '../event/eventNames';
import {ChunkSplitor} from './chunkSplitor';
import {Chunk} from './type';

/**
 * 简单分片器实现
 * 直接继承自 ChunkSplitor，无需额外处理
 */
export class SimpleSplitor extends ChunkSplitor {
  calcHash(chunks: Chunk[], emitter: EventEmitter<typeof EventNames.CHUNK_HASHED>): void {
    Promise.all(
      chunks.map(async chunk => {
        chunk.hash = await calculateChunkHash(chunk);
        return chunk;
      }),
    ).then(doneChunks => {
      emitter.emit(EventNames.CHUNK_HASHED, doneChunks);
    });
  }
  dispose(): void {}
}
