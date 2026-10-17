// 동영상에서 꺼낸 자막을 SRT·VTT·ASS·TXT 파일 내용으로 바꾸는 부분(순수 함수). 컨테이너 해석은 subtitleExtract.ts.
import { pick, type Lang } from "../i18n";

export type SubtitleCue = {
  start: number; // 초
  end: number; // 초. 컨테이너에 길이가 없으면 NaN으로 두었다가 finishCues가 채웁니다.
  text: string; // 원래 형식의 글(SRT·VTT 태그, ASS 꾸밈 코드가 들어 있을 수 있음)
  // ASS·SSA 자막의 Dialogue 줄에서 시간과 글을 뺀 나머지(Layer, Style, Name, 여백, Effect)와 원래 순서
  ass?: { fields: string[]; order: number };
};

export type SubtitleSource = "srt" | "ass" | "vtt" | "tx3g";

export type SubtitleTrack = {
  number: number; // 파일 안의 트랙 번호
  codec: string; // 컨테이너에 적힌 코덱 이름(S_TEXT/UTF8, tx3g 등)
  source: SubtitleSource | null; // 글자로 꺼낼 수 없는 그림 자막 등은 null
  language: string; // ISO 639 코드. 모르면 "und"
  name: string;
  isDefault: boolean;
  forced: boolean;
  cues: SubtitleCue[];
  assHeader?: string; // ASS·SSA의 [Script Info]·[V4+ Styles] 부분
};

// 글 자막이 없을 때 안내할 그림 자막 코덱
export const IMAGE_CODECS: Record<string, string> = {
  "S_HDMV/PGS": "PGS",
  S_VOBSUB: "VobSub",
  S_DVBSUB: "DVB",
};

// 컨테이너가 길이를 주지 않은 자막은 다음 자막 시작까지, 최대 5초 동안 보이게 합니다.
const FALLBACK_SECONDS = 5;

export function finishCues(cues: SubtitleCue[], defaultDuration?: number): SubtitleCue[] {
  const sorted = cues
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.start - b.c.start || a.i - b.i)
    .map(({ c }) => c);
  return sorted.map((c, i) => {
    if (Number.isFinite(c.end) && c.end > c.start) return c;
    const next = sorted.slice(i + 1).find((n) => n.start > c.start)?.start ?? Infinity;
    return { ...c, end: c.start + Math.min(defaultDuration || FALLBACK_SECONDS, next - c.start) };
  });
}

function clock(seconds: number, sep: "," | ".", hourDigits: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const p = (v: number, n = 2) => String(v).padStart(n, "0");
  return `${p(h, hourDigits)}:${p(m)}:${p(s)}${sep}${p(ms % 1000, 3)}`;
}

export const srtTime = (s: number) => clock(s, ",", 2);
export const vttTime = (s: number) => clock(s, ".", 2);
// ASS는 1/100초 단위, 시는 한 자리입니다(0:01:02.35).
export function assTime(seconds: number) {
  const cs = Math.max(0, Math.round(seconds * 100));
  const p = (v: number) => String(v).padStart(2, "0");
  return `${Math.floor(cs / 360_000)}:${p(Math.floor(cs / 6000) % 60)}:${p(Math.floor(cs / 100) % 60)}.${p(cs % 100)}`;
}

// ASS 꾸밈 코드({\i1} 등)를 지우고 줄바꿈 기호를 실제 줄바꿈으로 바꿉니다. 기울임·굵게는 HTML 태그로 옮깁니다.
export function assToText(text: string): string {
  return text
    .replace(/\{([^}]*)\}/g, (_, codes: string) =>
      [...codes.matchAll(/\\([ibu])([01])(?![0-9])/g)].map(([, tag, on]) => (on === "1" ? `<${tag}>` : `</${tag}>`)).join(""),
    )
    .replace(/\\N|\\n/g, "\n")
    .replace(/\\h/g, " ");
}

// 형식에 맞지 않는 태그를 지웁니다. keep에 있는 태그(i·b·u 등)만 남깁니다.
function keepTags(text: string, keep: RegExp) {
  return text.replace(/<\/?([a-zA-Z][\w.-]*)?[^<>]*>/g, (tag, name: string | undefined) => (name && keep.test(name) ? tag : ""));
}

const unescapeVtt = (text: string) =>
  text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&lrm;|&rlm;/g, "").replace(/&amp;/g, "&");

// 트랙 형식과 상관없이, 각 자막을 HTML 태그가 섞인 "SRT식 글"로 맞춥니다.
function plain(cue: SubtitleCue, source: SubtitleSource | null) {
  let t = cue.text.replace(/\r\n?/g, "\n");
  if (source === "ass") t = assToText(t);
  if (source === "vtt") t = unescapeVtt(keepTags(t, /^(i|b|u)$/i));
  // 빈 줄이 있으면 SRT·VTT에서 자막 하나가 끝난 것으로 읽히므로 줄을 붙입니다.
  return t.replace(/\n{2,}/g, "\n").trim();
}

const visible = (track: SubtitleTrack) =>
  track.cues.map((c) => ({ ...c, text: plain(c, track.source) })).filter((c) => c.text && c.end > c.start);

export function toSrt(track: SubtitleTrack): string {
  return visible(track)
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${keepTags(c.text, /^(i|b|u|font)$/i)}\n`)
    .join("\n");
}

export function toVtt(track: SubtitleTrack): string {
  const cues = visible(track).map((c) => {
    const text = keepTags(c.text, /^(i|b|u)$/i)
      .replace(/&(?![a-zA-Z]+;|#\d+;)/g, "&amp;")
      .replace(/-->/g, "--&gt;");
    return `${vttTime(c.start)} --> ${vttTime(c.end)}\n${text}\n`;
  });
  return ["WEBVTT\n", ...cues].join("\n");
}

// 태그를 모두 뺀 글만. 같은 줄이 이어지면 한 번만 적습니다.
export function toTxt(track: SubtitleTrack): string {
  const lines: string[] = [];
  for (const c of visible(track)) {
    const text = keepTags(c.text, /^$/).replace(/\s*\n\s*/g, " ").trim();
    if (text && text !== lines[lines.length - 1]) lines.push(text);
  }
  return lines.join("\n") + "\n";
}

const ASS_EVENTS = "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text";

// ASS·SSA 자막은 글꼴·위치 같은 꾸밈을 그대로 살려 원래 형식으로도 저장합니다.
export function toAss(track: SubtitleTrack): string {
  const header = (track.assHeader ?? "").replace(/\r\n?/g, "\n").trim();
  const head = /^\[Events\]/m.test(header) ? header : `${header}\n\n${ASS_EVENTS}`;
  const events = track.cues
    .filter((c) => c.ass)
    .sort((a, b) => a.ass!.order - b.ass!.order)
    .map((c) => `Dialogue: ${c.ass!.fields[0]},${assTime(c.start)},${assTime(c.end)},${c.ass!.fields.slice(1).join(",")},${c.text}`);
  return `${head}\n${events.join("\n")}\n`;
}

export type SubtitleFormat = "srt" | "vtt" | "ass" | "txt";

export function formatsFor(track: SubtitleTrack): SubtitleFormat[] {
  return track.source === "ass" ? ["srt", "vtt", "ass", "txt"] : ["srt", "vtt", "txt"];
}

export function render(track: SubtitleTrack, format: SubtitleFormat): string {
  if (format === "srt") return toSrt(track);
  if (format === "vtt") return toVtt(track);
  if (format === "ass") return toAss(track);
  return toTxt(track);
}

// 미리보기·개수 표시에 쓰는, 화면에 보이는 자막 수
export const cueCount = (track: SubtitleTrack) => visible(track).length;
export const previewLines = (track: SubtitleTrack, n = 3) =>
  visible(track).slice(0, n).map((c) => ({ start: c.start, text: keepTags(c.text, /^$/) }));

const knownLanguage = (code: string) => !!code && code !== "und";

// 언어 이름(한국어, English…). 모르는 코드는 그대로 보여 줍니다.
export function languageName(code: string, lang: Lang = "ko"): string {
  if (!knownLanguage(code)) return pick(lang, "언어 정보 없음", "Unknown language");
  try {
    const name = new Intl.DisplayNames([lang], { type: "language" }).of(code);
    return name && name !== "root" ? name : code;
  } catch {
    return code;
  }
}

// 결과 파일 이름. 동영상과 이름이 같고 언어 코드가 붙어 있으면(영화.kor.srt) 대부분의 재생기가 자막을 자동으로 불러옵니다.
// 같은 언어 트랙이 여럿이면 트랙 번호를 붙여 구분합니다.
export function subtitleName(videoName: string, track: SubtitleTrack, all: SubtitleTrack[], format: SubtitleFormat, lang: Lang = "ko"): string {
  const base = videoName.replace(/\.[^.]+$/, "") || pick(lang, "동영상", "video");
  const same = all.filter((t) => t.language === track.language).length > 1;
  const parts = [knownLanguage(track.language) ? track.language.replace(/[^\w-]/g, "") : "", same ? String(track.number) : ""].filter(Boolean);
  return `${[base, ...parts].join(".")}.${format}`;
}
