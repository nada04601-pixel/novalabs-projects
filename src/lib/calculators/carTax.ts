// 자동차세 계산기(비영업용 승용자동차). 근거 조문은 모두 국가법령정보센터 원문으로 확인했습니다(2026-11-27).
// - 세율: 지방세법 제127조 제1항 제1호(배기량 cc당 세액), 제3호(그 밖의 승용자동차 연 10만 원)
// - 차령 경감: 지방세법 제127조 제1항 제2호(차령 3년부터 해마다 5%, 12년 이상은 12년으로 봄, 최대 50%)
// - 차령 계산: 지방세법 시행령 제122조 제2항, 차령기산일은 자동차관리법 시행령 제3조
// - 납기: 지방세법 제128조 제1항(1기분 6월 16~30일, 2기분 12월 16~31일)
// - 연납 공제: 지방세법 제128조 제3항, 이자율 100분의 5(지방세법 시행령 제125조 제6항)
// - 지방교육세: 지방세법 제151조 제1항 제7호(자동차세액의 100분의 30), 제150조 제7호(비영업용 승용자동차)
// - 10원 미만 버림: 지방회계법 제55조

export type CarKind = "cc" | "electric"; // cc: 배기량 기준 승용차(하이브리드 포함), electric: 전기·태양열·알코올 자동차

// 비영업용 승용자동차 cc당 세액
export const CC_RATES = [
  { upTo: 1000, perCc: 80 },
  { upTo: 1600, perCc: 140 },
  { upTo: Infinity, perCc: 200 },
] as const;
export const OTHER_CAR_ANNUAL = 100_000; // 그 밖의 승용자동차(비영업용) 연세액
export const AGE_REDUCTION_PER_YEAR = 0.05;
export const PREPAY_INTEREST = 0.05; // 연납 공제 이자율(2026년, 2027년도 현행 시행령 그대로면 같음)
export const EDUCATION_TAX_RATE = 0.3;

export const floor10 = (v: number) => Math.floor(Math.round(v * 100) / 1000) * 10;

export const perCcOf = (cc: number) => CC_RATES.find((r) => cc <= r.upTo)!.perCc;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInYear = (y: number) => (isLeap(y) ? 366 : 365);

// 차령(시행령 제122조 제2항): 기산일이 1~6월이면 두 기분 모두 (과세연도 − 기산연도 + 1),
// 7~12월이면 1기분은 (과세연도 − 기산연도), 2기분은 (과세연도 − 기산연도 + 1).
export function carAges(taxYear: number, baseYear: number, baseMonth: number) {
  const second = taxYear - baseYear + 1;
  const first = baseMonth <= 6 ? second : second - 1;
  return { first, second };
}

// 차령에 따른 경감률(차령 3년 이상, 12년 넘으면 12년으로 봄)
export const reductionRate = (age: number) => (age >= 3 ? AGE_REDUCTION_PER_YEAR * (Math.min(age, 12) - 2) : 0);

export type CarTaxInput = {
  kind: CarKind;
  cc: number; // 배기량(cc). kind가 electric이면 쓰지 않음
  taxYear: number; // 과세연도
  regYear: number; // 최초 신규등록 연도
  regMonth: number; // 최초 신규등록 월(1~12)
  madeYear?: number; // 제작연도. 등록연도보다 이르면 차령기산일은 제작연도의 12월 31일
};

export type PeriodTax = { age: number; reduction: number; carTax: number; eduTax: number; total: number };

export type PrepayOption = { month: 1 | 3 | 6 | 9; base: number; days: number; denominator: number; discount: number; carTax: number; eduTax: number; total: number };

export type CarTaxResult = {
  baseAnnual: number; // 경감 전 연세액(배기량 × cc당 세액 또는 10만 원)
  perCc: number;
  baseYear: number;
  baseMonth: number;
  first: PeriodTax; // 1기분(1~6월분, 6월 납부)
  second: PeriodTax; // 2기분(7~12월분, 12월 납부)
  annualCarTax: number;
  annualEduTax: number;
  annualTotal: number;
  lumpSumInJune: boolean; // 연세액 10만 원 이하: 1기분에 한꺼번에 부과할 수 있음(제128조 제4항)
  firstYear: boolean; // 과세연도에 처음 등록한 차(실제로는 등록일부터 일할 계산)
  prepay: PrepayOption[];
};

// 비영업용 승용자동차는 배기량 기준 차와 전기차 모두 지방교육세가 붙습니다(제150조 제7호).
const eduOf = (carTax: number, _kind: CarKind) => floor10(carTax * EDUCATION_TAX_RATE);

export function calcCarTax(input: CarTaxInput): CarTaxResult {
  const cc = Math.max(0, Math.round(input.cc));
  const perCc = input.kind === "cc" ? perCcOf(cc) : 0;
  const baseAnnual = input.kind === "cc" ? cc * perCc : OTHER_CAR_ANNUAL;

  const made = input.madeYear && input.madeYear < input.regYear ? input.madeYear : undefined;
  const baseYear = made ?? input.regYear;
  const baseMonth = made ? 12 : Math.min(Math.max(Math.round(input.regMonth), 1), 12);
  const ages = carAges(input.taxYear, baseYear, baseMonth);

  const period = (age: number): PeriodTax => {
    const reduction = input.kind === "cc" ? reductionRate(age) : 0; // 전기차 등은 차령 경감이 없음
    const half = baseAnnual / 2;
    const carTax = floor10(half - half * reduction);
    const eduTax = eduOf(carTax, input.kind);
    return { age, reduction, carTax, eduTax, total: carTax + eduTax };
  };
  const first = period(ages.first);
  const second = period(ages.second);
  const annualCarTax = first.carTax + second.carTax;

  // 연납 공제(제128조 제3항 표). 1·3월은 연세액, 6·9월은 2기분 세액을 기준으로 남은 기간만큼 공제합니다.
  const y = input.taxYear;
  const diy = daysInYear(y);
  const endOfMonthDay = (m: number) => {
    // 그 달 말일이 1월 1일부터 며칠째인지
    let d = 0;
    for (let i = 1; i <= m; i++) d += new Date(Date.UTC(y, i, 0)).getUTCDate();
    return d;
  };
  const prepayOf = (month: 1 | 3 | 6 | 9): PrepayOption => {
    let base: number, days: number, denominator: number;
    if (month === 1 || month === 3) {
      base = annualCarTax;
      days = diy - endOfMonthDay(month);
      denominator = diy;
    } else if (month === 6) {
      base = second.carTax;
      days = 184;
      denominator = 184;
    } else {
      base = second.carTax;
      days = diy - endOfMonthDay(9);
      denominator = 184;
    }
    const discount = Math.min(floor10((base * days * PREPAY_INTEREST) / denominator), floor10(base * 0.1));
    // 1·3월에 내는 자동차세: 연세액 − 공제, 6·9월에 내는 금액은 2기분 몫(1기분은 6월 정기분으로 따로 냄)
    const carTax = base - discount;
    const eduTax = eduOf(carTax, input.kind);
    return { month, base, days, denominator, discount, carTax, eduTax, total: carTax + eduTax };
  };

  const annualEduTax = first.eduTax + second.eduTax;
  return {
    baseAnnual,
    perCc,
    baseYear,
    baseMonth,
    first,
    second,
    annualCarTax,
    annualEduTax,
    annualTotal: annualCarTax + annualEduTax,
    lumpSumInJune: annualCarTax <= 100_000,
    firstYear: baseYear === input.taxYear,
    prepay: ([1, 3, 6, 9] as const).map(prepayOf),
  };
}
