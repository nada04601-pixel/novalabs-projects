// 이미지 용량 줄이기·형식 변환에 쓰는 계산: 결과 크기, 목표 용량에 맞는 화질 찾기, 파일 이름
import { pick, type Lang } from "../i18n";

export const CONVERT_MAX_BYTES = 50 * 1024 * 1024;
export const CONVERT_MAX_FILES = 100;
// iOS Safari 캔버스 한도(약 1,670만 화소). 이보다 큰 사진은 비율을 지켜 줄입니다.
export const CONVERT_MAX_PIXELS = 16_777_216;

export const OUTPUT_FORMATS = {
  jpg: { mime: "image/jpeg", label: "JPG", lossy: true },
  webp: { mime: "image/webp", label: "WebP", lossy: true },
  png: { mime: "image/png", label: "PNG", lossy: false },
} as const;
export type OutputFormat = keyof typeof OUTPUT_FORMATS;

export type ResizeMode = "none" | "percent" | "long";
export type Resize = { mode: ResizeMode; value: number };

// 결과 크기(px). 원본보다 키우지 않고, 캔버스 한도를 넘으면 비율을 지켜 줄입니다.
export function outputSize(w: number, h: number, resize: Resize, maxPixels = CONVERT_MAX_PIXELS) {
  let s = 1;
  if (resize.mode === "percent" && resize.value > 0) s = resize.value / 100;
  if (resize.mode === "long" && resize.value > 0) s = resize.value / Math.max(w, h);
  s = Math.min(1, s, Math.sqrt(maxPixels / (w * h)));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

// 목표 용량 이하가 되는 가장 높은 화질(0.05~0.95)을 이분 탐색으로 찾습니다.
// 가장 낮은 화질로도 넘으면 그 화질과 fits: false를 돌려줍니다. encode는 화질을 받아 용량(바이트)을 돌려줍니다.
export async function findQuality(
  encode: (q: number) => Promise<number>, target: number, min = 0.05, max = 0.95, steps = 7,
): Promise<{ quality: number; size: number; fits: boolean }> {
  const top = await encode(max);
  if (top <= target) return { quality: max, size: top, fits: true };
  const bottom = await encode(min);
  if (bottom > target) return { quality: min, size: bottom, fits: false };
  let lo = min, loSize = bottom, hi = max;
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    const size = await encode(mid);
    if (size <= target) { lo = mid; loSize = size; } else hi = mid;
  }
  return { quality: lo, size: loSize, fits: true };
}

// "200KB", "1.5MB", "300" (KB로 봄) → 바이트. 읽을 수 없으면 null.
export function parseTargetSize(text: string): number | null {
  const m = text.trim().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*(kb|k|mb|m)?$/i);
  if (!m) return null;
  const v = Number(m[1]) * (/^m/i.test(m[2] ?? "") ? 1024 * 1024 : 1024);
  return v >= 1024 ? Math.round(v) : null;
}

const stripExt = (name: string, lang: Lang = "ko") => name.replace(/\.[^./\\]+$/, "") || pick(lang, "이미지", "image");

// 사진.png → 사진.jpg. 형식이 같으면 원본과 헷갈리지 않게 사진-압축.jpg로 만듭니다.
export function convertedName(name: string, format: OutputFormat, lang: Lang = "ko") {
  const base = stripExt(name, lang);
  const ext = name.match(/\.([^./\\]+)$/)?.[1].toLowerCase();
  const same = ext === format || (format === "jpg" && ext === "jpeg");
  return `${base}${same ? pick(lang, "-압축", "-compressed") : ""}.${format}`;
}

export const convertZipName = (lang: Lang = "ko") => pick(lang, "변환한-이미지.zip", "converted-images.zip");

// HEIC·HEIF(아이폰 사진) 파일인지 확인합니다. ftyp 상자의 브랜드로 판별합니다.
export function isHeic(b: Uint8Array): boolean {
  if (b.length < 12 || b[4] !== 0x66 || b[5] !== 0x74 || b[6] !== 0x79 || b[7] !== 0x70) return false;
  const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
  return ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"].includes(brand);
}
