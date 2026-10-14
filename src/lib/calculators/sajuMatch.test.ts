import { describe, expect, it } from "vitest";
import { calcSaju, type SajuResult } from "./saju";
import { branchRel, calcMatch, dayMasterRel } from "./sajuMatch";

const mk = (year: number, month: number, day: number) =>
  calcSaju({ calendar: "solar", year, month, day, time: { hour: 12, minute: 0 }, longitude: null, dayChange: "23" }) as SajuResult;

describe("궁합: 일간 관계", () => {
  it("합·충·상생·상극·비화", () => {
    expect(dayMasterRel("甲", "己")).toEqual({ rel: "합" });
    expect(dayMasterRel("甲", "庚")).toEqual({ rel: "충" });
    expect(dayMasterRel("甲", "丙")).toEqual({ rel: "상생", giver: "a" }); // 목생화
    expect(dayMasterRel("丙", "甲")).toEqual({ rel: "상생", giver: "b" });
    expect(dayMasterRel("甲", "戊")).toEqual({ rel: "상극", giver: "a" }); // 목극토
    expect(dayMasterRel("戊", "乙")).toEqual({ rel: "상극", giver: "b" });
    expect(dayMasterRel("戊", "己")).toEqual({ rel: "비화" });
  });
});

describe("궁합: 지지 관계", () => {
  it("겹치면 영향이 큰 관계부터", () => {
    expect(branchRel("子", "丑")).toBe("육합");
    expect(branchRel("子", "午")).toBe("충");
    expect(branchRel("寅", "亥")).toBe("육합"); // 파이기도 하지만 합을 먼저
    expect(branchRel("子", "辰")).toBe("반합");
    expect(branchRel("卯", "子")).toBe("형");
    expect(branchRel("午", "午")).toBe("자형");
    expect(branchRel("子", "子")).toBe("같음");
    expect(branchRel("子", "未")).toBe("원진"); // 해이기도 하지만 원진을 먼저
    expect(branchRel("子", "酉")).toBe("파");
    expect(branchRel("午", "亥")).toBe("없음");
  });
  it("띠 궁합은 같은 삼합 무리를 좋게 본다", () => {
    expect(branchRel("申", "辰")).toBe("없음");
    expect(branchRel("申", "辰", true)).toBe("삼합");
  });
});

describe("궁합 점수", () => {
  const a = mk(2000, 1, 1); // 己卯 丙子 戊午 戊午, 금 없음
  it("항목별 점수를 더하고 등급을 매긴다", () => {
    // 1999-12-25: 己卯 丙子 辛亥 甲午. 戊(토)가 辛(금)을 생함, 午亥 관계 없음, 같은 띠
    const m = calcMatch(a, mk(1999, 12, 25));
    expect(m.dayMaster).toEqual({ rel: "상생", giver: "a", score: 24 });
    expect(m.spouse).toEqual({ rel: "없음", chars: "午亥", score: 16 });
    expect(m.zodiac).toEqual({ rel: "같음", chars: "卯卯", score: 10 });
    expect(m.elements.score).toBe(8); // 내 약한 금을 상대도 채우지 못함
    expect(m.total).toBe(58);
    expect(m.grade).toBe("무난한 궁합");
    expect(m.bToA.god).toBe("상관");
    expect(m.aToB.god).toBe("정인");
  });
  it("부족한 오행을 상대가 채우면 보완 점수가 오른다", () => {
    // 1996-03-03: 丙子 庚寅 己亥 庚午, 금 2.0
    const m = calcMatch(a, mk(1996, 3, 3));
    expect(m.elements).toMatchObject({ aWeak: ["금"], aFilled: ["금"], bWeak: ["목"], bFilled: [], score: 17 });
  });
  it("일지 육합은 배우자 자리 만점", () => {
    expect(calcMatch(a, mk(2000, 1, 2)).spouse).toEqual({ rel: "육합", chars: "午未", score: 30 });
  });
});
