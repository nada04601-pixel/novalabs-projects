import { describe, expect, it } from "vitest";
import { TYPE_TEXT, TYPE_TEXT_EN, TYPES } from "../../data/mbtiText";
import { AXES, QUESTIONS, calcMbti, decodeMbtiLink, encodeMbtiLink, type Answer } from "./mbti";

// 각 문항에 pole이 원하는 글자 쪽이면 "매우 그렇다", 아니면 "전혀 아니다"
const answerFor = (type: string): Answer[] => QUESTIONS.map((q) => (type.includes(q.pole) ? 2 : -2));

describe("MBTI 문항", () => {
  it("지표마다 8문항, 양쪽 문장이 4개씩", () => {
    for (const axis of AXES) {
      const qs = QUESTIONS.filter((q) => q.axis === axis);
      expect(qs).toHaveLength(8);
      expect(qs.filter((q) => q.pole === axis[0])).toHaveLength(4);
      expect(qs.filter((q) => q.pole === axis[1])).toHaveLength(4);
    }
  });
  it("16가지 유형 풀이가 모두 있고 잘 통하는 유형도 실제 유형", () => {
    expect(TYPES).toHaveLength(16);
    for (const t of TYPES) for (const g of TYPE_TEXT[t].good) expect(TYPES).toContain(g);
  });
  it("영어 문항·풀이도 빠짐없이 있고 잘 통하는 유형이 한국어와 같다", () => {
    expect(QUESTIONS.every((q) => q.en.length > 0)).toBe(true);
    expect(Object.keys(TYPE_TEXT_EN).sort()).toEqual([...TYPES].sort());
    for (const t of TYPES) expect(TYPE_TEXT_EN[t].good).toEqual(TYPE_TEXT[t].good);
  });
});

describe("MBTI 계산", () => {
  it("한쪽으로만 답하면 그 유형이 100%", () => {
    for (const t of TYPES) {
      const r = calcMbti(answerFor(t));
      expect(r.type).toBe(t);
      expect(r.axes.every((a) => a.pct === 100)).toBe(true);
    }
  });
  it("모두 '그렇다'만 골라도 50%(앞 글자)", () => {
    const r = calcMbti(QUESTIONS.map(() => 2));
    expect(r.type).toBe("ESTJ");
    expect(r.axes.map((a) => a.firstPct)).toEqual([50, 50, 50, 50]);
  });
  it("지표별 비율", () => {
    // E 문항 하나만 "그렇다"(+1) → E 쪽 1/16 = 53%
    const a: Answer[] = QUESTIONS.map(() => 0);
    a[0] = 1;
    const r = calcMbti(a);
    expect(r.axes[0]).toMatchObject({ letter: "E", firstPct: 53, pct: 53 });
    // I 문항에 "매우 그렇다"(+2) 두 개 → E 쪽 50 - 4/16 × 50 = 37.5 → 38%
    a[0] = 0;
    a[4] = 2;
    a[12] = 2;
    expect(calcMbti(a).axes[0]).toMatchObject({ letter: "I", firstPct: 38, pct: 62 });
  });
});

describe("MBTI 공유 링크", () => {
  it("결과를 링크에 담았다가 그대로 되살린다", () => {
    const a: Answer[] = answerFor("INFP").map((v, i) => (i % 3 ? v : 0));
    const r = calcMbti(a);
    const hash = encodeMbtiLink(r);
    expect(hash).toMatch(/^r=INFP&p=/);
    expect(decodeMbtiLink("#" + hash)).toEqual(r);
  });
  it("비율이 잘못되거나 유형과 맞지 않으면 null", () => {
    expect(decodeMbtiLink("#r=INFP&p=30,30,30")).toBeNull();
    expect(decodeMbtiLink("#r=INFP&p=30,30,30,130")).toBeNull();
    expect(decodeMbtiLink("#r=ENFP&p=30,30,30,30")).toBeNull();
    expect(decodeMbtiLink("#r=infp&p=30,30,30,30")?.type).toBe("INFP");
    expect(decodeMbtiLink("")).toBeNull();
  });
});
