# supfile

简洁、高可用的文件上传库

## 特性

- 支持文件上传，断点续传
- 支持异步计算hash
- 支持多线程分片计算（Web Worker）
- 可自定义请求策略
- 支持自定义上传策略：只需实现 RequestStrategy 接口的四个方法，即可对接任意后端或业务流程，方法内部逻辑完全可自定义。

## 快速开始

安装（从 npm）：

```bash
npm install supfile
```

```
// 简单自定义 RequestStrategy（示意）
class MyRequestStrategy {
async createFile(file) {
// 返回用于后续请求的 token
return 'mock-token';
}
async patchHash(token, hash, type) {
// 向服务端校验 hash，示例返回需要补传的分片索引数组
return { hasFile: false, rest: [] };
}
async uploadChunk(chunk) {
// 上传分片实现
}
async mergeFile(token) {
// 合并并返回文件 URL
return 'https://example.com/uploaded-file';
}
}

// 使用示例
import { UploadController } from './dist/index.esm.js'; // 或直接 import 'supfile'（已发布包）
const requestStrategy = new MyRequestStrategy();
const controller = new UploadController({
file: /_ File 或 Blob _/,
requestStrategy,
// 可选回调
callbacks: {
onProgress: percent => console.log('progress:', percent + '%'),
onEnd: url => console.log('end:', url),
onError: err => console.error('error:', err)
}
});

// 启动上传（示例方法名，根据你的 SDK 接口调用）
controller.start();

```
