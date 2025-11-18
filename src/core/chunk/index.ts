import {Chunk} from './type';
// import SparkMD5 from 'spark-md5';

/*
 * 创建一个不带hash的chunk
 * @param file 文件对象
 * @param index 分片的索引
 * @param chunkSize 分片的大小
 * @return 返回创建的Chunk对象
 */
export function createChunk(file: File, index: number, chunkSize: number): Chunk {
  const start = index * chunkSize;
  const end = Math.min(file.size, start + chunkSize);
  const blob = file.slice(start, end);
  return {
    blob,
    start,
    end,
    hash: '',
    index,
  };
}

/**
 * 计算分片的hash值
 * @param chunk 分片对象
 * @return 返回分片的hash值
 */
export function calculateChunkHash(chunk: Chunk): Promise<string> {
  return new Promise(resovle => {
    let SparkMD5Instance: any;

    if (typeof window !== 'undefined' && (window as any).SparkMD5) {
      // 浏览器环境用全局变量
      SparkMD5Instance = (window as any).SparkMD5;
    } else {
      // Node 或打包环境用 import
      // @ts-ignore
      SparkMD5Instance = require('spark-md5');
    }
    const spark = new SparkMD5Instance.ArrayBuffer();

    const fileReader = new FileReader();
    // 设置文件读取完成的回调函数
    fileReader.onload = e => {
      spark.append(e.target?.result as ArrayBuffer);
      resovle(spark.end());
    };
    // 异步读取数据
    fileReader.readAsArrayBuffer(chunk.blob);
  });
}
