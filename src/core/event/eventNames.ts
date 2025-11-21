export const EventNames = {
  // 上传控制器相关
  UPLOAD_PROGRESS: 'progress', // 上传进度事件
  UPLOAD_END: 'end', // 上传完成事件
  UPLOAD_ERROR: 'error', // 上传错误事件
  CHUNK_STATUS_CHANGE: 'chunkStatusChange', // 分片状态变更事件

  // 分片相关
  CHUNK_HASHED: 'chunkHashed', // 分片hash计算完成事件
  WHOLE_HASH: 'wholeHash', // 文件整体hash计算完成事件
  SPLIT_DRAIN: 'splitDrain', // 分片完成事件

  // 任务队列相关
  TASK_START: 'taskStart', // 任务队列开始事件
  TASK_PAUSE: 'taskPause', // 任务队列暂停事件
  TASK_DRAIN: 'taskDrain', // 任务队列完成事件
} as const;

export type UploadControllerEvent =
  | typeof EventNames.UPLOAD_PROGRESS
  | typeof EventNames.UPLOAD_END
  | typeof EventNames.UPLOAD_ERROR
  | typeof EventNames.CHUNK_STATUS_CHANGE;

export type ChunkSplitorEvent =
  | typeof EventNames.CHUNK_HASHED
  | typeof EventNames.WHOLE_HASH
  | typeof EventNames.SPLIT_DRAIN;

export type TaskQueueEvent = typeof EventNames.TASK_START | typeof EventNames.TASK_PAUSE | typeof EventNames.TASK_DRAIN;

export type EventName = (typeof EventNames)[keyof typeof EventNames];
