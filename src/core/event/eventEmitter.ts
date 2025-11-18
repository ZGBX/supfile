// 发布订阅模式

export class EventEmitter<T extends string> {
  private events: Map<T, Set<(...args: any[]) => void>> = new Map();

  // 订阅事件
  on(event: T, listener: (...args: any[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)?.add(listener);
  }

  // 取消订阅事件
  off(event: T, listener: (...args: any[]) => void): void {
    this.events.get(event)?.delete(listener);
  }

  // 订阅一次事件
  once(event: T, listener: (...args: any[]) => void): void {
    const onceListener = (...args: any[]) => {
      listener(...args);
      // 执行后取消订阅
      this.off(event, onceListener);
    };
    this.on(event, onceListener);
  }

  // 发布事件
  emit(event: T, ...args: any[]) {
    if (!this.events.has(event)) {
      return;
    }
    this.events.get(event)?.forEach(listener => {
      listener(...args);
    });
  }
}
