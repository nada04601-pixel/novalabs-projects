import { RATES } from "@/data/rates/2026";
import { calcNetSalary } from "@/lib/calculators/netSalary";

// 묶음 a(급여·4대보험·최저임금·주휴수당)에서 함께 쓰는 글자 만들기 도구와 기준값입니다.
// 금액은 모두 RATES와 계산기 함수로 빌드할 때 계산합니다.

export const n = (v: number) => Math.round(v).toLocaleString("ko-KR");
export const won = (v: number) => `${n(v)}원`;
export const man = (v: number) => `${n(v / 10_000)}만 원`;
export const p = (r: number, d = 2) => `${(r * 100).toFixed(d)}%`;
// 시간: 소수 자리를 정해 보여 주되, 끝의 0은 지웁니다(4.80 → 4.8, 3.0 → 3).
export const hr = (v: number, d = 1) => `${Number(v.toFixed(d)).toLocaleString("ko-KR")}시간`;

// 연봉을 "3,000만 원", "1억 원"처럼 보여 줍니다.
export const annualLabel = (v: number) => (v >= 100_000_000 && v % 100_000_000 === 0 ? `${v / 100_000_000}억 원` : man(v));

// 사이트 연봉 실수령액 계산기와 같은 조건(본인 1명, 자녀 0명)으로 계산합니다. 비과세는 기본 식대 한도.
export const netOf = (annual: number, nonTax: number = RATES.incomeTax.mealTaxFreeLimit, dependents = 1, children = 0) =>
  calcNetSalary({ annualSalary: annual, monthlyNonTaxable: nonTax, dependents, children });

// 10원 미만 버림. 3,000,000 × 0.009처럼 소수 계산 오차로 26,999.999…가 되는 경우를 막으려고
// 먼저 1원의 100분의 1 단위에서 반올림한 뒤 버립니다.
export const safeFloor10 = (v: number) => Math.floor(Math.round(v * 100) / 100 / 10) * 10;

// 월 과세 보수로 근로자 부담 4대보험료를 구합니다. 계산 순서는 연봉 실수령액 계산기(netSalary.ts)와 같고,
// 버림만 safeFloor10으로 해서 끝자리 오차가 없게 했습니다.
export const insuranceOf = (monthly: number) => {
  const pensionBase = Math.floor(Math.min(Math.max(monthly, RATES.pension.minBase), RATES.pension.maxBase) / 1000) * 1000;
  const pension = monthly > 0 ? safeFloor10(pensionBase * RATES.pension.rate) : 0;
  const health = safeFloor10(monthly * RATES.health.rate);
  const longTermCare = safeFloor10(health * RATES.longTermCare.rateOfHealth);
  const employment = safeFloor10(monthly * RATES.employment.rate);
  return { pensionBase, pension, health, longTermCare, employment, total: pension + health + longTermCare + employment };
};

// 고용보험 중 고용안정·직업능력개발사업 보험료율(사업주만 부담). 150인 미만 기업 1,000분의 2.5.
// 출처: 근로복지공단 보험료율 안내(https://www.comwel.or.kr/comwel/paym/paym/tari.jsp), 확인 2026-11-23
export const EMPLOYER_STABILITY_RATE_UNDER150 = 0.0025;

// 국민연금 보험료율 인상 일정: 2026년 9.5%부터 매년 0.5%포인트씩 올라 2033년 13%.
// 출처: 국민연금공단 안내(https://nps.or.kr/pnsinfo/ntpsklg/getOHAF0097M0.do), 확인 2026-11-23
export const PENSION_STEP = 0.005;
export const PENSION_TARGET = 0.13;

// 연도별 최저임금(시간급, 원). 출처: 최저임금위원회 연도별 결정현황
// (https://www.minimumwage.go.kr/minWage/policy/decisionMain.do), 확인 2026-11-23
// 2026년 값은 RATES.minimumWage를 그대로 씁니다.
export const MIN_WAGE_HISTORY: { year: number; hourly: number }[] = [
  { year: 2020, hourly: 8_590 },
  { year: 2021, hourly: 8_720 },
  { year: 2022, hourly: 9_160 },
  { year: 2023, hourly: 9_620 },
  { year: 2024, hourly: 9_860 },
  { year: 2025, hourly: 10_030 },
  { year: RATES.year, hourly: RATES.minimumWage },
  { year: 2027, hourly: 10_700 },
];
export const NEXT_MIN_WAGE = MIN_WAGE_HISTORY.find((x) => x.year === RATES.year + 1)!.hourly;

// 연봉 실수령액 계산기(netSalary.ts)의 소득세 추정 단계를 그대로 따라 계산해, 단계별 숫자를 보여 줄 때 씁니다.
// 계산기 안쪽 함수는 밖으로 내보내지 않아서 같은 식을 옮겨 왔습니다. netSalary.ts를 고치면 여기도 함께 고치세요.
function earnedIncomeDeduction(g: number) {
  let d: number;
  if (g <= 5_000_000) d = g * 0.7;
  else if (g <= 15_000_000) d = 3_500_000 + (g - 5_000_000) * 0.4;
  else if (g <= 45_000_000) d = 7_500_000 + (g - 15_000_000) * 0.15;
  else if (g <= 100_000_000) d = 12_000_000 + (g - 45_000_000) * 0.05;
  else d = 14_750_000 + (g - 100_000_000) * 0.02;
  return Math.min(d, 20_000_000);
}

function progressiveTax(base: number) {
  let tax = 0;
  let prev = 0;
  for (const b of RATES.incomeTax.brackets) {
    if (base <= prev) break;
    tax += (Math.min(base, b.upTo) - prev) * b.rate;
    prev = b.upTo;
  }
  return tax;
}

function earnedTaxCredit(tax: number, gross: number) {
  const credit = tax <= 1_300_000 ? tax * 0.55 : 715_000 + (tax - 1_300_000) * 0.3;
  let limit: number;
  if (gross <= 33_000_000) limit = 740_000;
  else if (gross <= 70_000_000) limit = Math.max(660_000, 740_000 - (gross - 33_000_000) * 0.008);
  else if (gross <= 120_000_000) limit = Math.max(500_000, 660_000 - (gross - 70_000_000) * 0.5);
  else limit = Math.max(200_000, 500_000 - (gross - 120_000_000) * 0.5);
  return Math.min(credit, limit);
}

// 자녀세액공제가 없는 경우(자녀 0명)의 단계별 소득세 추정입니다.
export function taxSteps(annual: number, nonTax: number = RATES.incomeTax.mealTaxFreeLimit, dependents = 1) {
  const r = netOf(annual, nonTax, dependents, 0);
  const monthlyGross = annual / 12;
  const taxableMonthly = monthlyGross - Math.min(nonTax, monthlyGross);
  const gross = taxableMonthly * 12;
  const deduction = earnedIncomeDeduction(gross);
  const incomeAmount = gross - deduction;
  const personal = Math.max(1, dependents) * RATES.incomeTax.personalDeduction;
  const pensionYear = r.pension * 12;
  const otherInsYear = (r.health + r.longTermCare + r.employment) * 12;
  const taxBase = Math.max(0, incomeAmount - personal - pensionYear - otherInsYear);
  const calculated = progressiveTax(taxBase);
  const credit = earnedTaxCredit(calculated, gross);
  const determined = Math.max(0, calculated - credit);
  return { r, taxableMonthly, gross, deduction, incomeAmount, personal, pensionYear, otherInsYear, taxBase, calculated, credit, determined };
}
