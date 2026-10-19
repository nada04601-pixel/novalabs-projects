// 동영상 자막 지우기: 화면에 새겨진 자막의 글자 픽셀을 찾아 주변 색으로 메웁니다(워터마크 지우기의 인페인팅을 씀).
// 고른 영역 전체를 메우지 않고 글자와 테두리만 메우므로, 자막이 없는 장면은 그대로 두고 배경도 덜 뭉개집니다.
import { pick, type Lang } from "../i18n";
import { inpaint, type Rect } from "./watermark";

export const MAX_AREAS = 3;

export const TEXT_COLORS = ["white", "yellow", "bright"] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

// 감지 민감도: 글자가 바로 옆(테두리·그림자·배경)보다 이만큼 밝아야 글자로 봅니다. 낮을수록 더 많이 지웁니다.
export const SENSITIVITY = { low: 110, normal: 80, high: 55 } as const;
export type Sensitivity = keyof typeof SENSITIVITY;

// 처음 열었을 때 고르는 영역: 자막이 주로 나오는 화면 아래쪽 띠
export function defaultArea(w: number, h: number): Rect {
  const x = Math.round(w * 0.05), y = Math.round(h * 0.72);
  return { x, y, w: Math.round(w * 0.95) - x, h: Math.round(h * 0.96) - y };
}

// 글자 색인지 봅니다. 흰 글자는 밝고 색이 거의 없으며, 노란 글자는 빨강·초록이 밝고 파랑이 낮습니다.
export function isTextColor(r: number, g: number, b: number, color: TextColor): boolean {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (color === "white") return min >= 170 && max - min <= 60;
  if (color === "yellow") return r >= 170 && g >= 150 && b <= 140 && r - b >= 70;
  return 0.299 * r + 0.587 * g + 0.114 * b >= 160;
}

// 글자 획 굵기에 맞춘 거리(px). 1080p에서 약 9px입니다.
export const strokeRadius = (frameH: number) => Math.max(3, Math.round(frameH / 120));
// 글자 가장자리 번짐과 테두리까지 덮으려고 마스크를 넓히는 거리(px)
export const growRadius = (frameH: number, pad: number) => Math.max(2, Math.round(frameH / 270)) + pad;

// 한 줄(또는 한 열)에서 반지름 r 안의 최솟값·최댓값. 단조 덱으로 길이에 비례하는 시간에 끝납니다.
function slide(src: ArrayLike<number>, dst: { [i: number]: number }, start: number, step: number, n: number, r: number, max: boolean) {
  const dq = new Int32Array(n);
  let head = 0, tail = 0, next = 0;
  const better = (a: number, b: number) => (max ? a >= b : a <= b);
  for (let i = 0; i < n; i++) {
    const hi = Math.min(n - 1, i + r);
    while (next <= hi) {
      const v = src[start + next * step];
      while (tail > head && better(v, src[start + dq[tail - 1] * step])) tail--;
      dq[tail++] = next++;
    }
    while (dq[head] < i - r) head++;
    dst[start + i * step] = src[start + dq[head] * step];
  }
}

// w×h 값에서 (2r+1)×(2r+1) 정사각형 안의 최솟값(max=false) 또는 최댓값(max=true)
export function boxFilter<T extends Uint8Array | Float32Array>(src: T, w: number, h: number, r: number, max: boolean): T {
  const tmp = new (src.constructor as new (n: number) => T)(w * h);
  const out = new (src.constructor as new (n: number) => T)(w * h);
  for (let y = 0; y < h; y++) slide(src, tmp, y * w, 1, w, r, max);
  for (let x = 0; x < w; x++) slide(tmp, out, x, w, h, r, max);
  return out;
}

export type DetectOptions = { color: TextColor; sensitivity: Sensitivity; frameH: number; pad: number };

// RGBA 픽셀(data, w×h)에서 영역(area 기준 좌표) 안의 자막 글자를 찾아 메울 마스크와 글자 픽셀 수를 돌려줍니다.
export function subtitleMask(data: Uint8ClampedArray, w: number, h: number, areas: Rect[], o: DetectOptions) {
  const n = w * h;
  const inside = new Uint8Array(n);
  for (const q of areas) {
    const x0 = Math.max(0, q.x), x1 = Math.min(w, q.x + q.w);
    for (let y = Math.max(0, q.y); y < Math.min(h, q.y + q.h); y++) inside.fill(1, y * w + x0, y * w + x1);
  }
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    lum[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  // 글자 획 바깥까지 닿는 거리 안에서 가장 어두운 값. 테두리나 그림자, 더 어두운 배경이 있어야 글자로 봅니다.
  // 넓은 하늘·흰 벽처럼 주변까지 밝은 곳은 글자로 보지 않습니다.
  const darkest = boxFilter(lum, w, h, strokeRadius(o.frameH), false);
  const contrast = SENSITIVITY[o.sensitivity];
  const text = new Uint8Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (!inside[i]) continue;
    const p = i * 4;
    if (lum[i] - darkest[i] >= contrast && isTextColor(data[p], data[p + 1], data[p + 2], o.color)) {
      text[i] = 1;
      count++;
    }
  }
  const mask = count ? boxFilter(text, w, h, growRadius(o.frameH, o.pad), true) : text;
  // 넓힌 마스크도 고른 영역 밖으로는 나가지 않게 합니다.
  if (count) for (let i = 0; i < n; i++) mask[i] &= inside[i];
  return { mask, count };
}

// 영역 넓이에 비해 글자 픽셀이 이보다 적으면 자막이 없는 장면으로 보고 그대로 둡니다(잡티로 화면이 번지지 않게).
export const MIN_TEXT_RATIO = 0.002;

// 프레임 전체 RGBA(width×height)를 받아 영역들 안의 자막을 지웁니다. 작업 범위만 잘라 계산합니다.
// 실제로 지웠으면 true입니다. getImageData·putImageData는 부르는 쪽에서 합니다.
export function cleanArea(
  img: { data: Uint8ClampedArray; width: number; height: number },
  area: Rect,
  areas: Rect[],
  o: DetectOptions,
): boolean {
  const local = areas.map((q) => ({ x: q.x - area.x, y: q.y - area.y, w: q.w, h: q.h }));
  const { mask, count } = subtitleMask(img.data, img.width, img.height, local, o);
  const total = local.reduce((s, q) => s + q.w * q.h, 0);
  if (count === 0 || count < total * MIN_TEXT_RATIO) return false;
  // 글자 획은 가늘어서 평활화를 조금만 해도 매끄럽게 이어집니다.
  return inpaint(img.data, img.width, img.height, mask, 12);
}

// 결과 파일 이름: 여행.mkv + mkv → 여행-자막제거.mkv
export const subtitleRemovedName = (name: string, ext: string, lang: Lang = "ko") =>
  `${name.replace(/\.[^.]+$/, "") || pick(lang, "동영상", "video")}-${pick(lang, "자막제거", "no-subtitles")}.${ext}`;

// 화면 자막 지우기는 프레임마다 계산하므로 긴 변을 이만큼으로 줄여 처리합니다.
export const BURN_MAX_SIDE = 1920;

// 원본보다 크게 만들지 않고 비율을 지켜 긴 변을 maxSide 이하로, 인코더가 요구하는 짝수로 맞춥니다.
export function fitLongSide(w: number, h: number, maxSide = BURN_MAX_SIDE) {
  const s = Math.min(1, maxSide / Math.max(w, h));
  const even = (v: number) => Math.max(2, Math.round((v * s) / 2) * 2);
  return { w: even(w), h: even(h) };
}
