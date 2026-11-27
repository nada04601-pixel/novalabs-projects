import { RATES as R } from "@/data/rates/2026";

export type NetSalaryInput = {
  annualSalary: number; // 세전 연봉(원)
  monthlyNonTaxable: number; // 월 비과세액(원)
  dependents: number; // 본인 포함 부양가족 수
  children: number; // 자녀세액공제 대상 자녀 수(2026년분 9세 이상 20세 이하, 소득세법 제59조의2·부칙 <법률 제21548호> 제2조, 확인 2026-11-27)
};

export type NetSalaryResult = {
  monthlyGross: number;
  pension: number;
  health: number;
  longTermCare: number;
  employment: number;
  incomeTax: number;
  localTax: number;
  totalDeduction: number;
  monthlyNet: number;
  annualNet: number;
};

// 10원 미만 버림. 3,000,000 × 0.009가 26,999.999…로 계산되는 소수 오차 때문에 10원이 덜 나오지 않게, 먼저 소수 둘째 자리에서 반올림합니다.
const floor10 = (n: number) => Math.floor(Math.round(n * 100) / 1000) * 10;

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
  for (const b of R.incomeTax.brackets) {
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

function childCredit(n: number) {
  if (n <= 0) return 0;
  if (n === 1) return 250_000;
  if (n === 2) return 550_000;
  return 550_000 + (n - 2) * 400_000;
}

export function calcNetSalary(input: NetSalaryInput): NetSalaryResult {
  const annual = Math.max(0, input.annualSalary);
  const monthlyGross = annual / 12;
  const nonTax = Math.min(Math.max(0, input.monthlyNonTaxable), monthlyGross);
  const taxableMonthly = monthlyGross - nonTax; // 4대보험·소득세 부과 기준

  const pensionBase =
    Math.floor(Math.min(Math.max(taxableMonthly, R.pension.minBase), R.pension.maxBase) / 1000) * 1000;
  const pension = taxableMonthly > 0 ? floor10(pensionBase * R.pension.rate) : 0;
  const health = floor10(taxableMonthly * R.health.rate);
  const longTermCare = floor10(health * R.longTermCare.rateOfHealth);
  const employment = floor10(taxableMonthly * R.employment.rate);

  // 소득세(연 환산 추정)
  const gross = taxableMonthly * 12;
  const incomeAmount = gross - earnedIncomeDeduction(gross);
  const deductions =
    Math.max(1, input.dependents) * R.incomeTax.personalDeduction +
    pension * 12 +
    (health + longTermCare + employment) * 12;
  const taxBase = Math.max(0, incomeAmount - deductions);
  const calculated = progressiveTax(taxBase);
  const determined = Math.max(0, calculated - earnedTaxCredit(calculated, gross) - childCredit(input.children));
  const incomeTax = floor10(determined / 12);
  const localTax = floor10(incomeTax * R.localTaxRate);

  const totalDeduction = pension + health + longTermCare + employment + incomeTax + localTax;
  const monthlyNet = Math.round(monthlyGross) - totalDeduction;
  return {
    monthlyGross: Math.round(monthlyGross),
    pension, health, longTermCare, employment, incomeTax, localTax,
    totalDeduction,
    monthlyNet,
    annualNet: monthlyNet * 12,
  };
}
