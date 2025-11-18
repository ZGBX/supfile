// // 导入分片类型和 hash 计算方法
// import {Chunk} from './type';
// import {calculateChunkHash} from './index';

// /**
//  * Worker 接收到主线程分配的分片数组后，逐个计算 hash 并返回结果
//  * @param e MessageEvent，包含分片数组
//  */
// onmessage = function (e) {
//   const chunks = e.data;
//   for (const chunk of chunks) {
//     // 异步计算分片 hash
//     calculateChunkHash(chunk).then(hash => {
//       chunk.hash = hash;
//       // 将带 hash 的分片返回主线程
//       postMessage([chunk]);
//     });
//   }
// };

import SparkMD5 from 'https://cdn.jsdelivr.net/npm/spark-md5@3.0.2/+esm';

self.onmessage = function (e) {
  const chunks = e.data;
  for (const chunk of chunks) {
    const reader = new FileReader();
    reader.onload = function (evt) {
      const spark = new SparkMD5.ArrayBuffer();
      spark.append(evt.target.result);
      chunk.hash = spark.end();
      self.postMessage([chunk]);
    };
    reader.readAsArrayBuffer(chunk.blob);
  }
};
