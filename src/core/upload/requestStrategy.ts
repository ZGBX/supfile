import {Chunk} from '../chunk/type';

// 请求策略
export interface RequestStrategy {
  // 文件创建请求，返回token
  createFile(file: File): Promise<string>;
  // 分片上传请求
  uploadChunk(chunk: Chunk): Promise<void>;
  // 文件合并请求
  mergeFile(token: string): Promise<string>;
  // hash校验请求
  patchHash<T extends 'file' | 'chunk'>(
    token: string,
    hash: string,
    type: T,
  ): Promise<T extends 'file' ? {hasFile: boolean} : {hasFile: boolean; rest: number[]; url: string}>;
}
