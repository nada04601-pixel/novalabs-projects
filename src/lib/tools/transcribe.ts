// 음성 인식(Whisper)으로 자막을 만들 때 쓰는 순수 계산: 소리를 30초 안쪽 조각으로 나누기, 인식 결과를 자막으로 다듬기.
// 모델 실행은 whisper.worker.ts, 소리 꺼내기는 audioDecode.ts.
import type { SubtitleCue } from "./subtitles";

export const SAMPLE_RATE = 16_000; // Whisper가 받는 소리 형식(16kHz 모노)

export const WHISPER_MODELS = {
  base: { id: "onnx-community/whisper-base", label: "빠르게", labelEn: "Faster", size: "약 100MB", sizeEn: "~100 MB" },
  small: { id: "onnx-community/whisper-small", label: "정확하게", labelEn: "More accurate", size: "약 350MB", sizeEn: "~350 MB" },
} as const;
export type WhisperModel = keyof typeof WHISPER_MODELS;

// Whisper가 알아듣는 언어 이름. "auto"는 조각마다 언어를 알아서 판단합니다.
export const SPEECH_LANGUAGES = [
  { v: "korean", code: "ko", label: "한국어", en: "Korean" },
  { v: "english", code: "en", label: "영어", en: "English" },
  { v: "japanese", code: "ja", label: "일본어", en: "Japanese" },
  { v: "chinese", code: "zh", label: "중국어", en: "Chinese" },
  { v: "auto", code: "und", label: "자동 감지", en: "Auto-detect" },
] as const;
export type SpeechLanguage = (typeof SPEECH_LANGUAGES)[number]["v"];

// 소리 길이 한도. 1시간이면 16kHz 소리만 230MB쯤이고, 휴대폰에서는 인식에 몇 시간이 걸립니다.
export const SPEECH_MAX_SECONDS = 60 * 60;

const WINDOW = 30; // Whisper가 한 번에 듣는 길이(초)
const SEARCH = 5; // 조각 끝 몇 초 안에서 가장 조용한 곳을 찾아 자릅니다.
const STEP = 0.1; // 조용함을 재는 단위(초)

// 말이 끊긴 곳에서 자르도록, 30초 조각 끝부분에서 소리가 가장 작은 0.1초 구간의 가운데를 자르는 위치로 고릅니다.
export function planChunks(samples: Float32Array, rate = SAMPLE_RATE): [number, number][] {
  const out: [number, number][] = [];
  const win = WINDOW * rate;
  const step = Math.round(STEP * rate);
  let start = 0;
  while (start < samples.length) {
    if (samples.length - start <= win) {
      out.push([start, samples.length]);
      break;
    }
    let best = start + win;
    let bestEnergy = Infinity;
    for (let s = start + win - SEARCH * rate; s + step <= start + win; s += step) {
      let e = 0;
      for (let i = s; i < s + step; i++) e += samples[i] * samples[i];
      if (e < bestEnergy) {
        bestEnergy = e;
        best = s + (step >> 1);
      }
    }
    out.push([start, best]);
    start = best;
  }
  return out;
}

export type SpeechChunk = { timestamp: [number, number | null]; text: string };

// 조각 하나의 인식 결과를 전체 시간에 맞춘 자막으로 바꿉니다. 끝 시간이 없으면 다음 말 시작이나 조각 끝까지로 둡니다.
export function chunkCues(chunks: SpeechChunk[], offset: number, chunkEnd: number): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  chunks.forEach((c, i) => {
    const text = c.text.replace(/\s+/g, " ").trim();
    if (!text || /^[\s.,!?…·\-♪]*$/.test(text)) return;
    const start = offset + Math.max(0, c.timestamp[0] ?? 0);
    const nextStart = chunks[i + 1]?.timestamp[0];
    const rawEnd = c.timestamp[1] ?? nextStart ?? chunkEnd - offset;
    const end = Math.min(chunkEnd, offset + rawEnd);
    if (end > start) cues.push({ start, end, text });
  });
  return cues;
}

const MAX_CHARS = 42; // 한 화면에 읽기 좋은 자막 길이(대략 두 줄)

// 긴 문장은 문장 부호나 띄어쓰기에서 나누고, 글자 수에 비례해 시간을 나눠 줍니다.
export function splitLongCue(cue: SubtitleCue, max = MAX_CHARS): SubtitleCue[] {
  if (cue.text.length <= max) return [cue];
  const pieces: string[] = [];
  let rest = cue.text;
  while (rest.length > max) {
    const head = rest.slice(0, max + 1);
    // 문장 끝 → 띄어쓰기 → 글자 수 순서로 자를 곳을 찾되, 너무 앞쪽(1/3 이전)이면 다음 방법으로 넘어갑니다.
    let at = ([...head.matchAll(/[.?!。？！](?=\s|$)/g)].pop()?.index ?? -1) + 1;
    if (at < max / 3) at = head.lastIndexOf(" ");
    if (at < max / 3) at = max;
    pieces.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) pieces.push(rest);
  const total = pieces.reduce((n, p) => n + p.length, 0);
  let t = cue.start;
  return pieces.map((text, i) => {
    const end = i === pieces.length - 1 ? cue.end : t + ((cue.end - cue.start) * text.length) / total;
    const c = { start: t, end, text };
    t = end;
    return c;
  });
}

// 조용한 구간에서 Whisper가 같은 말을 되풀이하는 일이 있어, 바로 앞과 같은 문장은 하나로 합칩니다.
export function mergeRepeats(cues: SubtitleCue[]): SubtitleCue[] {
  const out: SubtitleCue[] = [];
  for (const c of cues) {
    const last = out[out.length - 1];
    if (last && last.text === c.text && c.start - last.end < 1) last.end = Math.max(last.end, c.end);
    else out.push({ ...c });
  }
  return out;
}
