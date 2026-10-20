// 배경 제거(누끼)에 쓰는 계산: 모델 목록, 피사체 영역 찾기, 파일 이름
import { pick, type Lang } from "../i18n";

export const BG_MAX_BYTES = 50 * 1024 * 1024;
// 모델은 512·1024px로 줄여 보므로, 워커에는 긴 변 2048px까지만 보내고 마스크를 원본 크기로 키워 씁니다.
export const MASK_MAX_SIDE = 2048;

// MODNet(Apache-2.0)은 인물 사진용으로 가볍고, BiRefNet lite(MIT)는 상품·동물·물건까지 경계를 정교하게 따지만 무겁습니다.
export const BG_MODELS = {
  person: { id: "Xenova/modnet", label: "인물 (빠르게)", labelEn: "People (fast)", sizeMb: 25 },
  object: { id: "onnx-community/BiRefNet_lite", label: "사물·상품 (정교하게)", labelEn: "Objects & products (precise)", sizeMb: 115 },
} as const;
export type BgModel = keyof typeof BG_MODELS;

export type Box = { x: number; y: number; w: number; h: number };

// 마스크(0~255, 한 화소에 1바이트)에서 threshold를 넘는 화소를 모두 감싸는 사각형. 피사체가 없으면 null.
export function maskBounds(mask: Uint8Array | Uint8ClampedArray, w: number, h: number, threshold = 128): Box | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (mask[row + x] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// 마스크 좌표의 사각형을 원본 크기로 옮기고, 긴 변의 pad 비율만큼 여백을 둡니다(이미지 밖으로는 나가지 않음).
export function cropBox(box: Box, maskW: number, maskH: number, imgW: number, imgH: number, pad = 0.05): Box {
  const sx = imgW / maskW, sy = imgH / maskH;
  const m = Math.round(Math.max(box.w * sx, box.h * sy) * pad);
  const x = Math.max(0, Math.floor(box.x * sx) - m);
  const y = Math.max(0, Math.floor(box.y * sy) - m);
  const r = Math.min(imgW, Math.ceil((box.x + box.w) * sx) + m);
  const b = Math.min(imgH, Math.ceil((box.y + box.h) * sy) + m);
  return { x, y, w: r - x, h: b - y };
}

// 피사체가 화면의 몇 %를 차지하는지(0~1). 거의 0이면 피사체를 찾지 못한 것입니다.
export const maskCoverage = (mask: Uint8Array | Uint8ClampedArray, threshold = 128) => {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > threshold) n++;
  return mask.length ? n / mask.length : 0;
};

// 사진.jpg → 사진-배경제거.png
export const cutoutName = (name: string, ext: "png" | "jpg", lang: Lang = "ko") =>
  `${name.replace(/\.[^./\\]+$/, "") || pick(lang, "이미지", "image")}-${pick(lang, "배경제거", "no-bg")}.${ext}`;
