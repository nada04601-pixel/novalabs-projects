import { describe, expect, it } from "vitest";
import { CHO, JONG, JUNG, MAIN_VOWELS, choseongOf, compose, parseChoseong, randomByChoseong, randomByLength } from "./hangulName";

const seeded = (seed = 1) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
// 음절을 초성·중성·종성으로 나눕니다.
const split = (s: string) => {
  const i = s.charCodeAt(0) - 0xac00;
  return [CHO[Math.floor(i / 588)], JUNG[Math.floor((i % 588) / 28)], JONG[i % 28]];
};

describe("이름 랜덤 생성기", () => {
  it("음절 조합과 초성 추출", () => {
    expect(compose(0, 0)).toBe("가");
    expect(compose(18, 20, 27)).toBe("힣");
    expect(choseongOf("고")).toBe("ㄱ");
    expect(choseongOf("ㅉ")).toBe("ㅉ");
    expect(choseongOf("ㅏ")).toBeNull();
    expect(parseChoseong("ㄱ자 다a")).toEqual(["ㄱ", "ㅈ", "ㄷ"]);
    expect(parseChoseong("가".repeat(20))).toHaveLength(10);
  });
  it("길이를 지키고 길이는 1~10으로 맞춘다", () => {
    const opts = { mainConsonants: false, mainVowels: false, noFinal: false };
    expect([...randomByLength(3, opts, seeded(1))]).toHaveLength(3);
    expect([...randomByLength(0, opts, seeded(2))]).toHaveLength(1);
    expect([...randomByLength(99, opts, seeded(3))]).toHaveLength(10);
  });
  it("주요 자음·모음만, 받침 없이", () => {
    const s = randomByLength(10, { mainConsonants: true, mainVowels: true, noFinal: true }, seeded(5));
    for (const ch of s) {
      const [c, v, f] = split(ch);
      expect("ㄲㄸㅃㅆㅉ".includes(c)).toBe(false);
      expect(MAIN_VOWELS).toContain(v);
      expect(f).toBe("");
    }
  });
  it("받침을 허용하면 주요 자음 받침만 나온다", () => {
    const r = seeded(11);
    const finals = new Set<string>();
    for (let i = 0; i < 50; i++) for (const ch of randomByLength(10, { mainConsonants: true, mainVowels: false, noFinal: false }, r)) finals.add(split(ch)[2]);
    expect(finals.has("")).toBe(true);
    expect([...finals].every((f) => f === "" || "ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ".includes(f))).toBe(true);
  });
  it("고른 초성 순서를 따른다", () => {
    const s = randomByChoseong(["ㄱ", "ㅈ", "ㄷ"], { mainConsonants: true, mainVowels: true, noFinal: true }, seeded(7));
    expect([...s].map((ch) => split(ch)[0])).toEqual(["ㄱ", "ㅈ", "ㄷ"]);
    expect(randomByChoseong([], { mainConsonants: true, mainVowels: true, noFinal: true })).toBe("");
  });
});
