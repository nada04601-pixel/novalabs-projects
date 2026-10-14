// 동영상 자르기·용량 줄이기에 쓰는 계산: 시간 입력, 화질 프리셋, 비트레이트와 예상 용량, 파일 이름
import { pick, type Lang } from "../i18n";

// 파일 크기 한도. 결과 파일을 메모리에 모아 내려받으므로 너무 큰 파일은 휴대폰에서 멈출 수 있습니다.
export const VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;

// "83.5", "1:23.5", "1:02:03" 형식을 초로 바꿉니다. 형식이 틀리면 null입니다.
export function parseTime(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) return null;
  const parts = t.split(":").map(Number);
  // 콜론이 있으면 분·초 자리는 60 미만이어야 합니다(맨 앞 자리는 제한 없음).
  if (parts.slice(1).some((n) => n >= 60)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

// 초를 "1:23.4"(한 시간이 넘으면 "1:02:03.4")로 표시합니다. 소수 첫째 자리까지 내림합니다.
export function formatTime(seconds: number): string {
  const tenths = Math.floor(Math.max(0, seconds) * 10 + 1e-6);
  const s = (tenths % 600) / 10;
  const m = Math.floor(tenths / 600) % 60;
  const h = Math.floor(tenths / 36000);
  const ss = s.toFixed(1).padStart(4, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export const MIN_CLIP = 0.1;

// 자를 구간이 올바른지 확인합니다. 문제가 있으면 안내 문구, 없으면 null입니다.
export function trimError(start: number | null, end: number | null, duration: number, lang: Lang = "ko"): string | null {
  const t = (ko: string, en: string) => pick(lang, ko, en);
  if (start === null) return t("시작 시간을 1:23.5처럼 입력해 주세요.", "Enter the start time like 1:23.5.");
  if (end === null) return t("끝 시간을 1:23.5처럼 입력해 주세요.", "Enter the end time like 1:23.5.");
  if (start >= duration) return t(`시작 시간은 영상 길이(${formatTime(duration)})보다 앞이어야 합니다.`, `The start time must be before the end of the video (${formatTime(duration)}).`);
  if (end > duration + 0.05) return t(`끝 시간은 영상 길이(${formatTime(duration)})를 넘을 수 없습니다.`, `The end time can't be past the end of the video (${formatTime(duration)}).`);
  if (end - start < MIN_CLIP) return t("끝 시간이 시작 시간보다 뒤여야 합니다.", "The end time must be after the start time.");
  return null;
}

export const COMPRESS_PRESETS = {
  strong: { label: "많이 줄이기", labelEn: "Smallest", desc: "480p", maxShort: 480, bpp: 0.07, audio: 64_000 },
  medium: { label: "권장", labelEn: "Recommended", desc: "720p", maxShort: 720, bpp: 0.08, audio: 96_000 },
  light: { label: "화질 우선", labelEn: "Best quality", desc: "1080p", maxShort: 1080, bpp: 0.09, audio: 128_000 },
} as const;
export type CompressPreset = keyof typeof COMPRESS_PRESETS;

// 짧은 변이 maxShort를 넘지 않게 비율을 유지해 줄인 크기. 인코더가 요구하는 대로 짝수로 맞춥니다. 키우지는 않습니다.
export function fitShortSide(w: number, h: number, maxShort: number) {
  const s = Math.min(1, maxShort / Math.min(w, h));
  const even = (v: number) => Math.max(2, Math.round((v * s) / 2) * 2);
  return { w: even(w), h: even(h) };
}

// 목표 영상 비트레이트(bps). 화면 크기와 프레임 수에 비례하고, 원본보다 크면 오히려 용량이 늘어나므로 원본의 70%를 넘지 않게 합니다.
export function videoBitrate(w: number, h: number, fps: number, bpp: number, sourceBitrate?: number | null) {
  const f = Math.min(60, Math.max(15, fps || 30));
  const target = Math.round(w * h * f * bpp);
  const capped = sourceBitrate && sourceBitrate > 0 ? Math.min(target, sourceBitrate * 0.7) : target;
  return Math.max(150_000, Math.round(capped));
}

// 예상 결과 크기(바이트). 컨테이너 부가 정보로 2% 정도 더 붙습니다.
export const estimateBytes = (videoBps: number, audioBps: number, seconds: number) =>
  Math.round(((videoBps + audioBps) * seconds) / 8 * 1.02);

// 결과 파일 이름: 여행.mov + "자름" + mp4 → 여행-자름.mp4
export const editedName = (name: string, suffix: string, ext: string, lang: Lang = "ko") =>
  `${name.replace(/\.[^.]+$/, "") || pick(lang, "동영상", "video")}-${suffix}.${ext}`;

// GIF 만들기: 프레임 수와 크기가 커지면 파일이 수십 MB가 되고 휴대폰 메모리가 모자라므로 길이를 제한합니다.
export const GIF_MAX_SECONDS = 20;
export const GIF_FPS = [8, 12, 15] as const;
export const GIF_WIDTHS = [320, 480, 640] as const;

// 원본보다 크게 만들지 않고, 높이는 비율에 맞춰 짝수로 정합니다.
export function gifSize(w: number, h: number, width: number) {
  const outW = Math.min(width, w);
  return { w: outW, h: Math.max(2, Math.round((h * outW) / w / 2) * 2) };
}

// start~end 구간에서 fps 간격으로 뽑을 프레임 시각(초). 끝 시각은 포함하지 않습니다.
export function frameTimes(start: number, end: number, fps: number): number[] {
  const n = Math.max(1, Math.floor((end - start) * fps + 1e-6));
  return Array.from({ length: n }, (_, i) => start + i / fps);
}

// GIF 한 프레임은 압축 후 대략 픽셀 수의 0.3~0.6바이트입니다. 넉넉히 0.5로 어림합니다.
export const estimateGifBytes = (w: number, h: number, frames: number) => Math.round(w * h * frames * 0.5);

// GIF 프레임 간격은 1/100초 단위라 반올림합니다(12fps → 80ms).
export const gifDelay = (fps: number) => Math.round(100 / fps) * 10;

export const MP3_BITRATES = [128, 192, 320] as const;
