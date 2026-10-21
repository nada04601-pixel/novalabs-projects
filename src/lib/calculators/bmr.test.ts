import { describe, expect, it } from "vitest";
import { calcBmr, harrisBenedict, katchMcArdle, mifflin, validInput } from "./bmr";

const man = { sex: "male" as const, age: 30, heightCm: 175, weightKg: 70 };
const woman = { sex: "female" as const, age: 30, heightCm: 160, weightKg: 55 };

describe("기초대사량", () => {
  it("Mifflin-St Jeor", () => {
    expect(mifflin(man)).toBeCloseTo(1648.75, 2); // 700 + 1093.75 - 150 + 5
    expect(mifflin(woman)).toBeCloseTo(1239, 2); // 550 + 1000 - 150 - 161
  });
  it("개정 Harris-Benedict", () => {
    expect(harrisBenedict(man)).toBeCloseTo(1695.667, 2);
    expect(harrisBenedict(woman)).toBeCloseTo(1321.958, 2);
  });
  it("Katch-McArdle은 제지방량으로 계산한다", () => {
    expect(katchMcArdle(70, 20)).toBeCloseTo(1579.6, 2); // 370 + 21.6 × 56
  });
  it("활동 계수로 하루 소비 칼로리와 감량·증량 목표를 낸다", () => {
    const r = calcBmr(man, "moderate");
    expect(r.tdee).toBeCloseTo(1648.75 * 1.55, 2);
    expect(r.lose).toBeCloseTo(r.tdee - 500, 6);
    expect(r.gain).toBeCloseTo(r.tdee + 500, 6);
    expect(r.katchMcArdle).toBeUndefined();
    expect(r.byActivity).toHaveLength(5);
    expect(calcBmr({ ...man, bodyFatPct: 20 }, "sedentary").katchMcArdle).toBeCloseTo(1579.6, 2);
  });
  it("범위를 벗어난 입력은 걸러 낸다", () => {
    expect(validInput(man)).toBe(true);
    expect(validInput({ ...man, age: 0 })).toBe(false);
    expect(validInput({ ...man, heightCm: 1.75 })).toBe(false);
    expect(validInput({ ...man, bodyFatPct: 0 })).toBe(false);
  });
});
