import { describe, expect, it } from "vitest";
import { calcSocialInsurance } from "./socialInsurance";
import { calcNetSalary } from "./netSalary";
import { RATES } from "@/data/rates/2026";

const base = { monthlyPay: 3_200_000, monthlyNonTaxable: 200_000, stability: "under150" as const, industrialPermille: 6.6 };
const row = (r: ReturnType<typeof calcSocialInsurance>, key: string) => r.rows.find((x) => x.key === key)!;

describe("4대보험 계산기", () => {
  it("월 보수 300만 원(비과세 20만 원 제외)의 항목별 금액", () => {
    const r = calcSocialInsurance(base);
    expect(r.base).toBe(3_000_000);
    expect(row(r, "pension")).toMatchObject({ employee: 142_500, employer: 142_500 });
    expect(row(r, "health")).toMatchObject({ employee: 107_850, employer: 107_850 });
    expect(row(r, "longTermCare")).toMatchObject({ employee: 14_170, employer: 14_170 });
    expect(row(r, "unemployment")).toMatchObject({ employee: 27_000, employer: 27_000 });
    expect(row(r, "stability")).toMatchObject({ employee: 0, employer: 7_500 });
    expect(row(r, "industrial").employer).toBe(19_800);
    expect(row(r, "wageClaim").employer).toBe(1_800);
    expect(row(r, "asbestos").employer).toBe(180);
    expect(r.employeeTotal).toBe(291_520);
    expect(r.employerTotal).toBe(320_800);
    expect(r.companyCost).toBe(3_200_000 + 320_800);
  });

  it("근로자 부담분은 연봉 실수령액 계산기와 같다", () => {
    for (const monthly of [2_156_880, 3_000_000, 4_500_000, 8_000_000]) {
      const s = calcSocialInsurance({ ...base, monthlyPay: monthly, monthlyNonTaxable: 200_000 });
      const n = calcNetSalary({ annualSalary: monthly * 12, monthlyNonTaxable: 200_000, dependents: 1, children: 0 });
      expect(row(s, "pension").employee).toBe(n.pension);
      expect(row(s, "health").employee).toBe(n.health);
      expect(row(s, "longTermCare").employee).toBe(n.longTermCare);
      expect(row(s, "unemployment").employee).toBe(n.employment);
    }
  });

  it("국민연금은 기준소득월액 상·하한을 적용한다", () => {
    const high = calcSocialInsurance({ ...base, monthlyPay: 10_000_000, monthlyNonTaxable: 0 });
    expect(high.pensionBase).toBe(RATES.pension.maxBase);
    const low = calcSocialInsurance({ ...base, monthlyPay: 300_000, monthlyNonTaxable: 0 });
    expect(low.pensionBase).toBe(RATES.pension.minBase);
  });

  it("회사 규모가 크면 고용안정·직업능력개발 보험료가 오른다", () => {
    const big = calcSocialInsurance({ ...base, stability: "over1000" });
    expect(row(big, "stability").employer).toBe(25_500);
  });

  it("만 60세 이상은 국민연금, 만 65세 이후 입사는 실업급여 보험료가 없다", () => {
    const r = calcSocialInsurance({ ...base, over60: true, hiredAfter65: true });
    expect(row(r, "pension")).toMatchObject({ employee: 0, employer: 0 });
    expect(row(r, "unemployment")).toMatchObject({ employee: 0, employer: 0 });
    expect(row(r, "stability").employer).toBe(7_500);
    expect(row(r, "health").employee).toBe(107_850);
  });

  it("급여가 0이면 모두 0", () => {
    const r = calcSocialInsurance({ ...base, monthlyPay: 0 });
    expect(r.total).toBe(0);
  });
});
