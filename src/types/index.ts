/**
 * 上传文件的参数选项。
 * @interface UploadOptions
 * @property {File | Blob} file - 要上传的文件或 Blob 对象。
 * @property {string} url - 文件上传的目标 URL。
 * @property {Record<string, string>} [headers] - 可选，上传请求附加的请求头。
 * @property {(percentage: number) => void} [onProgress] - 可选，上传进度回调，参数为百分比。
 * @property {(response: any) => void} [onSuccess] - 可选，上传成功回调，参数为响应数据。
 * @property {(error: any) => void} [onError] - 可选，上传失败回调，参数为错误信息。
 */
export interface UploadOptions {
  file: File | Blob;
  url: string;
  headers?: Record<string, string>;
  onProgress?: (percentage: number) => void;
  onSuccess?: (response: any) => void;
  onError?: (error: any) => void;
}

/**
 * 上传结果。
 * @interface UploadResult
 * @property {boolean} success - 是否上传成功。
 * @property {any} [data] - 可选，成功时返回的数据。
 * @property {string} [error] - 可选，失败时的错误信息。
 */
export interface UploadResult {
  success: boolean;
  data?: any;
  error?: string;
}
