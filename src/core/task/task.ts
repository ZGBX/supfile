// 任务构造器
export class Task {
  fn: Function; // 任务关联的执行函数
  payload?: any; // 任务关联的其他信息
  constructor(fn: Function, payload?: any) {
    this.fn = fn;
    this.payload = payload;
  }

  // 执行任务
  run() {
    return this.fn(this.payload);
  }
}
