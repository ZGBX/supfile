import {EventEmitter} from '../event/eventEmitter';
import {Task} from './task';

// 任务队列事件类型
export const TaskQueueEventName = {
  START: 'start',
  PAUSE: 'pause',
  DRAIN: 'drain',
} as const;

// 自动推导事件类型
export type TaskQueueEvent = (typeof TaskQueueEventName)[keyof typeof TaskQueueEventName];

// 任务队列状态枚举
export enum TaskQueueStatus {
  RUNNING = 'running', // 运行中
  PAUSED = 'paused', // 暂停中
}

// 可并发执行的任务队列
export class TaskQueue extends EventEmitter<TaskQueueEvent> {
  // 待执行的任务
  private tasks: Set<Task> = new Set();
  // 当前正在执行的任务数
  private currentCount: number = 0;
  // 任务队列状态
  private status: TaskQueueStatus = TaskQueueStatus.PAUSED;
  // 最大并发数
  private concurrency: number = 4;

  constructor(concurrency: number = 4) {
    super();
    this.concurrency = concurrency;
  }

  // 添加任务
  add(...task: Task[]) {
    for (const t of task) {
      this.tasks.add(t);
    }
  }

  // 添加任务并启动执行
  addAndStart(...task: Task[]) {
    this.add(...task);
    this.start();
  }

  // 启动任务
  start() {
    if (this.status === TaskQueueStatus.RUNNING) return;

    if (this.tasks.size === 0) {
      // 当前已无任务
      this.emit(TaskQueueEventName.DRAIN);
      return;
    }
    // 设置状态为运行中
    this.status = TaskQueueStatus.RUNNING;
    this.emit(TaskQueueEventName.START);
    // 执行任务
    this.runNext();
  }

  // 取出第一个任务
  private takeHeadTask() {
    const task = this.tasks.values().next().value;
    if (task) {
      this.tasks.delete(task);
    }
    return task;
  }

  // 执行下一个任务
  private runNext() {
    // 如果任务不是执行中，直接返回
    if (this.status !== TaskQueueStatus.RUNNING) return;
    // 并发执行任务数已满
    if (this.currentCount >= this.concurrency) return;
    // 取出第一个任务
    const task = this.takeHeadTask();
    if (!task) {
      // 当前已无任务
      this.status = TaskQueueStatus.PAUSED; // 设置状态为暂停中
      this.emit(TaskQueueEventName.DRAIN);
      return;
    }
    this.currentCount++; // 增加当前执行任务数
    // 执行任务
    Promise.resolve()
      .then(() => task.run())
      .finally(() => {
        this.currentCount--; // 减少当前执行任务数
        this.runNext(); // 继续执行下一个任务
      });
    // 继续执行下一个任务
    this.runNext();
  }

  // 暂停任务
  pause() {
    this.status = TaskQueueStatus.PAUSED;
    this.emit(TaskQueueEventName.PAUSE);
  }
}
