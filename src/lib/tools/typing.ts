// 타자 속도 계산. 한글은 자판을 누른 횟수(타수) 기준으로 셉니다.

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
// 중성 순서: ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ → 두 번 눌러야 하는 겹모음
const DOUBLE_VOWELS = new Set([9, 10, 11, 14, 15, 16, 19]); // ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ
// 종성 순서(0은 받침 없음): ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ → 겹받침
const DOUBLE_FINALS = new Set([3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18]); // ㄳ ㄵ ㄶ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅄ

// 한 글자를 치는 데 필요한 타수. ㄲ·ㅒ처럼 Shift와 함께 누르는 글자는 1타로 셉니다.
export function strokes(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (code < HANGUL_START || code > HANGUL_END) return 1;
  const idx = code - HANGUL_START;
  const jung = Math.floor((idx % 588) / 28);
  const jong = idx % 28;
  return 1 + (DOUBLE_VOWELS.has(jung) ? 2 : 1) + (jong === 0 ? 0 : DOUBLE_FINALS.has(jong) ? 2 : 1);
}

export const countStrokes = (text: string) => [...text].reduce((s, c) => s + strokes(c), 0);

export type TypingResult = {
  correctChars: number;
  totalChars: number;
  accuracy: number; // 0~1
  cpm: number; // 분당 타수(정확히 친 글자 기준)
  wpm: number; // 영문 기준 분당 단어 수(5글자 = 1단어)
};

export function scoreTyping(target: string, typed: string, ms: number): TypingResult {
  const t = [...target];
  const u = [...typed];
  let correctChars = 0;
  let correctStrokes = 0;
  u.forEach((c, i) => {
    if (c === t[i]) {
      correctChars++;
      correctStrokes += strokes(c);
    }
  });
  const minutes = ms / 60000;
  const totalChars = Math.max(t.length, u.length);
  return {
    correctChars,
    totalChars,
    accuracy: totalChars ? correctChars / totalChars : 0,
    cpm: minutes > 0 ? Math.round(correctStrokes / minutes) : 0,
    wpm: minutes > 0 ? Math.round(correctChars / 5 / minutes) : 0,
  };
}

// 각 글자를 맞음·틀림·아직 안 침으로 나눕니다(입력 중인 마지막 글자는 'current').
export function markChars(target: string, typed: string): { ch: string; state: "ok" | "bad" | "current" | "todo" }[] {
  const u = [...typed];
  return [...target].map((ch, i) => ({
    ch,
    state: i < u.length - 1 || (i === u.length - 1 && u[i] === ch) ? (u[i] === ch ? "ok" : "bad") : i === u.length - 1 ? "current" : "todo",
  }));
}

export const KO_SENTENCES = [
  "천 리 길도 한 걸음부터 시작한다는 말처럼 작은 습관이 큰 변화를 만듭니다.",
  "오늘 할 일을 내일로 미루지 않으면 저녁 시간이 훨씬 가벼워집니다.",
  "가는 말이 고와야 오는 말이 곱다는 속담은 지금도 여전히 맞는 말입니다.",
  "아침에 물 한 잔을 마시고 가볍게 스트레칭을 하면 하루가 상쾌하게 시작됩니다.",
  "계획은 꼼꼼하게 세우되 실행할 때는 너무 완벽하려고 애쓰지 않는 것이 좋습니다.",
  "티끌 모아 태산이라는 말처럼 매달 조금씩 모은 돈이 든든한 목돈이 됩니다.",
  "빠르게 치는 것보다 정확하게 치는 연습을 먼저 해야 속도도 자연스럽게 붙습니다.",
  "비가 그친 뒤 맑게 갠 하늘을 보면 마음까지 깨끗해지는 느낌이 듭니다.",
  "좋은 질문 하나가 긴 회의보다 문제를 더 빨리 풀어 주기도 합니다.",
  "낮말은 새가 듣고 밤말은 쥐가 들으니 언제나 말을 조심해야 합니다.",
  "책을 읽고 나서 기억에 남는 문장을 한 줄씩 적어 두면 오래 기억할 수 있습니다.",
  "주말에는 휴대폰을 잠시 내려놓고 산책을 하며 머리를 식혀 보세요.",
];

export const EN_SENTENCES = [
  "The quick brown fox jumps over the lazy dog near the quiet river bank.",
  "Practice makes progress, so keep your eyes on the screen and your hands relaxed.",
  "A small step every day adds up to a long journey by the end of the year.",
  "Typing accurately first will help you build real speed over time.",
  "Pack my box with five dozen liquor jugs before the morning train leaves.",
  "Good habits are easier to keep when you start with something very small.",
  "Sphinx of black quartz, judge my vow and keep the record honest.",
  "Clear notes today save hours of confusion when the deadline comes.",
];
