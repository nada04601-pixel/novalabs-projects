import { describe, expect, it } from "vitest";
import { calcCardDeduction, calcMedicalCredit, calcPensionCredit, calcYearEndTax, type YearEndInput } from "./yearEndTax";

const noCard = { credit: 0, debit: 0, culture: 0, market: 0, transit: 0 };
const base: YearEndInput = {
  totalSalary: 50_000_000,
  dependents: 1,
  seniors: 0,
  disabled: 0,
  children: 0,
  childrenOver8: 0,
  birthOrder: 0,
  married: false,
  card: noCard,
  insurance: 0,
  medicalSelf: 0,
  medicalOther: 0,
  education: 0,
  donation: 0,
  pensionSavings: 0,
  irp: 0,
  annualRent: 0,
};

describe("신용카드 등 소득공제", () => {
  it("총급여 25%를 넘는 금액만 공제", () => {
    // 5천만 원의 25% = 1,250만 원, 초과 750만 원 × 15%
    expect(calcCardDeduction(50_000_000, 0, { ...noCard, credit: 20_000_000 }).deduction).toBe(1_125_000);
    expect(calcCardDeduction(50_000_000, 0, { ...noCard, credit: 12_000_000 }).deduction).toBe(0);
  });

  it("25%는 공제율이 낮은 신용카드부터 채움", () => {
    // 1,250만 원을 신용카드 1,000만 원 + 체크카드 250만 원으로 채우고, 남은 체크카드 750만 원 × 30%
    expect(calcCardDeduction(50_000_000, 0, { ...noCard, credit: 10_000_000, debit: 10_000_000 }).deduction).toBe(2_250_000);
  });

  it("자녀 수만큼 기본한도가 늘고, 넘친 금액은 대중교통 등으로 추가 공제", () => {
    // 4천만 원: 25% = 1,000만 원. 체크 2,000만 × 30% = 600만, 대중교통 200만 × 40% = 80만
    // 기본한도 300만 + 자녀 2명 100만 = 400만, 추가 공제 80만
    const r = calcCardDeduction(40_000_000, 2, { ...noCard, debit: 30_000_000, transit: 2_000_000 });
    expect(r.baseLimit).toBe(4_000_000);
    expect(r.deduction).toBe(4_800_000);
    // 자녀 3명이어도 2명분까지만
    expect(calcCardDeduction(40_000_000, 3, { ...noCard, debit: 30_000_000 }).baseLimit).toBe(4_000_000);
  });

  it("총급여 7천만 원 초과면 도서·공연 등은 신용카드로 보고 한도가 낮아짐", () => {
    const r = calcCardDeduction(80_000_000, 3, { ...noCard, credit: 30_000_000, culture: 1_000_000 });
    // 3,100만 - 2,000만 = 1,100만 × 15%
    expect(r.deduction).toBe(1_650_000);
    expect(r.baseLimit).toBe(3_000_000);
  });
});

describe("세액공제", () => {
  it("의료비는 총급여 3%를 가족 의료비에서 먼저 뺌", () => {
    // 4천만 원의 3% = 120만 원. 가족 100만 원으로 다 못 채우고 본인 의료비에서 20만 원 더 뺌
    expect(calcMedicalCredit(40_000_000, 2_000_000, 1_000_000)).toBe(270_000);
    expect(calcMedicalCredit(40_000_000, 0, 1_000_000)).toBe(0);
  });

  it("연금저축 600만, 합계 900만 한도와 총급여별 공제율", () => {
    expect(calcPensionCredit(50_000_000, 7_000_000, 3_000_000)).toBe(1_350_000);
    expect(calcPensionCredit(60_000_000, 7_000_000, 3_000_000)).toBe(1_080_000);
  });
});

describe("연말정산 결과", () => {
  it("결정세액은 산출세액에서 세액공제를 뺀 금액", () => {
    const r = calcYearEndTax(base);
    const credits = r.credits.reduce((s, c) => s + c.amount, 0);
    expect(r.determinedTax).toBe(Math.max(0, r.calculatedTax - credits));
    expect(r.withheldEstimated).toBe(true);
  });

  it("기납부세액을 넣으면 지방소득세까지 합쳐 환급액 계산", () => {
    const r = calcYearEndTax({ ...base, withheld: 2_000_000 });
    const d = r.determinedTax;
    expect(r.refund).toBe(2_000_000 + 200_000 - (d + Math.floor(d / 100) * 10));
  });

  it("공제 항목이 늘면 세금이 줄고, 결정세액은 0 아래로 내려가지 않음", () => {
    const plain = calcYearEndTax(base).determinedTax;
    const more = calcYearEndTax({ ...base, insurance: 1_000_000, pensionSavings: 6_000_000 }).determinedTax;
    expect(more).toBeLessThan(plain);
    expect(calcYearEndTax({ ...base, irp: 9_000_000, donation: 30_000_000 }).determinedTax).toBe(0);
  });

  it("특별세액공제가 거의 없으면 표준세액공제와 비교해 유리한 쪽을 씀", () => {
    const r = calcYearEndTax({ ...base, totalSalary: 25_000_000 });
    const itemized = calcYearEndTax({ ...base, totalSalary: 25_000_000, insurance: 1_000_000 });
    expect(itemized.usedStandard).toBe(false);
    expect(r.credits.some((c) => c.label === "표준세액공제")).toBe(r.usedStandard);
  });
});
