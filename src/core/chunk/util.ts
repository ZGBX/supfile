import {NormalizedNetworkInfo} from '../../utils/netWork';
/**
 * 根据网络信息建议单个分片大小（字节）
 * 注意：分片大小只能影响尚未拆分/未入队的分片，上传中无法改变已生成分片大小。
 */
export function suggestChunkSize(info: NormalizedNetworkInfo | null): number {
  // 值为字节，示例阈值，可按需调整
  const KB = 1024;
  const MB = 1024 * KB;
  if (!info) return 1 * MB;
  if (info.saveData) return 256 * KB;
  const et = (info.effectiveType || '').toLowerCase();
  const downlink = info.downlink ?? 0;

  if (et.includes('2g') || et.includes('slow')) return 256 * KB;
  if (et.includes('3g') || downlink < 1) return 512 * KB;
  if (et.includes('4g') || downlink >= 5) return 2 * MB;
  if (et.includes('5g') || downlink >= 20) return 4 * MB;
  return 1 * MB;
}
