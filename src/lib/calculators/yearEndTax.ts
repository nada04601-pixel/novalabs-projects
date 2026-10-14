import { RATES as R } from "@/data/rates/2026";
import { calcRentTaxCredit } from "./rentTaxCredit";
import { calcNetSalary, childCredit, earnedIncomeDeduction, earnedTaxCredit, progressiveTax } from "./netSalary";

const Y = R.yearEnd;

export type YearEndInput = {
  totalSalary: number; // 총급여(비과세 제외)
  withheld?: number; // 이미 낸 소득세(지방소득세 제외). 비우면 간이세액 기준으로 추정
  dependents: number; // 기본공제 인원(본인 포함)
  seniors: number; // 그중 70세 이상
  disabled: number; // 그중 장애인
  children: number; // 기본공제 대상 자녀 수(신용카드 한도 추가에 사용)
  childrenOver8: number; // 그중 8세 이상(자녀세액공제)
  birthOrder: 0 | 1 | 2 | 3; // 올해 출산·입양한 자녀가 몇째인지(0이면 없음)
  married: boolean; // 올해 혼인신고(생애 1회)
  card: { credit: number; debit: number; culture: number; market: number; transit: number };
  insurance: number; // 보장성 보험료
  medicalSelf: number; // 본인·65세 이상·장애인 의료비(한도 없음)
  medicalOther: number; // 그 밖의 부양가족 의료비(연 700만 원 한도)
  education: number; // 공제 대상 교육비
  donation: number; // 일반 기부금
  pensionSavings: number; // 연금저축 납입액
  irp: number; // IRP(퇴직연금) 납입액
  annualRent: number; // 1년 동안 낸 월세 합계
};

export type YearEndResult = {
  earnedIncome: number; // 근로소득금액
  personalDeduction: number;
  pensionInsurance: number; // 국민연금(추정)
  socialInsurance: number; // 건강·장기요양·고용보험(추정)
  cardDeduction: number;
  taxBase: number;
  calculatedTax: number;
  credits: { label: string; amount: number }[];
  usedStandard: boolean; // 표준세액공제가 더 유리해서 적용했는지
  determinedTax: number; // 결정세액(소득세)
  withheld: number;
  withheldEstimated: boolean;
  refund: number; // 돌려받을 금액(소득세+지방소득세, 음수면 더 내야 함)
};

// 신용카드 등 소득공제. 총급여의 25%는 공제율이 낮은 것부터 먼저 쓴 것으로 봅니다.
export function calcCardDeduction(gross: number, children: number, card: YearEndInput["card"]) {
  const c = Y.card;
  const low = gross <= c.baseLimit.threshold;
  const cultureOk = gross <= c.cultureIncomeLimit;
  // 7천만 원 초과면 도서·공연 등은 일반 신용카드 사용분으로 봅니다.
  const amounts = {
    credit: card.credit + (cultureOk ? 0 : card.culture),
    debit: card.debit,
    culture: cultureOk ? card.culture : 0,
    market: card.market,
    transit: card.transit,
  };
  let rest = gross * c.minSpendRate;
  const over = {} as typeof amounts;
  for (const k of ["credit", "debit", "culture", "market", "transit"] as const) {
    const used = Math.min(Math.max(0, amounts[k]), rest);
    rest -= used;
    over[k] = Math.max(0, amounts[k]) - used;
  }
  const total =
    over.credit * c.rates.credit +
    over.debit * c.rates.debit +
    over.culture * c.rates.culture +
    over.market * c.rates.market +
    over.transit * c.rates.transit;
  const special = over.culture * c.rates.culture + over.market * c.rates.market + over.transit * c.rates.transit;

  const kids = Math.min(Math.max(0, children), c.childLimit.maxChildren);
  const baseLimit = (low ? c.baseLimit.low : c.baseLimit.high) + kids * (low ? c.childLimit.low : c.childLimit.high);
  const base = Math.min(total, baseLimit);
  const extra = Math.min(total - base, special, low ? c.extraLimit.low : c.extraLimit.high);
  return { total, baseLimit, deduction: Math.floor(base + extra) };
}

export function calcMedicalCredit(gross: number, self: number, other: number) {
  const m = Y.medical;
  const threshold = gross * m.minSpendRate;
  // 문턱(총급여 3%)은 한도가 있는 가족 의료비에서 먼저 뺍니다.
  const otherOver = Math.min(Math.max(0, other - threshold), m.otherLimit);
  const selfOver = Math.max(0, self - Math.max(0, threshold - other));
  return (otherOver + selfOver) * m.rate;
}

export function calcPensionCredit(gross: number, savings: number, irp: number) {
  const p = Y.pension;
  const s = Math.min(Math.max(0, savings), p.savingsLimit);
  const base = Math.min(s + Math.max(0, irp), p.totalLimit);
  return base * (gross <= p.highRateIncome ? p.highRate : p.lowRate);
}

export function calcYearEndTax(input: YearEndInput): YearEndResult {
  const gross = Math.max(0, input.totalSalary);
  const people = Math.max(1, input.dependents);

  // 4대보험은 총급여를 12로 나눈 월급 기준으로 추정합니다.
  const monthly = calcNetSalary({ annualSalary: gross, monthlyNonTaxable: 0, dependents: people, children: input.childrenOver8 });
  const pensionInsurance = monthly.pension * 12;
  const socialInsurance = (monthly.health + monthly.longTermCare + monthly.employment) * 12;

  const earnedIncome = Math.max(0, gross - earnedIncomeDeduction(gross));
  const personalDeduction =
    people * R.incomeTax.personalDeduction +
    Math.max(0, input.seniors) * Y.seniorDeduction +
    Math.max(0, input.disabled) * Y.disabledDeduction;
  const card = calcCardDeduction(gross, input.children, input.card);

  // 건강·고용보험료 공제와 특별세액공제를 받는 경우(항목별)와 표준세액공제를 받는 경우를 모두 계산해 유리한 쪽을 씁니다.
  const taxFor = (itemized: boolean) => {
    const base = Math.max(
      0,
      earnedIncome - personalDeduction - pensionInsurance - (itemized ? socialInsurance : 0) - card.deduction
    );
    const calculated = progressiveTax(base);
    const birth = input.birthOrder > 0 ? Y.birth[input.birthOrder - 1] : 0;
    const credits: { label: string; amount: number }[] = [
      { label: "근로소득세액공제", amount: earnedTaxCredit(calculated, gross) },
      { label: "자녀세액공제", amount: childCredit(input.childrenOver8) },
      { label: "출산·입양 세액공제", amount: birth },
      { label: "혼인 세액공제", amount: input.married ? Y.marriage : 0 },
      { label: "연금계좌 세액공제", amount: calcPensionCredit(gross, input.pensionSavings, input.irp) },
    ];
    if (itemized) {
      credits.push(
        { label: "보장성 보험료", amount: Math.min(Math.max(0, input.insurance), Y.insurance.limit) * Y.insurance.rate },
        { label: "의료비", amount: calcMedicalCredit(gross, input.medicalSelf, input.medicalOther) },
        { label: "교육비", amount: Math.max(0, input.education) * Y.education.rate },
        {
          label: "기부금",
          amount:
            Math.min(Math.max(0, input.donation), Y.donation.highFrom) * Y.donation.rate +
            Math.max(0, input.donation - Y.donation.highFrom) * Y.donation.highRate,
        },
        { label: "월세 세액공제", amount: calcRentTaxCredit(gross, Math.max(0, input.annualRent), 1).credit }
      );
    } else {
      credits.push({ label: "표준세액공제", amount: Y.standardCredit });
    }
    const used = credits.filter((c) => c.amount > 0).map((c) => ({ ...c, amount: Math.floor(c.amount) }));
    const determined = Math.max(0, Math.floor(calculated - used.reduce((s, c) => s + c.amount, 0)));
    return { base, calculated, credits: used, determined };
  };

  const itemized = taxFor(true);
  const standard = taxFor(false);
  const usedStandard = standard.determined < itemized.determined;
  const best = usedStandard ? standard : itemized;

  const withheldEstimated = input.withheld === undefined;
  const withheld = withheldEstimated ? monthly.incomeTax * 12 : Math.max(0, input.withheld!);
  // 지방소득세는 소득세의 10%라서 함께 정산됩니다.
  const local = (tax: number) => Math.floor((tax * R.localTaxRate) / 10) * 10;
  const refund = withheld + local(withheld) - (best.determined + local(best.determined));

  return {
    earnedIncome,
    personalDeduction,
    pensionInsurance,
    socialInsurance: usedStandard ? 0 : socialInsurance,
    cardDeduction: card.deduction,
    taxBase: best.base,
    calculatedTax: Math.floor(best.calculated),
    credits: best.credits,
    usedStandard,
    determinedTax: best.determined,
    withheld,
    withheldEstimated,
    refund,
  };
}
