import {RequestStrategy} from '../core/upload/requestStrategy';
import {SplitStrategyType} from '../core/chunk/type';
/**
 * UploadController 构造与初始化选项（与 controller.ts 对齐）
 */
export interface UploadControllerOptions {
  file: File;
  requestStrategy: RequestStrategy;
  splitStrategyType?: SplitStrategyType;
  // 单片大小（字节），默认在 controller 中为 5 * 1024 * 1024
  chunkSize?: number;
  // 并发上传数，默认 4
  concurrency?: number;
  callbacks?: UploadCallbacks;
}

/**
 * 上传回调集合（供 UploadController 使用）
 */
export interface UploadCallbacks {
  onProgress?: (percent: number) => void;
  onEnd?: (url: string) => void;
  onError?: (err: any) => void;
  onChunkHashed?: (index: number, hash: string) => void;
}
