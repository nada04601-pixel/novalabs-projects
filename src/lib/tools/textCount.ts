// 글자수 세기. 이모지·결합 문자는 화면에 보이는 한 글자를 1자로 셉니다.

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("ko", { granularity: "grapheme" }) : null;

export const graphemes = (s: string): string[] => (segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : [...s]);

// 줄바꿈은 Windows(\r\n)도 한 번으로 봅니다.
const normalize = (s: string) => s.replace(/\r\n?/g, "\n");

// 나이스(NEIS) 학교생활기록부 기준: 한글 등 1바이트가 아닌 글자 3바이트, 영문·숫자·공백 1바이트, 줄바꿈 2바이트
export function neisBytes(s: string): number {
  let n = 0;
  for (const ch of normalize(s)) n += ch === "\n" ? 2 : ch.charCodeAt(0) < 128 ? 1 : 3;
  return n;
}

// 예전 완성형(EUC-KR) 방식: 영문·숫자·공백 1바이트, 그 밖의 글자 2바이트, 줄바꿈 2바이트
export function legacyBytes(s: string): number {
  let n = 0;
  for (const ch of normalize(s)) n += ch === "\n" ? 2 : ch.charCodeAt(0) < 128 ? 1 : 2;
  return n;
}

export const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

export type TextStats = {
  chars: number; // 공백 포함
  charsNoSpace: number; // 공백·줄바꿈 제외
  words: number;
  lines: number;
  paragraphs: number;
  hangul: number;
  utf8: number;
  neis: number;
  legacy: number;
};

export function textStats(raw: string): TextStats {
  const s = normalize(raw);
  const g = graphemes(s);
  return {
    chars: g.filter((c) => c !== "\n").length,
    charsNoSpace: g.filter((c) => !/^\s+$/.test(c)).length,
    words: s.trim() ? s.trim().split(/\s+/).length : 0,
    lines: s ? s.split("\n").length : 0,
    paragraphs: s.split(/\n\s*\n/).filter((p) => p.trim()).length,
    hangul: (s.match(/[가-힣]/g) ?? []).length,
    utf8: utf8Bytes(s),
    neis: neisBytes(s),
    legacy: legacyBytes(s),
  };
}

// 원고지(200자) 매수 추정: 공백 포함 글자 수 기준, 줄바꿈 때 남는 칸은 빼지 않은 단순 추정
export const manuscriptPages = (chars: number) => (chars ? Math.ceil(chars / 200) : 0);

// 읽기 시간 추정(분): 한국어 기준 분당 약 500자
export const readingMinutes = (charsNoSpace: number) => charsNoSpace / 500;
