// 이름 랜덤 생성기. 초성·중성·종성을 무작위로 골라 한글 음절을 조합합니다.
import { cryptoRandom, randomInt, type RandomSource } from "./password";

export const CHO = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
export const JUNG = [..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"];
// 받침 없음("")을 포함한 종성 28개
export const JONG = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

// 쌍자음을 뺀 기본 자음 14개와 기본 모음 10개
export const MAIN_CONSONANTS = [..."ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ"];
export const MAIN_VOWELS = [..."ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ"];

export const MAX_LENGTH = 10;

export type NameOptions = {
  mainConsonants: boolean; // 초성·종성에 기본 자음만 사용
  mainVowels: boolean; // 중성에 기본 모음만 사용
  noFinal: boolean; // 받침 없이
};

export function compose(cho: number, jung: number, jong = 0): string {
  return String.fromCharCode(0xac00 + (cho * 21 + jung) * 28 + jong);
}

// 음절이면 초성을, 자음 낱자(ㄱ, ㄲ…)면 그대로 돌려줍니다. 초성이 될 수 없는 글자는 null.
export function choseongOf(ch: string): string | null {
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return CHO[Math.floor((code - 0xac00) / 588)];
  return CHO.includes(ch) ? ch : null;
}

// 입력한 글에서 초성만 뽑습니다. "ㄱㅈ다" → ["ㄱ", "ㅈ", "ㄷ"]
export function parseChoseong(text: string): string[] {
  return [...text].map(choseongOf).filter((c): c is string => c !== null).slice(0, MAX_LENGTH);
}

function pickFrom<T>(list: readonly T[], rand: RandomSource): T {
  return list[randomInt(list.length, rand)];
}

export function randomSyllable(opts: NameOptions, cho?: string, rand: RandomSource = cryptoRandom): string {
  const c = cho ?? pickFrom(opts.mainConsonants ? MAIN_CONSONANTS : CHO, rand);
  const v = pickFrom(opts.mainVowels ? MAIN_VOWELS : JUNG, rand);
  const finals = opts.noFinal ? [""] : opts.mainConsonants ? ["", ...MAIN_CONSONANTS] : JONG;
  const f = pickFrom(finals, rand);
  return compose(CHO.indexOf(c), JUNG.indexOf(v), JONG.indexOf(f));
}

// 길이만큼 무작위 음절을 만듭니다.
export function randomByLength(length: number, opts: NameOptions, rand: RandomSource = cryptoRandom): string {
  const n = Math.min(Math.max(Math.floor(length), 1), MAX_LENGTH);
  return Array.from({ length: n }, () => randomSyllable(opts, undefined, rand)).join("");
}

// 고른 초성 순서대로 음절을 만듭니다. ["ㄱ", "ㅈ", "ㄷ"] → "고자다" 같은 결과
export function randomByChoseong(chos: string[], opts: NameOptions, rand: RandomSource = cryptoRandom): string {
  return chos.map((c) => randomSyllable(opts, c, rand)).join("");
}

// 흔한 한 글자 성씨 30개와 두 글자 성씨
export const SURNAMES = [
  "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
  "한", "오", "서", "신", "권", "황", "안", "송", "전", "홍",
  "유", "고", "문", "양", "손", "배", "백", "허", "남", "심",
  "남궁", "황보", "제갈", "선우", "독고",
];

// surname이 "random"이면 목록에서 무작위로, 빈 문자열이면 성씨 없이 붙입니다.
export function withSurname(name: string, surname: string, rand: RandomSource = cryptoRandom): string {
  if (!surname || !name) return name;
  return (surname === "random" ? pickFrom(SURNAMES, rand) : surname) + name;
}
