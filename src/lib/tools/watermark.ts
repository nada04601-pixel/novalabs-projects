// 워터마크 지우기: 고른 사각형 영역을 주변 픽셀로 메웁니다(인페인팅). 이미지와 동영상 프레임에 함께 씁니다.
import { pick, type Lang } from "../i18n";

export type Rect = { x: number; y: number; w: number; h: number };

export const WM_IMAGE_MAX_BYTES = 50 * 1024 * 1024;
export const WM_VIDEO_MAX_BYTES = 500 * 1024 * 1024;
export const MAX_RECTS = 10;
// 메울 영역 바깥으로 이만큼(px) 더 읽어 와 주변 색을 참고합니다.
export const CONTEXT_MARGIN = 12;

// 드래그한 두 점(순서 무관)을 이미지 안쪽으로 자른 정수 사각형으로 바꿉니다. 넓이가 없으면 null입니다.
export function normalizeRect(x0: number, y0: number, x1: number, y1: number, width: number, height: number): Rect | null {
  const left = Math.max(0, Math.floor(Math.min(x0, x1)));
  const top = Math.max(0, Math.floor(Math.min(y0, y1)));
  const right = Math.min(width, Math.ceil(Math.max(x0, x1)));
  const bottom = Math.min(height, Math.ceil(Math.max(y0, y1)));
  if (right - left < 2 || bottom - top < 2) return null;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

// 사각형을 사방으로 pad만큼 넓히고 이미지 안쪽으로 자릅니다.
export function expandRect(r: Rect, pad: number, width: number, height: number): Rect {
  const x = Math.max(0, r.x - pad);
  const y = Math.max(0, r.y - pad);
  return { x, y, w: Math.min(width, r.x + r.w + pad) - x, h: Math.min(height, r.y + r.h + pad) - y };
}

// 영역들을 감싸는 하나의 작업 범위(주변 참고 여백 포함). 영역이 없으면 null입니다.
export function workArea(rects: Rect[], width: number, height: number, margin = CONTEXT_MARGIN): Rect | null {
  if (rects.length === 0) return null;
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const q of rects) {
    l = Math.min(l, q.x); t = Math.min(t, q.y);
    r = Math.max(r, q.x + q.w); b = Math.max(b, q.y + q.h);
  }
  return expandRect({ x: l, y: t, w: r - l, h: b - t }, margin, width, height);
}

// 작업 범위(area) 기준 좌표로 메울 픽셀을 1로 표시한 마스크를 만듭니다. pad만큼 영역을 넓혀 워터마크 가장자리 번짐까지 덮습니다.
export function buildMask(area: Rect, rects: Rect[], pad = 0): Uint8Array {
  const m = new Uint8Array(area.w * area.h);
  for (const q of rects) {
    const x0 = Math.max(area.x, q.x - pad), y0 = Math.max(area.y, q.y - pad);
    const x1 = Math.min(area.x + area.w, q.x + q.w + pad), y1 = Math.min(area.y + area.h, q.y + q.h + pad);
    for (let y = y0; y < y1; y++) m.fill(1, (y - area.y) * area.w + (x0 - area.x), (y - area.y) * area.w + (x1 - area.x));
  }
  return m;
}

// RGBA 픽셀(data, w×h)에서 mask가 1인 곳을 주변 색으로 메웁니다. data를 직접 고칩니다.
// 1) 상하좌우 바깥 픽셀을 섞어 첫 값을 정하고(남은 곳은 테두리부터 한 겹씩 채움), 2) 라플라스 평활화로 이음매를 없앱니다.
// 메울 곳 바깥에 아는 픽셀이 하나도 없으면 아무것도 바꾸지 않고 false를 돌려줍니다.
export function inpaint(data: Uint8ClampedArray, w: number, h: number, mask: Uint8Array, smoothIters = 40): boolean {
  const n = w * h;
  const known = new Uint8Array(n);
  let unknown = 0;
  for (let i = 0; i < n; i++) {
    if (mask[i]) unknown++;
    else known[i] = 1;
  }
  if (unknown === 0) return true;
  if (unknown === n) return false;

  const nx = [-1, 1, 0, 0, -1, 1, -1, 1];
  const ny = [0, 0, -1, 1, -1, -1, 1, 1];
  const nw = [1, 1, 1, 1, Math.SQRT1_2, Math.SQRT1_2, Math.SQRT1_2, Math.SQRT1_2];

  // 상하좌우로 가장 가까운 바깥 픽셀을 거리의 역수로 섞어 첫 값을 정합니다. 사각형 영역에서 그라데이션이 곧게 이어집니다.
  const left = new Int32Array(n).fill(-1), right = new Int32Array(n).fill(-1);
  const up = new Int32Array(n).fill(-1), down = new Int32Array(n).fill(-1);
  for (let y = 0; y < h; y++) {
    let last = -1;
    for (let x = 0; x < w; x++) { const i = y * w + x; if (known[i]) last = x; else left[i] = last; }
    last = -1;
    for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (known[i]) last = x; else right[i] = last; }
  }
  for (let x = 0; x < w; x++) {
    let last = -1;
    for (let y = 0; y < h; y++) { const i = y * w + x; if (known[i]) last = y; else up[i] = last; }
    last = -1;
    for (let y = h - 1; y >= 0; y--) { const i = y * w + x; if (known[i]) last = y; else down[i] = last; }
  }
  const seeded: number[] = [];
  const seedVals: number[] = [];
  for (let i = 0; i < n; i++) {
    if (known[i]) continue;
    const x = i % w, y = (i - x) / w;
    let s = 0, r = 0, g = 0, b = 0, a = 0;
    const add = (p: number, d: number) => {
      const q = p * 4, wt = 1 / d;
      r += data[q] * wt; g += data[q + 1] * wt; b += data[q + 2] * wt; a += data[q + 3] * wt; s += wt;
    };
    if (left[i] >= 0) add(y * w + left[i], x - left[i]);
    if (right[i] >= 0) add(y * w + right[i], right[i] - x);
    if (up[i] >= 0) add(up[i] * w + x, y - up[i]);
    if (down[i] >= 0) add(down[i] * w + x, down[i] - y);
    if (s === 0) continue;
    seeded.push(i);
    seedVals.push(r / s, g / s, b / s, a / s);
  }
  seeded.forEach((i, j) => {
    data.set(seedVals.slice(j * 4, j * 4 + 4), i * 4);
    known[i] = 1;
  });

  // 어느 방향에서도 바깥 픽셀이 보이지 않는 곳(복잡한 모양의 안쪽)은 테두리부터 한 겹씩 채웁니다.
  let front: number[] = [];
  for (let i = 0; i < n; i++) if (!known[i] && touchesKnown(i)) front.push(i);

  function touchesKnown(i: number) {
    const x = i % w, y = (i - x) / w;
    for (let k = 0; k < 8; k++) {
      const xx = x + nx[k], yy = y + ny[k];
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && known[yy * w + xx]) return true;
    }
    return false;
  }

  const queued = new Uint8Array(n);
  for (const i of front) queued[i] = 1;
  while (front.length > 0) {
    // 같은 겹의 픽셀은 서로를 참고하지 않도록 값을 먼저 계산한 뒤 한꺼번에 아는 픽셀로 바꿉니다.
    const vals = new Float32Array(front.length * 4);
    front.forEach((i, j) => {
      const x = i % w, y = (i - x) / w;
      let s = 0, r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < 8; k++) {
        const xx = x + nx[k], yy = y + ny[k];
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const p = yy * w + xx;
        if (!known[p]) continue;
        const q = p * 4, wt = nw[k];
        r += data[q] * wt; g += data[q + 1] * wt; b += data[q + 2] * wt; a += data[q + 3] * wt; s += wt;
      }
      vals.set([r / s, g / s, b / s, a / s], j * 4);
    });
    const next: number[] = [];
    front.forEach((i, j) => {
      data.set(vals.subarray(j * 4, j * 4 + 4), i * 4);
      known[i] = 1;
    });
    for (const i of front) {
      const x = i % w, y = (i - x) / w;
      for (let k = 0; k < 4; k++) {
        const xx = x + nx[k], yy = y + ny[k];
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const p = yy * w + xx;
        if (!known[p] && !queued[p]) { queued[p] = 1; next.push(p); }
      }
    }
    // 대각선으로만 닿는 픽셀도 놓치지 않도록 남은 테두리를 한 번 더 찾습니다.
    if (next.length === 0) {
      for (let i = 0; i < n; i++) if (!known[i] && !queued[i] && touchesKnown(i)) { queued[i] = 1; next.push(i); }
    }
    front = next;
  }

  // 메운 픽셀만 네 이웃 평균으로 여러 번 다듬습니다. 바깥 픽셀은 고정이라 경계가 자연스럽게 이어집니다.
  const idx: number[] = [];
  for (let i = 0; i < n; i++) if (mask[i]) idx.push(i);
  const buf = new Float32Array(idx.length * 4);
  for (let it = 0; it < smoothIters; it++) {
    idx.forEach((i, j) => {
      const x = i % w, y = (i - x) / w;
      let s = 0, r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < 4; k++) {
        const xx = x + nx[k], yy = y + ny[k];
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = (yy * w + xx) * 4;
        r += data[q]; g += data[q + 1]; b += data[q + 2]; a += data[q + 3]; s++;
      }
      buf.set([r / s, g / s, b / s, a / s], j * 4);
    });
    idx.forEach((i, j) => data.set(buf.subarray(j * 4, j * 4 + 4), i * 4));
  }
  return true;
}

// 영역이 클수록 평활화를 더 많이 해야 안쪽까지 매끄러워집니다(작은 변의 길이에 비례, 상한 있음).
export const smoothItersFor = (rects: Rect[]) =>
  Math.min(120, Math.max(20, Math.round(Math.max(0, ...rects.map((r) => Math.min(r.w, r.h))) * 1.5)));

// 결과 파일 이름: 사진.jpg → 사진-워터마크제거.png
export const cleanedName = (name: string, ext: string, lang: Lang = "ko") =>
  `${name.replace(/\.[^.]+$/, "") || pick(lang, "파일", "file")}-${pick(lang, "워터마크제거", "no-watermark")}.${ext}`;

// 브라우저가 녹화할 수 있는 동영상 형식 중 첫 번째. 어디서나 열리는 H.264 MP4를 먼저 시도하고, 안 되면 WebM,
// 마지막으로 코덱을 지정하지 않은 MP4(사파리)를 씁니다. 크롬은 코덱 없는 MP4에 VP9를 넣어 아이폰에서 안 열릴 수 있습니다.
export const VIDEO_TYPES = [
  { mime: "video/mp4;codecs=avc1.42E01F,mp4a.40.2", ext: "mp4" },
  { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
  { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
  { mime: "video/webm", ext: "webm" },
  { mime: "video/mp4", ext: "mp4" },
] as const;

export function pickVideoType(isSupported: (mime: string) => boolean) {
  return VIDEO_TYPES.find((t) => isSupported(t.mime)) ?? null;
}
