// 检测设备是否在线
export function isOnline(): boolean {
  return navigator.onLine;
}

// 监听网络状态变化
export function onNetworkStatusChange(callback: (online: boolean) => void) {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
}

export interface NormalizedNetworkInfo {
  downlink: number | null;
  effectiveType: string | null;
  rtt: number | null;
  saveData: boolean | null;
  type: string | null;
  online: boolean;
}

// 获取当前网络信息
export function getNetworkInfo(): NormalizedNetworkInfo {
  const nav: any = navigator;
  // 兼容不同前缀实现
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection || null;
  const online = !!navigator.onLine;

  if (!conn) {
    return {
      downlink: null,
      effectiveType: null,
      rtt: null,
      saveData: null,
      type: null,
      online,
    };
  }

  const downlink = typeof conn.downlink === 'number' ? conn.downlink : null;
  const effectiveType =
    typeof conn.effectiveType === 'string' ? conn.effectiveType : typeof conn.type === 'string' ? conn.type : null;
  const rtt = typeof conn.rtt === 'number' ? conn.rtt : null;
  const saveData = typeof conn.saveData === 'boolean' ? conn.saveData : null;
  const type = typeof conn.type === 'string' ? conn.type : null;

  return {downlink, effectiveType, rtt, saveData, type, online};
}
