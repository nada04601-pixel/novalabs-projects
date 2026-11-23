import { describe, expect, it } from "vitest";
import { calcSeverance, ordinaryDailyFromMonthly } from "./severance";
import { calcUnemployment } from "./unemployment";
import { calcNetSalary } from "./netSalary";

describe("퇴직금: 평균임금과 통상임금 비교", () => {
  const base = { startDate: "2025-01-01", endDate: "2026-01-01", last3MonthsWage: 9_000_000, annualBonus: 0, annualLeavePay: 0 };

  it("월 통상임금을 넣지 않으면 평균임금으로 계산한다", () => {
    const r = calcSeverance(base)!;
    expect(r.usesOrdinary).toBe(false);
    expect(r.dailyWage).toBe(r.averageDailyWage);
  });

  it("월급만 받는 사람은 통상임금이 더 커서 통상임금으로 계산한다", () => {
    const r = calcSeverance({ ...base, monthlyOrdinaryWage: 3_000_000 })!;
    expect(r.ordinaryDailyWage).toBeCloseTo((3_000_000 / 209) * 8, 6);
    expect(r.usesOrdinary).toBe(true);
    expect(r.severancePay).toBe(Math.floor(r.ordinaryDailyWage * 30 * (r.serviceDays / 365)));
    expect(r.severancePay).toBeGreaterThan(calcSeverance(base)!.severancePay);
  });

  it("상여금이 커서 평균임금이 더 크면 평균임금을 쓴다", () => {
    const r = calcSeverance({ ...base, annualBonus: 12_000_000, monthlyOrdinaryWage: 3_000_000 })!;
    expect(r.usesOrdinary).toBe(false);
  });

  it("1일 통상임금은 월 통상임금 ÷ 209 × 8", () => {
    expect(ordinaryDailyFromMonthly(2_090_000)).toBe(80_000);
    expect(ordinaryDailyFromMonthly(0)).toBe(0);
  });
});

describe("퇴직금: 계속근로 1년은 달력상 1년", () => {
  const wage = { last3MonthsWage: 9_000_000, annualBonus: 0, annualLeavePay: 0 };

  it("2월 29일이 끼면 365일이어도 1년이 안 된다", () => {
    const r = calcSeverance({ ...wage, startDate: "2023-03-02", endDate: "2024-03-01" })!;
    expect(r.serviceDays).toBe(365);
    expect(r.eligible).toBe(false);
  });

  it("입사일 다음 해 같은 날이 퇴직일이면 1년이다", () => {
    expect(calcSeverance({ ...wage, startDate: "2023-03-02", endDate: "2024-03-02" })!.eligible).toBe(true);
    expect(calcSeverance({ ...wage, startDate: "2025-03-02", endDate: "2026-03-02" })!.eligible).toBe(true);
    expect(calcSeverance({ ...wage, startDate: "2025-03-02", endDate: "2026-03-01" })!.eligible).toBe(false);
  });
});

describe("실업급여: 기초일액은 평균임금과 통상임금 중 큰 쪽", () => {
  const base = { wages3m: 6_000_000, days3m: 92, dailyHours: 8, period: "1to3" as const, over50OrDisabled: false };

  it("통상임금이 더 크면 통상임금의 60%로 계산한다", () => {
    const r = calcUnemployment({ ...base, monthlyOrdinaryWage: 2_000_000 });
    expect(r.usesOrdinary).toBe(true);
    expect(r.raw).toBeCloseTo(((2_000_000 / 209) * 8) * 0.6, 6);
  });

  it("월 통상임금을 비우면 예전처럼 평균임금으로 계산한다", () => {
    const r = calcUnemployment(base);
    expect(r.usesOrdinary).toBe(false);
    expect(r.raw).toBeCloseTo((6_000_000 / 92) * 0.6, 6);
  });
});

describe("실수령액: 10원 미만 버림의 소수 오차", () => {
  it("월 300만 원의 고용보험은 27,000원", () => {
    const r = calcNetSalary({ annualSalary: 36_000_000, monthlyNonTaxable: 0, dependents: 1, children: 0 });
    expect(r.employment).toBe(27_000);
  });
});
