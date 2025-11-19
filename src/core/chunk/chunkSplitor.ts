// 分片相关事件
// chunks: 一部分分配产生了
// wholeHash：整个文件的hash计算完成
// drain: 所有分片处理完成

// import SparkMD5 from 'spark-md5';
import {EventEmitter} from '../event/eventEmitter';
import {Chunk} from './type';
import {createChunk} from '.';
import {ChunkSplitorEvent, EventNames} from '../event/eventNames';

let SparkMD5Instance: any;
if (typeof window !== 'undefined' && (window as any).SparkMD5) {
  // 浏览器环境用全局变量
  SparkMD5Instance = (window as any).SparkMD5;
} else {
  // Node 或打包环境用 import
  // @ts-ignore
  SparkMD5Instance = require('spark-md5');
}

export abstract class ChunkSplitor extends EventEmitter<ChunkSplitorEvent> {
  protected chunkSize: number; // 分片大小，单位字节
  protected file: File; // 待分片的文件
  protected hash?: string; // 整个文件的hash值
  protected chunks: Chunk[]; // 分片列表
  private handleChunkCount: number = 0; // 已处理的分片数量
  private spark = new SparkMD5Instance(); // 用于计算文件hash的SparkMD5实例
  private hasSplited: boolean = false; // 是否已经分片

  constructor(file: File, chunkSize: number) {
    super();
    this.file = file;
    this.chunkSize = chunkSize;
    const chunkCount = Math.ceil(this.file.size / this.chunkSize);
    this.chunks = new Array(chunkCount).fill(0).map((_, index) => createChunk(this.file, index, this.chunkSize));
  }

  split(): void {
    if (this.hasSplited) {
      return;
    }
    this.hasSplited = true;
    const emitter = new EventEmitter<typeof EventNames.CHUNK_HASHED>();
    const chunksHanlder = (chunks: Chunk[]) => {
      this.emit(EventNames.CHUNK_HASHED, chunks);
      chunks.forEach(chunk => {
        this.spark.append(chunk.hash);
      });
      this.handleChunkCount += chunks.length;
      if (this.handleChunkCount === this.chunks.length) {
        // 计算完成
        emitter.off(EventNames.CHUNK_HASHED, chunksHanlder);
        this.emit(EventNames.WHOLE_HASH, this.spark.end());
        this.spark.destroy();
        this.emit(EventNames.SPLIT_DRAIN);
      }
    };
    emitter.on(EventNames.CHUNK_HASHED, chunksHanlder);
    this.calcHash(this.chunks, emitter);
  }

  // 计算每一个分片的hash
  abstract calcHash(chunks: Chunk[], emitter: EventEmitter<typeof EventNames.CHUNK_HASHED>): void;

  // 分片完成后一些需要销毁的工作
  abstract dispose(): void;

  public getChunks(): Chunk[] {
    return this.chunks;
  }
}
