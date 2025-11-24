import {NormalizedNetworkInfo} from '../../utils/netWork';

export function suggestConcurrency(info: NormalizedNetworkInfo | null): number {
  if (!info) return 4;
  // 用户开启了省流量模式，尽量降到 1
  if (info.saveData) return 1;

  const et = (info.effectiveType || '').toLowerCase();
  const downlink = typeof info.downlink === 'number' ? info.downlink : 0;
  const rtt = typeof info.rtt === 'number' ? info.rtt : Infinity;

  // 基于 effectiveType 优先级设置
  if (et.includes('slow-2g') || et === '2g') return 1;
  if (et === '3g') return 2;
  if (et === '4g' || et === 'wifi' || et === '5g') {
    // 对于高速网络，根据 downlink/rtt 微调
    if (downlink >= 10 && rtt < 150) return 6;
    if (downlink >= 5) return 4;
    return 3;
  }

  // fallback：基于 downlink/rtt
  if (downlink >= 10 && rtt < 200) return 6;
  if (downlink >= 3) return 4;
  if (rtt > 300) return 1;
  return 2;
}
