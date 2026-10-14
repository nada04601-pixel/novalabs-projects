// 빠른 모드 업스케일을 화면과 분리된 스레드에서 돌려, 큰 이미지에서도 페이지가 멈추지 않게 합니다.
import { fastUpscale } from "./upscale";

self.onmessage = (e: MessageEvent<{ data: Uint8ClampedArray; width: number; height: number; scale: number }>) => {
  const { data, width, height, scale } = e.data;
  const out = fastUpscale({ data, width, height }, scale);
  (self as unknown as Worker).postMessage(out, [out.data.buffer]);
};
