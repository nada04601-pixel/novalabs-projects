import { describe, expect, it } from "vitest";
import { calcCarTax, carAges, reductionRate } from "./carTax";

const newCar = { taxYear: 2027, regYear: 2026, regMonth: 3 };

describe("자동차세: 서울시 공식 1월 연납 예시(신차, 지방교육세 제외)", () => {
  // 출처: 내 손안에 서울 2025-01-14 https://mediahub.seoul.go.kr/archives/2013200
  const cases: [string, number, number, number][] = [
    ["3,342cc", 3342, 668_400, 30_580],
    ["1,998cc", 1998, 399_600, 18_280],
    ["1,598cc", 1598, 223_720, 10_230],
  ];
  for (const [name, cc, annual, discount] of cases) {
    it(name, () => {
      const r = calcCarTax({ kind: "cc", cc, ...newCar });
      expect(r.annualCarTax).toBe(annual);
      const jan = r.prepay.find((p) => p.month === 1)!;
      expect(jan.discount).toBe(discount);
      expect(jan.carTax).toBe(annual - discount);
    });
  }
  it("전기차 연 10만 원, 1월 연납 공제 4,570원", () => {
    const r = calcCarTax({ kind: "electric", cc: 0, ...newCar });
    expect(r.annualCarTax).toBe(100_000);
    expect(r.annualEduTax).toBe(30_000);
    expect(r.prepay[0].discount).toBe(4_570);
    expect(r.lumpSumInJune).toBe(true);
  });
});

describe("자동차세: 차령과 경감", () => {
  it("기산일이 7~12월이면 1기분 차령이 한 해 적다", () => {
    expect(carAges(2026, 2024, 9)).toEqual({ first: 2, second: 3 });
    expect(carAges(2026, 2024, 3)).toEqual({ first: 3, second: 3 });
  });
  it("차령 3년부터 5%씩, 12년 이상은 50%", () => {
    expect(reductionRate(2)).toBe(0);
    expect(reductionRate(3)).toBeCloseTo(0.05);
    expect(reductionRate(12)).toBeCloseTo(0.5);
    expect(reductionRate(20)).toBeCloseTo(0.5);
  });
  it("2024년 9월 등록 1,998cc의 2026년: 1기분은 경감 없음, 2기분 5% 경감", () => {
    const r = calcCarTax({ kind: "cc", cc: 1998, taxYear: 2026, regYear: 2024, regMonth: 9 });
    expect(r.first.carTax).toBe(199_800);
    expect(r.second.carTax).toBe(189_810);
    expect(r.second.eduTax).toBe(56_940);
  });
  it("제작연도보다 늦게 등록하면 제작연도 12월을 기산일로 본다", () => {
    const r = calcCarTax({ kind: "cc", cc: 1598, taxYear: 2026, regYear: 2024, regMonth: 2, madeYear: 2023 });
    expect(r.baseYear).toBe(2023);
    expect(r.first.age).toBe(3);
    expect(r.second.age).toBe(4);
  });
  it("전기차는 오래돼도 경감이 없다", () => {
    const r = calcCarTax({ kind: "electric", cc: 0, taxYear: 2026, regYear: 2015, regMonth: 5 });
    expect(r.annualCarTax).toBe(100_000);
  });
});

describe("자동차세: 연납 시기별 공제", () => {
  const r = calcCarTax({ kind: "cc", cc: 1998, ...newCar });
  it("3월은 4월~12월(275일), 6월은 2기분의 5%, 9월은 2기분의 2.5%", () => {
    expect(r.prepay[1].days).toBe(275);
    expect(r.prepay[1].discount).toBe(Math.floor((399_600 * 275 * 0.05) / 365 / 10) * 10);
    expect(r.prepay[2].discount).toBe(9_990);
    expect(r.prepay[3].discount).toBe(4_990);
  });
});
