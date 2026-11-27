import type { Guide } from "@/data/guides";
import { RATES } from "@/data/rates/2026";
import { calcSeverance } from "@/lib/calculators/severance";
import { netOf, taxSteps, safeFloor10, insuranceOf, MIN_WAGE_HISTORY, NEXT_MIN_WAGE } from "@/data/extras/a/helpers";
import { calcSocialInsurance, INDUSTRIAL_RATES, type SocialInsuranceResult } from "@/lib/calculators/socialInsurance";
import { convertWage } from "@/lib/calculators/wageConvert";
import { calcOvertime } from "@/lib/calculators/overtime";

// 묶음 a: 2026년 12월 공개 예약 가이드(퇴직금 중간정산, 성과급 세금, 단시간 근로자 4대보험, 기부금 세액공제,
// 맞벌이 연말정산, 성탄절·신정 휴일근로수당, 2027년 최저임금, 2027년 바뀌는 보험료).
// 표 안의 금액은 모두 사이트 계산기 함수와 아래 상수로 빌드할 때 계산합니다.

const n = (v: number) => Math.round(v).toLocaleString("ko-KR");
const won = (v: number) => `${n(v)}원`;
const man = (v: number) => `${n(v / 10_000)}만 원`;
// 1억 이상은 "1억 5,000만 원"처럼 보여 줍니다.
const krw = (v: number) => (v >= 100_000_000 ? `${Math.floor(v / 100_000_000)}억${v % 100_000_000 ? ` ${n((v % 100_000_000) / 10_000)}만` : ""} 원` : man(v));

// ───────────── 1. 퇴직금 중간정산 ─────────────
// 6개월 이상 요양 의료비 사유의 문턱: 근로자 본인 연간 임금총액의 1천분의 125를 넘게 부담한 경우.
// 출처: 근로자퇴직급여 보장법 시행령 제3조제1항제3호(https://www.law.go.kr/법령/근로자퇴직급여보장법시행령), 확인 2026-11-27
const MEDICAL_THRESHOLD = 125 / 1000;
const medicalLevels = [24_000_000, 36_000_000, 48_000_000, 60_000_000];

// 월급 전액이 통상임금이고 상여금·연차수당이 없는 사람의 법정 퇴직금(평균임금과 통상임금 중 큰 쪽)
const sevPay = (start: string, end: string, monthly: number) =>
  calcSeverance({ startDate: start, endDate: end, last3MonthsWage: monthly * 3, annualBonus: 0, annualLeavePay: 0, monthlyOrdinaryWage: monthly })!
    .severancePay;
const SEV_START = "2016-12-01"; // 입사일
const SEV_MID = "2026-12-01"; // 중간정산 기준일(10년 근속)
const SEV_END = "2031-12-01"; // 퇴직일(5년 더 근무)
const SEV_NOW_PAY = 3_000_000; // 중간정산 때 월급
const sevMid = sevPay(SEV_START, SEV_MID, SEV_NOW_PAY);
const sevCases = [3_000_000, 3_500_000, 4_000_000].map((last) => {
  const after = sevPay(SEV_MID, SEV_END, last);
  const whole = sevPay(SEV_START, SEV_END, last);
  return { last, after, split: sevMid + after, whole, gap: whole - (sevMid + after) };
});
const sevBig = sevCases[sevCases.length - 1];

// ───────────── 2. 연말 성과급 세금 ─────────────
// 연봉 실수령액 계산기(calcNetSalary)와 같은 조건(본인 1명, 식대 비과세 월 20만 원)으로 1년 세금·보험료를 구합니다.
// 국민연금은 성과급을 받은 해가 아니라 다음 해 7월부터 기준소득월액에 반영되므로 표에서 뺐습니다.
const yearOf = (annual: number) => {
  const r = netOf(annual);
  return { tax: (r.incomeTax + r.localTax) * 12, ins: (r.health + r.longTermCare + r.employment) * 12 };
};
const bonusDiff = (base: number, bonus: number) => {
  const a = yearOf(base);
  const b = yearOf(base + bonus);
  const tax = b.tax - a.tax;
  const ins = b.ins - a.ins;
  return { tax, ins, keep: bonus - tax - ins };
};
const BONUS_BASE = 40_000_000;
const bonusList = [2_000_000, 4_000_000, 6_000_000, 10_000_000];
const bonusRows = bonusList.map((b) => ({ b, ...bonusDiff(BONUS_BASE, b) }));
const BONUS_FIXED = 5_000_000;
const bonusBases = [30_000_000, 50_000_000, 70_000_000, 90_000_000];
const bonusByBase = bonusBases.map((base) => ({ base, ...bonusDiff(base, BONUS_FIXED) }));
const pctOf = (part: number, whole: number) => `${((part / whole) * 100).toFixed(1)}%`;
const bonusEx = bonusRows[1];
// 과세표준이 몇 번째 세율 구간에 있는지(성과급 전후 비교용)
const bracketOf = (annual: number) => RATES.incomeTax.brackets.findIndex((x) => taxSteps(annual).taxBase <= x.upTo);
const bonusMax = bonusList[bonusList.length - 1];
const bonusSameBracket = bracketOf(BONUS_BASE) === bracketOf(BONUS_BASE + bonusMax);
const bonusBracketRate = RATES.incomeTax.brackets[bracketOf(BONUS_BASE)].rate;
const bonusKeepMin = Math.min(...bonusRows.map((r) => r.keep / r.b));
const bonusKeepMax = Math.max(...bonusRows.map((r) => r.keep / r.b));
// 국민연금 기준소득월액 = 전년도 소득 ÷ 종사 일수 × 30(국민연금법 시행령 제7조), 천 원 미만 버림. 1년(365일) 근무 가정
const bonusPensionBase = Math.floor(((bonusEx.b / 365) * 30) / 1000) * 1000;
// 성과급에 붙는 건강보험료·장기요양보험료(근로자 부담, 2026년 요율)
const bonusHealth = safeFloor10(bonusEx.b * RATES.health.rate);
const bonusCare = safeFloor10(bonusHealth * RATES.longTermCare.rateOfHealth);

// ───────────── 3. 단시간 근로자 4대보험 ─────────────
// 국민연금·건강보험·고용보험의 단시간근로자 기준: 1개월 소정근로시간 60시간.
// 출처: 국민연금법 시행령 제2조, 국민건강보험법 시행령 제9조, 고용보험법 시행령 제3조(https://www.law.go.kr), 확인 2026-11-27
const PT_MONTHLY_HOURS = 60;
// 국민연금 단시간·일용근로자 소득 기준(보건복지부 장관 고시 금액).
// 출처: 국민연금공단 국민연금 제도 안내(https://nps.or.kr/pnsinfo/ntpsklg/getOHAF0097M0.do), 확인 2026-11-27
const NPS_PART_TIME_INCOME = 2_200_000;
const PT_WAGE = RATES.minimumWage;
const PT_INDUSTRY = INDUSTRIAL_RATES.find((x) => x.code === "910")!; // 도소매·음식·숙박업
const ptInsurance = (weekly: number) => {
  const pay = Math.round(convertWage("hourly", PT_WAGE, weekly).monthly);
  const r = calcSocialInsurance({ monthlyPay: pay, monthlyNonTaxable: 0, stability: "under150", industrialPermille: PT_INDUSTRY.permille });
  return { pay, r };
};
const rowOf = (r: SocialInsuranceResult, key: string) => r.rows.find((x) => x.key === key)!;
// 산재보험료와 함께 내는 부담금(임금채권부담금·석면피해구제분담금)까지 회사 몫으로 묶습니다.
const ptIndustrialOnly = (r: SocialInsuranceResult) => rowOf(r, "industrial").employer + rowOf(r, "wageClaim").employer + rowOf(r, "asbestos").employer;
type PtRow = { label: string; pay: number; pension: number; health: number; employment: number; employee: number; employer: number };
const ptShort = ptInsurance(10);
const ptRows: PtRow[] = [
  { label: "주 10시간, 3개월 미만", pay: ptShort.pay, pension: 0, health: 0, employment: 0, employee: 0, employer: ptIndustrialOnly(ptShort.r) },
  {
    label: "주 10시간, 3개월 이상 계속",
    pay: ptShort.pay,
    pension: 0,
    health: 0,
    employment: rowOf(ptShort.r, "unemployment").employee,
    employee: rowOf(ptShort.r, "unemployment").employee,
    employer: rowOf(ptShort.r, "unemployment").employer + rowOf(ptShort.r, "stability").employer + ptIndustrialOnly(ptShort.r),
  },
  ...[15, 20, 30, 40].map((w) => {
    const { pay, r } = ptInsurance(w);
    return {
      label: `주 ${w}시간`,
      pay,
      pension: rowOf(r, "pension").employee,
      health: rowOf(r, "health").employee + rowOf(r, "longTermCare").employee,
      employment: rowOf(r, "unemployment").employee,
      employee: r.employeeTotal,
      employer: r.employerTotal,
    };
  }),
];
const pt15 = ptRows[2];
// 두 곳에서 일하는 예: 주 10시간 + 주 8시간
const ptJobA = 10;
const ptJobB = 8;

// ───────────── 4. 기부금 세액공제와 고향사랑기부 ─────────────
// 일반·특례 기부금 세액공제율: 15%, 1천만 원 초과분 30%.
// 출처: 소득세법 제59조의4제4항(https://www.law.go.kr/법령/소득세법), 국세청 기부금 세액공제 안내, 확인 2026-11-27
const DON_RATE = 0.15;
const DON_RATE_HIGH = 0.3;
const DON_STEP = 10_000_000;
// 고향사랑 기부금: 10만 원 이하 110분의 100, 10만 원 초과 20만 원 이하 40%, 20만 원 초과 2천만 원 이하 15%(2026년 기부분부터).
// 출처: 조세특례제한법 제58조제1항·부칙(법률 제21223호) 제13조(https://www.law.go.kr/법령/조세특례제한법), 확인 2026-11-27
const HOME_FULL = 100_000;
const HOME_MID = 200_000;
const HOME_MID_RATE = 0.4;
const HOME_RATE = 0.15;
const HOME_LIMIT = 20_000_000; // 개인별 연간 상한(고향사랑기부금법 제8조제3항)
const HOME_GIFT = 0.3; // 답례품은 기부금액의 30% 한도(고향사랑기부금법 시행령 제5조, 고향사랑e음 안내)
// 정치자금 기부금: 10만 원까지 110분의 100, 초과분 15%(3천만 원 초과분 25%).
// 출처: 조세특례제한법 제76조제1항, 확인 2026-11-27
const POL_FULL = 100_000;
const POL_RATE = 0.15;
const POL_RATE_HIGH = 0.25;
const POL_STEP = 30_000_000;
const withLocal = (incomeTaxCredit: number) => incomeTaxCredit * (1 + RATES.localTaxRate); // 지방소득세(소득세의 10%)도 함께 줄어듦
const donGeneral = (v: number) => Math.min(v, DON_STEP) * DON_RATE + Math.max(0, v - DON_STEP) * DON_RATE_HIGH;
const donHome = (v: number) => {
  const x = Math.min(v, HOME_LIMIT);
  return Math.min(x, HOME_FULL) * (100 / 110) + Math.max(0, Math.min(x, HOME_MID) - HOME_FULL) * HOME_MID_RATE + Math.max(0, x - HOME_MID) * HOME_RATE;
};
const donPolitical = (v: number) =>
  Math.min(v, POL_FULL) * (100 / 110) + Math.max(0, Math.min(v, POL_STEP) - POL_FULL) * POL_RATE + Math.max(0, v - POL_STEP) * POL_RATE_HIGH;
const donAmounts = [100_000, 200_000, 300_000, 500_000, 1_000_000, 5_000_000, 10_000_000, 20_000_000];
const homeAmounts = [100_000, 200_000, 300_000, 500_000, 1_000_000];
const home50 = withLocal(donHome(500_000));
// 연봉별 1년 소득세(연봉 실수령액 계산기 기준, 본인 1명)
const donSalaryTax = [20_000_000, 25_000_000, 30_000_000].map((a) => ({ a, tax: netOf(a).incomeTax * 12 }));

// ───────────── 5. 맞벌이 부부 연말정산 ─────────────
// 의료비 세액공제: 총급여의 3%를 넘는 의료비의 15%. 출처: 소득세법 제59조의4제2항(https://www.law.go.kr/법령/소득세법), 확인 2026-11-27
const MED_THRESHOLD = 0.03;
const MED_RATE = 0.15;
// 신용카드 등 소득공제는 사용액이 총급여의 25%(최저사용금액)를 넘어야 시작. 출처: 조세특례제한법 제126조의2제1항, 확인 2026-11-27
const CARD_THRESHOLD = 0.25;
const MED_SPEND = 3_000_000;
const medIncomes = [25_000_000, 35_000_000, 50_000_000, 70_000_000, 90_000_000];
// 연봉 실수령액 계산기 기준 1년 소득세(본인 1명, 비과세 없음으로 총급여 = 연봉)
const yearIncomeTax = (gross: number, dependents = 1) => netOf(gross, 0, dependents).incomeTax * 12;
const medRows = medIncomes.map((g) => {
  const credit = Math.max(0, MED_SPEND - g * MED_THRESHOLD) * MED_RATE;
  const tax = yearIncomeTax(g);
  return { g, threshold: g * MED_THRESHOLD, credit, tax, usable: Math.min(credit, tax) };
});
const COUPLE_HIGH = 90_000_000;
const COUPLE_LOW = 35_000_000;
const medHigh = medRows.find((r) => r.g === COUPLE_HIGH)!;
const medLow = medRows.find((r) => r.g === COUPLE_LOW)!;
// 부양가족 1명을 기본공제(150만 원)로 더 받을 때 줄어드는 1년 소득세+지방소득세
const depIncomes = [30_000_000, 50_000_000, 70_000_000, 90_000_000];
const depRows = depIncomes.map((g) => {
  const a = netOf(g, 0, 1);
  const b = netOf(g, 0, 2);
  return { g, save: (a.incomeTax + a.localTax - b.incomeTax - b.localTax) * 12 };
});
// 부부 예시: 총급여 7,000만 원과 3,500만 원. 부모님 1명 기본공제와 아내 의료비 300만 원을 누가 받느냐에 따른 세금
const depSave = (g: number) => {
  const a = netOf(g, 0, 1);
  const b = netOf(g, 0, 2);
  return (a.incomeTax + a.localTax - b.incomeTax - b.localTax) * 12;
};
const coupleDepHigh = depSave(COUPLE_HIGH);
const coupleDepLow = depSave(COUPLE_LOW);
const coupleMedHigh = medHigh.usable * (1 + RATES.localTaxRate);
const coupleMedLow = medLow.usable * (1 + RATES.localTaxRate);
const coupleCases = [
  { dep: "높은 쪽", med: "높은 쪽", total: coupleDepHigh + coupleMedHigh },
  { dep: "높은 쪽", med: "낮은 쪽", total: coupleDepHigh + coupleMedLow },
  { dep: "낮은 쪽", med: "높은 쪽", total: coupleDepLow + coupleMedHigh },
  { dep: "낮은 쪽", med: "낮은 쪽", total: coupleDepLow + coupleMedLow },
];
const coupleBest = coupleCases.reduce((x, y) => (y.total > x.total ? y : x));

// ───────────── 6. 성탄절·신정 휴일근로수당 ─────────────
// 휴일근로 가산: 8시간 이내 통상임금의 50%, 8시간 초과 100%(근로기준법 제56조제2항). 계산은 연장·야간·휴일수당 계산기(calcOvertime)와 같습니다.
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const weekdayOf = (iso: string) => WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const XMAS = "2026-12-25";
const NEWYEAR = "2027-01-01";
const holWages = [RATES.minimumWage, 12_000, 15_000, 20_000];
const holPay = (wage: number, hours: number, fiveOrMore: boolean, night = 0) =>
  calcOvertime({ hourlyWage: wage, overtimeHours: 0, nightHours: night, holidayHours: Math.min(hours, 8), holidayOverHours: Math.max(0, hours - 8), fiveOrMore });
const holRows = holWages.map((w) => ({ w, h8: holPay(w, 8, true).total, h10: holPay(w, 10, true).total, small: holPay(w, 8, false).total }));
// 사례: 통상시급 12,000원, 성탄절 오후 1시~자정 근무(휴게 1시간 빼고 10시간, 그중 오후 10시~자정 2시간은 야간)
const HOL_EX_WAGE = 12_000;
const holEx = holPay(HOL_EX_WAGE, 10, true, 2);
// 월급제 예: 월급 250만 원이 모두 통상임금, 주 40시간(209시간)
const HOL_MONTHLY = 2_500_000;
const holMonthlyHourly = HOL_MONTHLY / 209;
const holMonthly8 = holPay(holMonthlyHourly, 8, true).total;

// ───────────── 7. 2027년 최저임금 ─────────────
// 2027년 최저임금 시간급 10,700원(helpers.ts의 NEXT_MIN_WAGE). 최저임금위원회 연도별 결정현황에서 다시 확인:
// 일급 85,600원(8시간), 월 2,236,300원(209시간), 인상률 3.7%(380원), 의결 2026.7.14, 고시 2026.8.5.
// 출처: https://www.minimumwage.go.kr/minWage/policy/decisionMain.do, 확인 2026-11-27
const MW_NOW = RATES.minimumWage;
const MW_NEXT = NEXT_MIN_WAGE;
const MW_DECIDED = "2026년 7월 14일";
const MW_NOTICED = "2026년 8월 5일";
// 수습 근로자 감액: 시간급 최저임금액에서 100분의 10을 뺀 금액(최저임금법 시행령 제3조), 확인 2026-11-27
const MW_PROBATION_CUT = 0.1;
const mwRise = MW_NEXT - MW_NOW;
const mwRate = mwRise / MW_NOW;
const mwWeekly = [10, 15, 20, 25, 30, 40];
const mwRows = mwWeekly.map((w) => {
  const a = convertWage("hourly", MW_NOW, w);
  const b = convertWage("hourly", MW_NEXT, w);
  return { w, hours: a.hours, now: a.monthly, next: b.monthly };
});
const mw40 = mwRows.find((r) => r.w === 40)!;
const mw10 = mwRows.find((r) => r.w === 10)!;
const mw15 = mwRows.find((r) => r.w === 15)!;
const MW_ANNUAL_EX = 26_000_000; // 연봉 예시
const mwAnnualHourly = MW_ANNUAL_EX / 12 / 209;
const mwHistory = MIN_WAGE_HISTORY.map((x, i, arr) => ({ ...x, rise: i > 0 ? (x.hourly - arr[i - 1].hourly) / arr[i - 1].hourly : null }));
// 2027년 인상률 이상이었던 가장 최근 해(2027년 제외)
const mwPrevBig = [...mwHistory].reverse().find((x) => x.year < RATES.year + 1 && x.rise !== null && x.rise >= mwRate);
const mwFirst = mwHistory[0];

// ───────────── 8. 2027년 바뀌는 급여·보험료 ─────────────
// 국민연금 사업장가입자 근로자 부담률(연도별). 2027년 1만분의 500 … 2032년 1만분의 625, 2033년부터 본칙 1천분의 65.
// 출처: 국민연금법 제88조제3항·부칙(법률 제20903호) 제4조제1항(https://www.law.go.kr/법령/국민연금법), 확인 2026-11-27
const PENSION_SCHEDULE: { year: number; employee: number }[] = [
  { year: 2026, employee: 475 / 10_000 },
  { year: 2027, employee: 500 / 10_000 },
  { year: 2028, employee: 525 / 10_000 },
  { year: 2029, employee: 550 / 10_000 },
  { year: 2030, employee: 575 / 10_000 },
  { year: 2031, employee: 600 / 10_000 },
  { year: 2032, employee: 625 / 10_000 },
  { year: 2033, employee: 65 / 1_000 },
];
const PENSION_2027 = PENSION_SCHEDULE.find((x) => x.year === 2027)!.employee;
// 2027년 건강보험료율 7.19%(올해와 같음), 2026.9.8 건강보험정책심의위원회 심의.
// 출처: 대한민국 정책브리핑(https://www.korea.kr/policy/civilView.do?newsId=156780681), 국민건강보험법 시행령 제44조(1만분의 719), 확인 2026-11-27
const HEALTH_TOTAL_2027 = 719 / 10_000;
const HEALTH_2027 = HEALTH_TOTAL_2027 / 2; // 근로자 부담
// 2027년 장기요양보험료율: 소득 대비 0.9994%(2026년 0.9448%), 건강보험료 대비 13.90%. 2026.10.30 장기요양위원회 의결.
// 출처: 대한민국 정책브리핑(https://www.korea.kr/news/policyNewsView.do?newsId=148974757), 확인 2026-11-27
const LTC_INCOME_2027 = 0.9994 / 100;
const LTC_INCOME_2026 = 0.9448 / 100;
const LTC_OF_HEALTH_2027 = LTC_INCOME_2027 / HEALTH_TOTAL_2027; // 장기요양보험료 = 건강보험료 × (장기요양보험료율 ÷ 건강보험료율)
const ins2027 = (pay: number) => {
  const base = Math.floor(Math.min(Math.max(pay, RATES.pension.minBase), RATES.pension.maxBase) / 1000) * 1000; // 2027년 6월까지 상·하한
  const pension = safeFloor10(base * PENSION_2027);
  const health = safeFloor10(pay * HEALTH_2027);
  const care = safeFloor10(health * LTC_OF_HEALTH_2027);
  return { pension, health, care, total: pension + health + care };
};
const chgPays = [2_500_000, 3_000_000, 4_000_000, Math.round(NEXT_MIN_WAGE * 209)];
const chgRows = chgPays.map((pay) => {
  const a = insuranceOf(pay);
  const b = ins2027(pay);
  return { pay, a: { pension: a.pension, health: a.health, care: a.longTermCare, total: a.pension + a.health + a.longTermCare }, b };
});
const chg300 = chgRows.find((r) => r.pay === 3_000_000)!;

export const guidesA: Guide[] = [
  {
    slug: "severance-interim-settlement",
    title: "퇴직금 중간정산 받을 수 있는 경우: 법정 사유 9가지, 필요 서류, 세금",
    description:
      "퇴직금 중간정산이 허용되는 9가지 법정 사유와 사유별 서류, 중간정산 뒤 퇴직금 계산 기간이 새로 시작되는 점, DC형 중도인출과의 차이, 세금을 정리했습니다.",
    date: "2026-12-02",
    tool: "severance-pay",
    sections: [
      {
        heading: "법에 적힌 사유가 있을 때만 받을 수 있습니다",
        body: [
          "퇴직금 중간정산은 무주택자의 주택 구입이나 전세 보증금, 6개월 이상 요양에 드는 의료비, 최근 5년 안의 파산선고·개인회생, 임금피크제나 근로시간 단축, 재난 피해처럼 근로자퇴직급여 보장법 시행령 제3조에 적힌 9가지 경우에만 받을 수 있습니다. 목돈이 필요하다거나 대출을 갚으려는 이유, 연봉제라서 해마다 정산해 왔다는 이유로는 받을 수 없습니다.",
          "중간정산이란 회사를 그만두기 전에 그때까지 일한 기간의 퇴직금을 미리 계산해 받는 것입니다. 법 제8조제2항은 이런 사유로 근로자가 요구하면 회사가 미리 정산해 '지급할 수 있다'고 정하고 있습니다. 사유가 있어도 회사가 꼭 응해야 한다고 적혀 있지는 않으므로, 회사의 취업규칙이나 퇴직금 규정에 절차가 있는지 먼저 확인하는 것이 좋습니다.",
          "중간정산은 회사가 퇴직금을 직접 주는 '퇴직금제도'에 있는 방식입니다. 퇴직연금에 가입한 회사라면 확정기여형(DC)은 '중도인출'이라는 별도 제도를 쓰고, 확정급여형(DB)에는 중도에 돈을 꺼내는 규정이 없습니다. 내 회사가 어느 제도인지에 따라 쓸 수 있는 방법이 다릅니다. 또 퇴직금 자체가 계속 일한 기간이 1년 이상이고 4주 평균 주 15시간 이상 일하는 근로자에게 생기므로(법 제4조제1항), 이 조건을 채우지 못하면 정산할 퇴직금도 없습니다.",
        ],
      },
      {
        heading: "중간정산 사유 9가지",
        body: [
          "시행령 제3조제1항에 적힌 사유를 쉬운 말로 옮기고, 같은 사유로 DC형 퇴직연금에서 중도인출을 할 수 있는지(시행령 제14조)를 함께 적었습니다.",
        ],
        table: {
          caption: "퇴직금 중간정산 사유와 DC형 중도인출 가능 여부",
          head: ["사유", "조건", "DC형 중도인출"],
          rows: [
            ["무주택자의 주택 구입", "근로자 본인 명의로 주택을 사는 경우", "가능"],
            ["무주택자의 전세금·보증금", "주거 목적으로 전세금이나 임차보증금을 부담하는 경우, 한 회사에 다니는 동안 1회", "가능(같은 1회 제한)"],
            ["6개월 이상 요양 의료비", `본인·배우자·부양가족의 질병·부상 의료비를 연간 임금총액의 ${(MEDICAL_THRESHOLD * 100).toFixed(1)}%보다 많이 부담`, "가능(같은 기준)"],
            ["파산선고", "신청일부터 거꾸로 5년 안에 파산선고를 받은 경우", "가능"],
            ["개인회생", "신청일부터 거꾸로 5년 안에 개인회생절차개시 결정을 받은 경우", "가능"],
            ["임금피크제", "정년을 늘리거나 보장하는 조건으로 나이·근속·임금액을 기준으로 임금을 줄이는 제도를 시행", "사유 아님"],
            ["합의로 근로시간 단축", "하루 1시간 또는 주 5시간 이상 줄이고, 줄인 시간으로 3개월 이상 일하기로 한 경우", "사유 아님"],
            ["법정 근로시간 단축", "2018년 근로기준법 개정(법률 제15513호)에 따른 근로시간 단축으로 퇴직금이 줄어드는 경우", "사유 아님"],
            ["재난 피해", "재난으로 피해를 입어 고용노동부 장관이 고시한 사유에 해당하는 경우", "가능"],
          ],
          note: "DC형에는 이 밖에 퇴직연금을 담보로 받은 대출의 원리금을 갚는 경우(고용노동부 고시 사유)가 있습니다. 근거: 근로자퇴직급여 보장법 시행령 제3조, 제14조.",
        },
        after: [
          "임금피크제와 근로시간 단축이 중간정산 사유인 이유는 퇴직금 계산 방식에 있습니다. 퇴직금은 퇴직 직전 3개월 임금으로 정하는데, 임금이 줄어든 뒤에 퇴직하면 그동안 일한 기간 전체가 줄어든 임금으로 계산됩니다. 임금이 줄기 전에 정산해 두면 그때까지의 기간은 줄기 전 임금으로 확정됩니다. DC형은 해마다 그해 임금총액을 기준으로 부담금이 쌓이기 때문에, 임금이 줄어도 이미 쌓인 돈이 줄지 않아 이 사유가 없습니다.",
        ],
      },
      {
        heading: "사유별로 챙기는 서류",
        body: [
          "어떤 서류를 내야 하는지는 법령에 정해져 있지 않습니다. 다만 회사는 중간정산을 해 준 경우 근로자가 퇴직한 뒤 5년이 되는 날까지 관련 증명 서류를 보관해야 해서(시행령 제3조제2항), 사유를 확인할 서류를 요구합니다. 고용노동부는 상담 답변에서 아래와 같은 서류로 확인하도록 안내하고 있습니다.",
          "주택 구입은 무주택 여부와 구입 사실을 함께 확인합니다. 무주택 여부는 지금 사는 곳의 주민등록등본, 건물등기부등본이나 건축물관리대장, 재산세 과세(또는 미과세) 증명서로 봅니다. 구입 사실은 등기 전이면 매매계약서 사본(분양이면 분양계약서), 등기 후면 산 주택의 등기부등본으로 봅니다. 무주택 여부는 주택공급에 관한 규칙 제53조의 기준으로 판단하며, 신청일에 본인 명의로 등기된 주택이 없으면 무주택자로 봅니다. 신청은 매매계약을 맺은 날부터 소유권 이전 등기 후 1개월 안에 할 수 있고, 이때 등기일은 등기 접수일을 기준으로 한다고 안내합니다.",
          "6개월 이상 요양은 병명과 치료 기간이 드러나는 의사의 진단서나 소견서, 또는 건강보험공단의 장기요양인정서, 치료비 영수증을 냅니다. 여기서 요양은 입원·통원·약물치료처럼 치료 방법을 가리지 않고, 신청 시점에 앞으로 6개월이 남지 않았더라도 그전부터 이어서 치료해 전체 기간이 6개월 이상이면 된다고 봅니다. 가족의 요양이면 가족관계증명서처럼 배우자·부양가족임을 보여 주는 서류가 더 필요합니다. 요양이 끝난 뒤에 신청할 때는 요양 종료일부터 1개월 안에 해야 한다고 안내합니다. 파산·개인회생은 법원의 선고나 개시 결정 날짜를 확인할 수 있는 서류가 필요합니다.",
        ],
        table: {
          caption: "연간 임금총액별 의료비 기준(이 금액을 넘게 부담해야 요양 사유 해당)",
          head: ["연간 임금총액", `기준(${(MEDICAL_THRESHOLD * 100).toFixed(1)}%)`, "월로 나누면"],
          rows: medicalLevels.map((v) => [man(v), won(v * MEDICAL_THRESHOLD), won((v * MEDICAL_THRESHOLD) / 12)]),
          note: "근로자 본인의 연간 임금총액 기준입니다. 가족의 의료비라도 근로자가 실제로 부담한 금액으로 따집니다.",
        },
      },
      {
        heading: "중간정산하면 계산 기간이 새로 시작됩니다",
        body: [
          "법 제8조제2항 뒷부분은 중간정산 뒤의 퇴직금을 계산할 계속근로기간은 '정산시점부터 새로 계산한다'고 정하고 있습니다. 앞 기간의 퇴직금은 중간정산 때의 임금으로 끝나고, 나중에 퇴직할 때는 정산 뒤의 기간만 퇴직 직전 임금으로 계산합니다.",
          `아래는 ${SEV_START.slice(0, 4)}년 12월에 입사해 10년을 일한 직원이 월급 ${man(SEV_NOW_PAY)}일 때 중간정산을 받고 5년 더 일한 뒤 퇴직하는 경우와, 중간정산 없이 15년을 채우고 퇴직하는 경우를 비교한 것입니다. 중간정산 때 받는 금액은 ${won(sevMid)}입니다.`,
        ],
        table: {
          caption: `10년 차에 중간정산을 받은 경우와 받지 않은 경우의 퇴직금 합계(퇴직일 ${SEV_END.slice(0, 4)}년 12월 1일)`,
          head: ["퇴직 때 월급", "중간정산 받음(10년분 + 5년분)", "중간정산 안 받음(15년분)", "차이"],
          rows: sevCases.map((c) => [
            man(c.last),
            `${won(c.split)} (${won(sevMid)} + ${won(c.after)})`,
            won(c.whole),
            c.gap < 100 ? `${won(c.gap)}(원 미만 버림 차이)` : won(c.gap),
          ]),
          note: "퇴직금 계산기와 같은 식(1일 평균임금과 1일 통상임금 중 큰 쪽 × 30일 × 재직일수 ÷ 365)으로 계산했습니다. 월급 전액이 통상임금이고 상여금·연차수당은 없다고 가정했습니다. 세전 금액이며, 미리 받은 돈을 굴려 얻는 이익은 넣지 않았습니다.",
        },
        after: [
          `퇴직 때 월급이 지금과 같다면 두 방법의 합계는 거의 같습니다. 월급이 오를수록 차이가 커져, 퇴직 때 월급이 ${man(sevBig.last)}이면 중간정산을 받은 쪽이 ${won(sevBig.gap)} 적습니다. 앞 10년분이 오르기 전 월급으로 굳어지기 때문입니다. 반대로 임금피크제처럼 임금이 줄어드는 경우에는 미리 정산하는 쪽이 유리해집니다. 주택 구입이나 전세금처럼 목돈이 필요한 경우라면, 중간정산으로 대출을 덜 받아 아끼는 이자와 표의 차이를 함께 놓고 비교해 보는 것이 좋습니다.`,
          "퇴직금 계산기로 중간정산 뒤의 퇴직금을 볼 때는 입사일 칸에 실제 입사일이 아니라 중간정산 기준일을 넣어야 합니다. 중간정산 금액 자체를 미리 가늠할 때는 퇴직일 칸에 정산 기준일을 넣으면 됩니다.",
        ],
      },
      {
        heading: "DC형 퇴직연금 중도인출과 다른 점",
        body: [
          "DC형은 회사가 1년에 한 번 이상 연간 임금총액의 12분의 1 이상을 근로자 이름의 DC형 계정에 넣고(법 제20조), 근로자가 운용 방법을 직접 고르는 방식입니다(법 제21조). 법 제22조는 DC형 가입자가 주택 구입 등 시행령에서 정한 사유가 생기면 적립금을 중도인출할 수 있다고 정합니다. 회사가 주는 돈이 아니라 내 계정에서 꺼내는 돈이라, 계정을 맡은 퇴직연금사업자(금융회사)를 통해 처리합니다.",
          "가장 큰 차이는 계산 기간입니다. 중간정산은 앞 기간을 끝내고 새로 세지만, DC형 중도인출은 쌓인 돈의 일부를 꺼내는 것이라 근속 기간을 다시 세지 않습니다. 대신 꺼낸 만큼 앞으로의 운용 수익도 줄어듭니다. 사유도 조금 다릅니다. 앞의 표처럼 임금피크제와 근로시간 단축은 DC형 중도인출 사유가 아닙니다.",
          "DB형은 퇴직 때 받을 금액이 퇴직금과 같은 방식으로 미리 정해져 있습니다. 법에 DB형 중도인출 조항은 없고, 주택 구입 같은 사유가 있을 때 퇴직연금을 받을 권리를 담보로 대출을 받는 방법(법 제7조제2항)만 있습니다.",
        ],
      },
      {
        heading: "세금은 퇴직소득세로 냅니다",
        body: [
          "소득세법 시행령 제43조제2항은 근로자퇴직급여 보장법 시행령 제3조의 사유로 퇴직급여를 미리 받으면 '그 지급받은 날에 퇴직한 것으로 본다'고 정합니다. 그래서 중간정산금은 근로소득이 아니라 퇴직소득이고, 회사가 퇴직소득세를 떼고 줍니다. 근로소득처럼 다음 해 연말정산에 합쳐지지 않습니다.",
          "퇴직소득세는 근속연수가 길수록 공제가 커지는 구조라, 근속을 둘로 나누면 각각 따로 계산되어 세금이 달라질 수 있습니다. 소득세법 제148조는 퇴직할 때 같은 근로계약에서 이미 받은 퇴직소득의 원천징수영수증을 내면 둘을 합쳐 세금을 다시 정산하도록 하고 있습니다. 중간정산 때 받은 원천징수영수증을 버리지 말고 보관하세요. 합치는 쪽이 유리한지는 금액에 따라 다르므로 퇴직 때 회사에 두 경우를 함께 계산해 달라고 하는 것이 좋습니다.",
          "DC형 중도인출의 세금은 퇴직연금사업자가 떼고 지급하며, 인출 사유와 적립금의 성격(회사 부담금, 운용 수익, 본인이 더 넣은 돈)에 따라 계산이 달라집니다. 신청 전에 금융회사에 예상 세액을 물어보세요.",
        ],
      },
      {
        heading: "신청 전에 확인할 것",
        body: [
          "첫째, 내 회사가 퇴직금제도인지, DB형·DC형 퇴직연금인지 확인합니다. 둘째, 사유가 시행령에 적힌 9가지에 들어가는지, 신청 기한(주택 구입은 등기 후 1개월, 요양 종료 후 신청은 종료일부터 1개월)을 넘기지 않았는지 봅니다. 셋째, 전세금 사유는 한 회사에서 한 번뿐이므로 지금 쓰는 것이 맞는지 따져 봅니다.",
          "법정 사유가 없으면 근로자가 원해도 회사가 중간정산을 해 줄 수 없습니다. 회사가 사유 확인 없이 해마다 퇴직금을 정산해 준다면 법에 정한 방식이 아니므로 담당자에게 근거를 물어보는 것이 좋습니다.",
          "받을 금액은 퇴직금 계산기에 입사일(이미 중간정산을 받았다면 그 기준일)과 정산 기준일, 최근 3개월 임금을 넣어 대략 확인할 수 있습니다. 실제 지급 여부와 금액, 세금은 회사 규정과 개인 사정에 따라 달라지므로 회사 담당자나 관할 지방고용노동관서에 확인하세요.",
        ],
      },
    ],
    sources: [
      { label: "국가법령정보센터 – 근로자퇴직급여 보장법(제7조, 제8조, 제22조)", url: "https://www.law.go.kr/법령/근로자퇴직급여보장법" },
      { label: "국가법령정보센터 – 근로자퇴직급여 보장법 시행령(제3조, 제14조)", url: "https://www.law.go.kr/법령/근로자퇴직급여보장법시행령" },
      { label: "국가법령정보센터 – 소득세법 시행령(제43조 퇴직판정의 특례)", url: "https://www.law.go.kr/법령/소득세법시행령" },
      {
        label: "고용노동부 빠른인터넷상담 – 무주택자 주택구입 중간정산·중도인출 증빙서류",
        url: "https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202409260511166040927",
      },
      {
        label: "고용노동부 빠른인터넷상담 – 6개월 이상 요양 사유 필요 서류",
        url: "https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202405271042308860373",
      },
    ],
  },
  {
    slug: "year-end-bonus-tax",
    title: "연말 성과급 세금은 얼마나 붙을까: 원천징수 방식과 4대보험 반영 시기",
    description:
      "성과급도 근로소득이라 소득세와 4대보험이 붙습니다. 성과급을 줄 때 세금을 떼는 방식, 국민연금·건강보험에 반영되는 시기, 연봉별로 1년 세금이 얼마나 늘어나는지 계산했습니다.",
    date: "2026-12-04",
    tool: "net-salary",
    sections: [
      {
        heading: "성과급도 월급과 같은 근로소득입니다",
        body: [
          `연봉 ${man(BONUS_BASE)}인 직장인이 연말 성과급 ${man(bonusEx.b)}을 받으면 1년 소득세와 지방소득세가 약 ${won(bonusEx.tax)}, 건강보험·장기요양보험·고용보험료가 약 ${won(bonusEx.ins)} 늘어 성과급 가운데 약 ${won(bonusEx.keep)}(${pctOf(bonusEx.keep, bonusEx.b)})이 남습니다. 연봉 실수령액 계산기와 같은 방식으로 계산한 값이고, 국민연금은 다음 해 7월부터 반영되므로 따로 설명합니다.`,
          "소득세법 제20조제1항은 근로를 제공하고 받는 봉급·급료·임금·상여·수당과 이와 비슷한 급여를 모두 근로소득으로 정합니다. 성과급, 인센티브, 상여금처럼 이름이 달라도 회사가 일한 대가로 주는 돈이면 근로소득이고, 1년 총급여에 합쳐져 세금이 계산됩니다. 주주총회 같은 의결기관의 결의로 받는 상여도 근로소득에 들어갑니다.",
          "4대보험도 마찬가지입니다. 건강보험의 보수에는 봉급·임금·상여·수당이 들어가고 퇴직금과 비과세 근로소득만 빠집니다(국민건강보험법 시행령 제33조). 다만 보험료가 실제로 늘어나는 시기는 보험마다 다릅니다. 세금은 그해에 바로 붙지만, 국민연금과 건강보험은 대개 다음 해에 반영됩니다.",
        ],
      },
      {
        heading: "성과급을 줄 때 떼는 세금은 이렇게 계산합니다",
        body: [
          "회사는 성과급을 줄 때 소득세를 미리 떼서(원천징수) 냅니다. 소득세법 제136조는 상여의 원천징수를 '지급대상기간'으로 나눠 계산하도록 정합니다. 성과급을 지급대상기간의 개월 수로 나눈 금액을 그 기간의 월평균 급여에 더하고, 이 금액에 근로소득 간이세액표를 적용한 세액에 개월 수를 곱한 뒤, 그 기간에 이미 뗀 세금을 뺍니다.",
          `지급대상기간이 정해져 있지 않은 상여는 그해 1월 1일부터 상여를 받은 달까지를 지급대상기간으로 봅니다. 그해에 처음 받는 성과급을 12월에 받으면 12개월로 나눠 계산하는 셈이라, 한 달 급여에 한꺼번에 얹어 계산할 때보다 떼는 세금이 고르게 나옵니다. 그해 두 번째 상여라면 직전 상여를 받은 다음 달부터 이번 달까지가 지급대상기간입니다. 기간이 1년을 넘으면 1년으로 봅니다. 예를 들어 월급 약 ${won(BONUS_BASE / 12)}인 사람이 12월에 그해 첫 성과급 ${man(bonusEx.b)}을 받으면, 성과급을 12로 나눈 약 ${won(bonusEx.b / 12)}을 월급에 더한 약 ${won((BONUS_BASE + bonusEx.b) / 12)}으로 간이세액표 세액을 찾아 12를 곱하고, 그해 이미 뗀 세금을 뺀 만큼을 성과급에서 뗍니다.`,
          "이렇게 뗀 세금은 확정된 세금이 아닙니다. 회사는 다음 해 2월분 급여를 줄 때 1년 근로소득 전체로 세금을 다시 계산하는 연말정산을 합니다(소득세법 제137조). 성과급 때 떼인 세금이 많았으면 돌려받고, 적었으면 더 냅니다. 연말정산 때 한꺼번에 더 내는 것이 부담스럽다면 간이세액표 세액의 80%·100%·120% 가운데 원천징수 비율을 골라 회사에 신청할 수도 있습니다(소득세법 시행령 제194조).",
        ],
      },
      {
        heading: "성과급 크기별로 늘어나는 1년 세금",
        body: [
          `연봉 ${man(BONUS_BASE)}에 성과급을 더했을 때 1년 동안 늘어나는 세금과 보험료를 연봉 실수령액 계산기와 같은 식으로 계산했습니다. 성과급이 없는 연봉과 성과급을 더한 연봉을 각각 계산해 차이를 구했습니다.`,
        ],
        table: {
          caption: `연봉 ${man(BONUS_BASE)} 직장인이 성과급을 받을 때 1년 동안 늘어나는 금액`,
          head: ["성과급", "소득세+지방소득세", "건강·장기요양·고용보험", "손에 남는 금액", "남는 비율"],
          rows: bonusRows.map((r) => [man(r.b), won(r.tax), won(r.ins), won(r.keep), pctOf(r.keep, r.b)]),
          note: `본인 1명, 자녀 없음, 식대 비과세 월 ${man(RATES.incomeTax.mealTaxFreeLimit)} 기준의 추정입니다. ${RATES.year}년 요율이며 국민연금은 뺐습니다. 실제 세금은 연말정산 때 카드·의료비·부양가족 공제 등에 따라 달라집니다.`,
        },
        after: [
          bonusSameBracket
            ? `연봉 ${man(BONUS_BASE)}에서는 성과급이 ${man(bonusList[0])}이든 ${man(bonusMax)}이든 남는 비율이 ${pctOf(bonusKeepMin, 1)}~${pctOf(bonusKeepMax, 1)}로 거의 같습니다. 성과급을 더해도 과세표준이 같은 세율 구간(${bonusBracketRate * 100}%) 안에 머물기 때문입니다. 성과급은 원래 연봉 위에 얹히므로 연봉에 이미 적용되던 가장 높은 세율부터 붙고, 금액이 커서 다음 구간으로 넘어가면 그 부분부터 세율이 올라갑니다.`
            : `연봉 ${man(BONUS_BASE)}에서는 성과급이 커질수록 남는 비율이 ${pctOf(bonusKeepMax, 1)}에서 ${pctOf(bonusKeepMin, 1)}로 줄어듭니다. 성과급은 원래 연봉 위에 얹히므로 연봉에 이미 적용되던 가장 높은 세율부터 붙고, 금액이 커서 다음 세율 구간으로 넘어가면 그 부분부터 세율이 올라가기 때문입니다.`,
          "보험료는 요율이 일정해 성과급에 거의 비례해 늘어납니다. 국민연금까지 생각하면 실제로 남는 돈은 이 표보다 조금 적지만, 국민연금은 성과급을 받은 해가 아니라 다음 해 7월부터 1년에 걸쳐 나뉘어 빠지고 그만큼 연금 가입 기록에도 쌓입니다.",
        ],
      },
      {
        heading: "연봉이 높을수록 같은 성과급에 세금이 더 붙습니다",
        body: [
          `같은 성과급 ${man(BONUS_FIXED)}이라도 원래 연봉에 따라 늘어나는 세금이 다릅니다. ${RATES.year}년 소득세 세율은 과세표준 ${man(RATES.incomeTax.brackets[0].upTo)} 이하 ${RATES.incomeTax.brackets[0].rate * 100}%, ${man(RATES.incomeTax.brackets[1].upTo)} 이하 ${RATES.incomeTax.brackets[1].rate * 100}%, ${man(RATES.incomeTax.brackets[2].upTo)} 이하 ${RATES.incomeTax.brackets[2].rate * 100}%, ${krw(RATES.incomeTax.brackets[3].upTo)} 이하 ${RATES.incomeTax.brackets[3].rate * 100}%처럼 올라가고, 지방소득세가 소득세의 ${RATES.localTaxRate * 100}%로 더 붙습니다.`,
        ],
        table: {
          caption: `연봉별로 성과급 ${man(BONUS_FIXED)}을 받을 때 1년 동안 늘어나는 금액`,
          head: ["원래 연봉", "소득세+지방소득세", "성과급 대비 세금", "건강·장기요양·고용보험", "손에 남는 금액"],
          rows: bonusByBase.map((r) => [man(r.base), won(r.tax), pctOf(r.tax, BONUS_FIXED), won(r.ins), won(r.keep)]),
          note: "앞 표와 같은 조건입니다. 총급여가 늘면 근로소득세액공제 한도가 줄어드는 구간이 있어, 세율 구간만으로 계산한 값과 조금 다를 수 있습니다.",
        },
        after: [
          "연봉 계약이나 성과급 협상에서 '성과급 500만 원'이 손에 얼마로 남는지는 이렇게 원래 연봉에 따라 달라집니다. 연봉 실수령액 계산기에 성과급을 뺀 연봉과 더한 연봉을 차례로 넣으면 내 조건에서의 차이를 바로 볼 수 있습니다.",
        ],
      },
      {
        heading: "국민연금은 다음 해 7월부터 반영됩니다",
        body: [
          "직장인의 국민연금 보험료는 매달 받는 월급이 아니라 '기준소득월액'에 요율을 곱해 정합니다. 국민연금법 시행령 제7조는 가입 중인 직장인의 기준소득월액을 전년도에 그 회사에서 받은 소득을 일한 날수로 나눈 뒤 30을 곱해 매년 정하고, 그 금액을 그해 7월부터 다음 해 6월까지 쓰도록 정합니다.",
          `그래서 ${RATES.year}년 12월에 받은 성과급은 받는 달의 국민연금 보험료를 바꾸지 않습니다. ${RATES.year}년 소득에 합쳐져 ${RATES.year + 1}년 7월부터 1년 동안의 기준소득월액을 올립니다. 1년 내내 근무했다면 성과급 ${man(bonusEx.b)}은 기준소득월액을 약 ${won(Math.floor((bonusEx.b / 365) * 30 / 1000) * 1000)} 올리는 효과가 있습니다. 늘어나는 보험료는 이 금액에 그때의 근로자 부담률을 곱한 만큼이고, 회사도 같은 금액을 더 냅니다.`,
          `기준소득월액에는 상한이 있습니다. ${RATES.year}년 7월부터 ${RATES.year + 1}년 6월까지의 상한은 ${won(RATES.pension.maxBase)}이고, 상한은 해마다 새로 고시됩니다. 이미 상한보다 많이 버는 사람은 성과급을 받아도 국민연금 보험료가 늘지 않습니다. 더 내는 보험료는 그만큼 연금 계산의 기준이 되는 소득에도 반영됩니다.`,
        ],
      },
      {
        heading: "건강보험·고용보험은 다음 해에 정산됩니다",
        body: [
          "건강보험료는 해마다 전년도 보수를 기준으로 먼저 매기고, 실제 보수가 확정되면 다시 계산해 차액을 정산합니다. 회사는 다음 해 3월까지 전년도에 준 보수 총액을 공단에 알리고(국민건강보험법 시행령 제35조), 공단은 다시 계산한 보험료와 이미 걷은 보험료의 차이만큼 더 걷거나 돌려줍니다(제39조). 보건복지부는 이 정산을 매년 4월에 하는 '건강보험료 연말정산'이라고 설명합니다.",
          `그래서 ${RATES.year}년 12월 성과급에 붙는 건강보험료와 장기요양보험료는 대개 ${RATES.year + 1}년 4월 정산 때 한꺼번에 나옵니다. 성과급 ${man(bonusEx.b)}이라면 건강보험료 약 ${won(bonusHealth)}과 장기요양보험료 약 ${won(bonusCare)}이 더해지는 셈입니다. 4월 급여에서 평소보다 보험료가 많이 빠지는 이유가 이것입니다. 직장가입자가 더 낼 금액이 일정 금액 이상이면 회사가 신청해 12회 이내로 나눠 낼 수 있습니다(제39조제4항). 중간에 회사를 그만두면 4월을 기다리지 않고, 회사가 퇴사할 때 그해 보험료를 다시 계산해 마지막 급여에서 정산합니다(제39조제2항).`,
          "다만 상시 100명 이상 사업장은 보수가 오르거나 내리면 공단에 보수월액 변경을 신청해야 하고(시행령 제36조제2항), 공단은 보수가 바뀐 달부터 보수월액을 바꿀 수 있습니다. 회사에 따라 정산을 기다리지 않고 미리 반영되기도 합니다. 고용보험도 회사가 다음 해 3월 15일까지 전년도 보수 총액을 신고하면 실제 보수로 다시 계산해 정산합니다(고용보험료징수법 제16조의9, 제16조의10).",
        ],
      },
      {
        heading: "성과급을 받기 전후에 확인할 것",
        body: [
          "성과급은 연말정산의 '총급여'도 키웁니다. 의료비 세액공제는 총급여의 3%를 넘게 쓴 의료비부터 공제하므로(소득세법 제59조의4), 성과급으로 총급여가 늘면 공제가 시작되는 문턱도 함께 올라갑니다. 연말정산 결과를 미리 가늠할 때는 성과급을 더한 총급여로 계산해야 합니다.",
          "급여명세서에서 성과급 달의 소득세가 평소보다 크게 빠졌다고 해서 그만큼 세금이 늘어난 것은 아닙니다. 지급대상기간 방식으로 미리 뗀 금액일 뿐이고, 실제 세금은 다음 해 2월 연말정산에서 확정됩니다. 반대로 성과급 때 적게 뗐다면 연말정산에서 더 낼 수 있습니다. 연봉 실수령액 계산기는 연봉을 12개월에 고르게 나눠 계산하므로 성과급을 받은 달의 명세서와는 다르게 나오고, 1년 합계를 비교하는 용도로 보는 것이 맞습니다.",
          "성과급 금액과 지급 시기, 원천징수 방식은 회사마다 다르고 개인의 공제 항목에 따라 세금도 달라지므로, 정확한 금액은 회사 급여 담당자에게 확인하세요.",
        ],
      },
    ],
    sources: [
      { label: "국가법령정보센터 – 소득세법(제20조 근로소득, 제136조 상여 등에 대한 징수세액, 제137조 연말정산)", url: "https://www.law.go.kr/법령/소득세법" },
      { label: "국가법령정보센터 – 국민연금법 시행령(제7조 기준소득월액의 결정)", url: "https://www.law.go.kr/법령/국민연금법시행령" },
      { label: "국가법령정보센터 – 국민건강보험법 시행령(제33조, 제35조, 제36조, 제39조)", url: "https://www.law.go.kr/법령/국민건강보험법시행령" },
      { label: "보건복지부 보도자료 – 직장가입자 건강보험료 연말정산 시 5회 분할납부", url: "https://mohw.go.kr/board.es?act=view&bid=0027&list_no=344191&mid=a10503010100&nPage=583&tag=" },
      { label: "국가법령정보센터 – 고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률(제16조의9, 제16조의10)", url: "https://www.law.go.kr/법령/고용보험및산업재해보상보험의보험료징수등에관한법률" },
    ],
  },
  {
    slug: "part-time-social-insurance",
    title: "아르바이트·단시간 근로자 4대보험 가입 기준: 주 15시간, 월 60시간, 3개월",
    description:
      "국민연금·건강보험·고용보험·산재보험이 아르바이트와 단시간 근로자에게 언제 적용되는지 공단 기준으로 정리하고, 주당 근무 시간별 월 보험료를 계산했습니다.",
    date: "2026-12-10",
    tool: "social-insurance",
    sections: [
      {
        heading: "한 달 소정근로시간 60시간이 첫 기준입니다",
        body: [
          `아르바이트도 근로계약으로 정한 근로시간(소정근로시간)이 한 달 ${PT_MONTHLY_HOURS}시간 이상이고 1개월 넘게 일하면 국민연금·건강보험·고용보험에 모두 가입합니다. ${RATES.year}년 최저시급 ${won(PT_WAGE)}으로 주 15시간 일하면 주휴수당을 포함한 월급이 약 ${won(pt15.pay)}이고, 여기서 4대보험료로 약 ${won(pt15.employee)}이 빠집니다. 산재보험은 근로시간과 상관없이 적용되고 보험료는 회사만 냅니다.`,
          `국민연금공단은 이 기준을 '월 ${PT_MONTHLY_HOURS}시간(주 15시간)'으로 안내합니다. 그래서 흔히 주 15시간을 기준으로 말하지만, 법령의 기준은 보험마다 조금씩 다릅니다. 국민연금과 건강보험은 월 ${PT_MONTHLY_HOURS}시간을 보고, 고용보험은 월 ${PT_MONTHLY_HOURS}시간 미만이거나 주 15시간 미만이면 원칙적으로 빠집니다. 여기에 일한 기간(1개월, 3개월)과 일용직 여부에 따른 예외가 붙습니다. 일용근로자는 근로시간과 관계없이 고용보험이 적용됩니다.`,
          "기준이 되는 시간은 실제로 일한 시간이 아니라 근로계약서에 적은 시간입니다. 계약은 주 10시간인데 실제로는 매주 20시간씩 일한다면 계약 내용과 실제 근무가 맞지 않는 것이므로, 근로계약서를 실제 근무에 맞게 다시 쓰는 것이 먼저입니다.",
        ],
      },
      {
        heading: "근무 형태별 가입 여부",
        body: ["아래 표는 공단 안내와 법령의 기준을 근무 형태별로 정리한 것입니다. 국민연금은 18세 이상 60세 미만만 가입 대상이라는 점도 함께 기억해 두세요."],
        table: {
          caption: "근무 형태별 4대보험 가입 여부(근로자 기준)",
          head: ["근무 형태", "국민연금", "건강보험", "고용보험", "산재보험"],
          rows: [
            ["월 60시간 이상, 1개월 이상 근무", "가입", "가입", "가입", "적용"],
            ["월 60시간 미만, 3개월 미만", `미가입(월 소득 ${man(NPS_PART_TIME_INCOME)} 이상이면 가입)`, "미가입", "미가입", "적용"],
            ["월 60시간 미만, 3개월 이상 계속", "본인이 원하고 회사가 동의하면 가입", "미가입", "가입", "적용"],
            ["일용직, 1개월 미만", "미가입", "미가입", "가입", "적용"],
            ["일용직, 1개월 이상이고 월 8일 이상", "가입", "가입", "가입", "적용"],
          ],
          note: `근거: 국민연금법 시행령 제2조와 국민연금공단 안내(소득 기준 ${man(NPS_PART_TIME_INCOME)}은 보건복지부 고시 금액), 국민건강보험법 제6조·시행령 제9조와 공단 해설, 고용보험법 시행령 제3조, 산업재해보상보험법 제6조. 2026년 11월 확인 기준입니다.`,
        },
        after: [
          "직장 건강보험에 가입하지 않는다고 건강보험이 없어지는 것은 아닙니다. 부모 등 가족의 피부양자이거나, 그렇지 않으면 지역가입자로 보험료를 따로 냅니다. 국민연금도 사업장가입자가 아니면 소득에 따라 지역가입자가 될 수 있고, 소득이 없더라도 본인이 원하면 임의가입자로 가입할 수 있습니다. 어느 쪽이든 회사가 보험료를 나눠 내 주는 것은 사업장가입자일 때뿐입니다.",
        ],
      },
      {
        heading: "국민연금: 월 60시간, 월 8일, 월 소득 220만 원",
        body: [
          `국민연금법 시행령 제2조는 1개월 소정근로시간이 ${PT_MONTHLY_HOURS}시간 미만인 단시간근로자와, 1개월 미만으로 일하는 일용근로자를 사업장가입자에서 뺍니다. 국민연금공단은 이를 단시간 근로자는 고용 기간 1개월 이상에 월 ${PT_MONTHLY_HOURS}시간 이상이거나 월 소득이 ${man(NPS_PART_TIME_INCOME)} 이상이면, 일용근로자는 1개월 이상 일하면서 한 달에 8일 이상 또는 ${PT_MONTHLY_HOURS}시간 이상 일하거나 월 소득이 ${man(NPS_PART_TIME_INCOME)} 이상이면 사업장가입자로 가입해야 한다고 안내합니다. 소득 기준은 보건복지부 고시 금액이라 바뀔 수 있습니다. 사업장가입자가 되면 보험료(${RATES.year}년 기준소득월액의 ${(RATES.pension.rate * 200).toFixed(1)}%)의 절반을 회사가 내고, 지역가입자는 같은 보험료를 본인이 모두 냅니다.`,
          `월 ${PT_MONTHLY_HOURS}시간 미만이라도 3개월 이상 계속 일하면서 본인이 가입을 원하고 회사가 동의하면 가입할 수 있습니다. 여러 곳에서 일해 각 사업장의 소정근로시간을 합한 시간이 월 ${PT_MONTHLY_HOURS}시간 이상이면, 본인이 원할 때 회사 동의 없이 가입할 수 있다고 공단은 안내합니다. 또 공단은 2025년 7월부터 '1개월 이상'을 따지는 방법을 바꿔, 예를 들어 7월 10일에 일을 시작하면 예전처럼 8월 9일까지가 아니라 7월 31일을 기준으로 판단한다고 안내합니다.`,
        ],
      },
      {
        heading: "건강보험: 사업장마다 따로 봅니다",
        body: [
          `국민건강보험법 제6조는 고용 기간이 1개월 미만인 일용근로자를 직장가입자에서 빼고, 시행령 제9조는 비상근 근로자와 1개월 소정근로시간이 ${PT_MONTHLY_HOURS}시간 미만인 단시간근로자를 뺍니다. 국민연금과 달리 3개월 이상 일했다고 가입되는 예외는 없습니다. 근로자가 없거나 이런 단시간근로자만 고용한 사업장의 사업주도 직장가입자에서 빠집니다(시행령 제9조제4호).`,
          "공단 해설에 따르면 일용근로자는 처음 일한 날부터 마지막으로 일한 날까지가 1개월 이상이면서 한 달에 8일 이상 일하면 직장가입자로 봅니다. 또 직장가입자는 사업장 단위로 관리하므로, 두 곳에서 일하면 사업장마다 따로 60시간 미만인지 따집니다. 두 곳 모두 월 40시간씩이라면 합쳐서 80시간이어도 직장 건강보험에는 가입하지 않습니다. 평소 월 60시간 이상 일하다가 어느 한 달만 60시간에 못 미친 경우에는 근로관계가 이어지고 있으므로 계속 직장가입자로 둔다고 설명합니다.",
          "시간과 별개로 '비상근 근로자'도 직장가입자에서 빠집니다. 공단 해설은 근무일과 시간을 정하지 않고 사업장 필요에 따라 그때그때 일하고 일한 만큼 돈을 받는 사람을 비상근 근로자로 봅니다. 반대로 정해진 근무일마다 출근해 일정 시간 규칙적으로 일한다면 하루 8시간을 꽉 채우지 않아도 상근으로 볼 수 있다는 법원 판단도 함께 소개합니다.",
        ],
      },
      {
        heading: "고용보험과 산재보험",
        body: [
          "고용보험법 시행령 제3조는 1개월 소정근로시간이 60시간 미만이거나 1주 소정근로시간이 15시간 미만인 근로자를 고용보험 적용에서 뺍니다. 다만 같은 사업에서 3개월 이상 계속 일하는 근로자와 일용근로자는 시간이 짧아도 적용합니다. 그래서 주 10시간씩 일하는 아르바이트도 3개월 이상 계속 일하면 고용보험 적용 대상이 됩니다. 법인이 아닌 농업·임업·어업 사업으로 상시 근로자가 4명 이하인 곳은 고용보험 적용에서 빠지지만, 본인이 원하면 가입을 신청할 수 있습니다(같은 조 제3항).",
          "산재보험은 산업재해보상보험법 제6조에 따라 근로자를 쓰는 모든 사업에 적용됩니다. 위험률·규모·장소 등을 고려해 대통령령으로 정한 일부 사업만 빠지고, 근로자 개인의 근로시간이나 일한 기간으로 빼는 조항은 없습니다. 하루만 일한 아르바이트라도 일하다 다치면 산재보험 급여 대상이 될 수 있습니다. 산재보험료는 회사가 전액 냅니다.",
        ],
      },
      {
        heading: "주당 근무 시간별 월 보험료",
        body: [
          `${RATES.year}년 최저시급 ${won(PT_WAGE)}을 받는 아르바이트가 근무 시간에 따라 매달 내는 4대보험료를 4대보험 계산기와 같은 식으로 계산했습니다. 주 15시간 이상이면 주휴수당을 월급에 포함했고, 회사 부담에는 ${PT_INDUSTRY.label} 산재보험료율(${PT_INDUSTRY.permille}‰)과 150명 미만 기업의 고용안정·직업능력개발 보험료를 넣었습니다. 국민연금·건강보험·장기요양보험은 근로자와 회사가 같은 금액을 내고, 고용보험은 실업급여분을 반씩 낸 뒤 회사가 고용안정·직업능력개발분을 더 냅니다.`,
        ],
        table: {
          caption: `${RATES.year}년 최저시급 기준 근무 시간별 월 4대보험료`,
          head: ["근무 형태", "월급", "국민연금", "건강+장기요양", "고용보험", "근로자 합계", "회사 부담 합계"],
          rows: ptRows.map((r) => [r.label, won(r.pay), won(r.pension), won(r.health), won(r.employment), won(r.employee), won(r.employer)]),
          note: "월급 = 시급 × (주 근무시간 + 주휴시간) × 365 ÷ 7 ÷ 12(주 40시간은 209시간). 보험료는 10원 미만 버림. 회사 부담 합계에는 산재보험료와 함께 내는 임금채권부담금·석면피해구제분담금이 들어 있습니다. 국민연금은 18세 이상 60세 미만인 경우입니다.",
        },
        after: [
          `주 10시간처럼 짧게 일하면 근로자가 내는 보험료는 없거나 고용보험 몇천 원뿐이지만, 주 15시간 이상이면 국민연금과 건강보험이 함께 붙어 근로자 부담이 약 ${won(pt15.employee)}으로 늘어납니다. 회사 쪽에서도 주 15시간 아르바이트 한 명에 매달 약 ${won(pt15.employer)}을 보험료로 더 냅니다. 대신 근로자에게는 국민연금 가입 기간과 직장 건강보험 자격이 생깁니다. 국민연금은 기준소득월액 하한이 ${won(RATES.pension.minBase)}이라 월급이 이보다 적어도 하한 기준으로 매깁니다. 표는 비과세 수당이 없다고 가정했습니다. 식대처럼 비과세로 받는 돈이 있으면 그만큼 보험료 기준에서 빠져 보험료가 조금 줄어들고, 4대보험 계산기의 비과세 칸에 넣어 확인할 수 있습니다.`,
        ],
      },
      {
        heading: "일을 시작할 때 확인할 것",
        body: [
          "근로계약서에 주당 근무 시간과 근무 기간이 실제와 맞게 적혀 있는지 먼저 확인합니다. 4대보험 가입 여부가 이 숫자로 정해지기 때문입니다. 보험료를 떼는데 가입이 안 되어 있거나, 기준을 넘는데 가입하지 않았다면 각 공단에 가입 이력을 조회해 볼 수 있습니다.",
          `여러 곳에서 일한다면 보험마다 합산 여부가 다르다는 점도 기억하세요. 카페에서 주 ${ptJobA}시간, 편의점에서 주 ${ptJobB}시간 일한다면 각각은 주 15시간(월 ${PT_MONTHLY_HOURS}시간)에 못 미칩니다. 합치면 주 ${ptJobA + ptJobB}시간이라 국민연금은 본인이 원하면 사업장가입자로 가입할 수 있지만, 건강보험은 사업장마다 따로 보므로 두 곳 모두 직장가입자가 되지 않습니다. 고용보험도 사업장마다 따지므로 각 사업장에서 3개월 이상 계속 일해야 적용됩니다.`,
          "국민연금은 18세 이상 60세 미만만 가입 대상이라, 만 60세 이상 아르바이트는 시간이 길어도 국민연금 보험료를 내지 않습니다. 4대보험 계산기에서 '만 60세 이상'을 고르면 국민연금을 빼고 계산합니다. 내 월급에서 빠질 보험료와 회사가 내는 금액은 4대보험 계산기에 월급을 넣어 확인할 수 있습니다. 실제 가입 대상 여부는 근무 형태에 따라 달라지므로 회사 담당자나 각 공단에 확인하세요.",
        ],
      },
    ],
    sources: [
      { label: "국민연금공단 – 국민연금 제도 안내(아르바이트·일용근로자 가입 기준)", url: "https://nps.or.kr/pnsinfo/ntpsklg/getOHAF0097M0.do" },
      { label: "국가법령정보센터 – 국민연금법 시행령(제2조 근로자에서 제외되는 사람)", url: "https://www.law.go.kr/법령/국민연금법시행령" },
      { label: "국민건강보험공단 해설 자료실 – 직장가입자 제외 대상(국민건강보험법 제6조, 시행령 제9조)", url: "https://www.nhis.or.kr/lm/lmxsrv/data/commentaryDataRoomView.do?seqJomun=0&seqJomunData=67692" },
      { label: "국가법령정보센터 – 고용보험법 시행령(제3조 적용 제외 근로자)", url: "https://www.law.go.kr/법령/고용보험법시행령" },
      { label: "국가법령정보센터 – 산업재해보상보험법(제6조 적용 범위)", url: "https://www.law.go.kr/법령/산업재해보상보험법" },
    ],
  },
  {
    slug: "donation-tax-credit",
    title: "연말정산 기부금 세액공제와 고향사랑기부: 얼마를 내면 얼마를 돌려받을까",
    description:
      "일반 기부금, 고향사랑 기부금, 정치자금 기부금의 세액공제율과 한도를 정리하고, 기부 금액별로 돌려받는 세금을 계산했습니다. 2026년부터 커진 고향사랑기부 공제도 반영했습니다.",
    date: "2026-12-12",
    tool: "net-salary",
    sections: [
      {
        heading: "고향사랑기부는 10만 원까지, 다른 기부는 15%",
        body: [
          `고향사랑 기부금과 정치자금 기부금은 낼 세금이 충분하다면 10만 원까지 낸 돈을 세금에서 그대로 돌려받습니다. 10만 원의 110분의 100을 소득세에서 빼 주고, 소득세가 줄어든 만큼 지방소득세(소득세의 ${RATES.localTaxRate * 100}%)도 줄어 합계가 10만 원이 되기 때문입니다. 종교단체나 사회복지단체 같은 곳에 내는 일반 기부금은 낸 돈의 15%(지방소득세까지 ${(DON_RATE * (1 + RATES.localTaxRate) * 100).toFixed(1)}%)를 돌려받아, 100만 원을 기부하면 약 ${won(withLocal(donGeneral(1_000_000)))}이 줄어듭니다.`,
          `${RATES.year}년부터는 고향사랑 기부금 공제가 커졌습니다. 10만 원 초과 20만 원 이하 부분은 15%가 아니라 40%(지방소득세 포함 44%)를 공제하므로, 20만 원을 기부하면 약 ${won(withLocal(donHome(200_000)))}을 돌려받습니다. 이 글의 금액은 2026년 11월 확인 기준 법령과 국세청·고향사랑e음 안내로 계산했습니다.`,
        ],
      },
      {
        heading: "기부금 종류별 공제율",
        body: [
          "국세청은 연말정산 기부금을 정치자금, 고향사랑, 특례, 우리사주조합, 일반 기부금으로 나눕니다. 특례기부금과 일반기부금은 소득세법 제59조의4제4항에 따라 합계액의 15%를, 1천만 원을 넘는 부분은 30%를 공제합니다. 일반기부금은 사회복지·문화·예술·교육·종교·자선·학술 등 공익 단체에 내는 기부금입니다(소득세법 제34조제3항).",
          "일반기부금에는 한도가 있습니다. 종교단체 기부금이 없으면 소득금액의 30%까지, 종교단체 기부금이 있으면 소득금액의 10%에 '소득금액의 20%와 종교단체 외 기부금 중 적은 금액'을 더한 금액까지 공제 대상이 됩니다. 정치자금과 고향사랑 기부금은 조세특례제한법에 따로 정해져 있어 공제율이 다릅니다.",
        ],
        table: {
          caption: "기부 금액별로 돌려받는 세금(소득세 + 지방소득세)",
          head: ["기부 금액", "일반·특례 기부금", "고향사랑 기부금", "정치자금 기부금"],
          rows: donAmounts.map((v) => [man(v), won(withLocal(donGeneral(v))), won(withLocal(donHome(v))), won(withLocal(donPolitical(v)))]),
          note: `한 종류만 기부했다고 가정했습니다. 고향사랑은 ${RATES.year}년 기부분 기준이며 특별재난지역 기부는 20만 원 초과분 공제율이 더 높습니다. 결정세액이 공제액보다 적으면 이만큼 돌려받지 못합니다. 원 단위 반올림.`,
        },
        after: [
          "표에서 보듯 적은 금액에서는 고향사랑과 정치자금이 일반 기부보다 훨씬 많이 돌려받습니다. 금액이 커질수록 차이가 줄어드는 것은 고향사랑은 20만 원을 넘는 부분부터, 정치자금은 10만 원을 넘는 부분부터 일반 기부와 같은 15%가 적용되기 때문입니다. 일반·특례 기부금은 합계가 1천만 원을 넘는 부분부터 공제율이 30%로 올라가, 금액이 아주 크면 오히려 일반·특례 기부금 쪽이 더 많이 돌려받습니다.",
        ],
      },
      {
        heading: "고향사랑기부제: 실제로 내는 돈은 얼마일까",
        body: [
          `고향사랑기부제는 내가 사는 곳이 아닌 지방자치단체에 기부하고 세액공제와 답례품을 받는 제도입니다. 주민등록상 사는 광역자치단체와 기초자치단체에는 기부할 수 없고, 개인만 기부할 수 있으며 한 사람이 1년에 ${man(HOME_LIMIT)}까지 낼 수 있습니다(고향사랑기부금법 제4조, 제8조). 지방자치단체는 기부금액의 ${HOME_GIFT * 100}% 안에서 답례품을 줄 수 있고, 고향사랑e음에서는 이를 기부 포인트로 받아 기부한 지역의 답례품을 고르게 되어 있습니다. 포인트 유효기간은 5년입니다.`,
          "아래 표는 세액공제를 다 받고 답례품을 한도까지 받는다고 가정했을 때 실제로 내 주머니에서 나가는 돈입니다.",
        ],
        table: {
          caption: `고향사랑 기부 금액별 세액공제·답례품과 실제 부담(${RATES.year}년 기부분)`,
          head: ["기부 금액", "돌려받는 세금", `답례품(최대 ${HOME_GIFT * 100}%)`, "실제 부담"],
          rows: homeAmounts.map((v) => {
            const back = withLocal(donHome(v));
            const gift = v * HOME_GIFT;
            const pay = v - back - gift;
            return [man(v), won(back), won(gift), pay <= 0 ? `없음(답례품이 ${won(-pay)} 더 많음)` : won(pay)];
          }),
          note: "실제 부담 = 기부 금액 − 돌려받는 세금 − 답례품 가액. 답례품 가액은 지방자치단체가 정한 범위 안에서 정해집니다. 세액공제는 결정세액 범위 안에서만 받습니다.",
        },
        after: [
          `10만 원을 기부하면 세금으로 10만 원을 돌려받고 답례품까지 받으니 부담이 없습니다. 20만 원까지도 실제 부담이 적고, 그 위로는 추가로 내는 돈의 15%(지방소득세 포함 16.5%)만 세금으로 돌아옵니다. 50만 원을 기부하면 돌려받는 세금은 약 ${won(home50)}입니다.`,
          "고향사랑e음은 세액공제를 기부자 본인에게만 적용하고, 공제받지 못한 금액을 다음 해로 넘기는 이월공제도 하지 않는다고 안내합니다. 특별재난지역으로 선포된 지방자치단체에 선포일부터 3개월 안에 기부하면 20만 원 초과분 공제율이 30%(지방소득세 포함 33%)로 높아집니다.",
          "정부는 2026년 8월 발표한 세제개편안에서 2027년 1월부터 비수도권 우대지역에 기부하면 10만 원 초과분 공제율을 더 높이는 안을 내놓았습니다. 2026년 11월 확인 기준으로 이 안은 법 개정을 거쳐야 하는 개편안이고, 우대지역도 시행령으로 정할 예정이라 아직 확정되지 않았습니다. 2026년에 내는 기부에는 위 표의 공제율이 적용됩니다.",
        ],
      },
      {
        heading: "정치자금 기부금",
        body: [
          "정당이나 후원회, 선거관리위원회에 「정치자금법」에 따라 낸 정치자금은 조세특례제한법 제76조에 따라 10만 원까지 기부금액의 110분의 100을, 10만 원을 넘는 금액은 15%(3천만 원을 넘는 부분은 25%)를 소득세에서 뺍니다. 고향사랑 기부금과 마찬가지로 낼 세금이 충분하면 10만 원까지는 지방소득세까지 합쳐 낸 돈을 그대로 돌려받습니다.",
          "국세청은 정치자금·고향사랑·우리사주조합 기부금은 이월공제가 안 된다고 안내합니다. 그해 세금이 적어 공제를 다 받지 못하면 남은 금액은 사라진다는 뜻입니다. 또 소득세법은 기본공제를 받는 배우자·부양가족이 낸 기부금도 공제에 넣도록 하지만, 국세청 안내에 따르면 가족이 낸 기부금은 특례·일반기부금만 해당하고 정치자금·고향사랑 기부금은 근로자 본인이 낸 것만 공제됩니다.",
        ],
      },
      {
        heading: "돌려받을 세금이 있어야 공제됩니다",
        body: [
          "세액공제는 이미 계산된 세금에서 빼 주는 방식이라, 빼 줄 세금이 없으면 받을 수 없습니다. 소득세법 제61조는 자녀·연금계좌·특별세액공제와 고향사랑·정치자금 공제 등을 합친 금액이 산출세액을 넘으면 넘는 금액은 없는 것으로 봅니다.",
          `연봉이 낮거나 다른 공제가 많으면 결정세액이 생각보다 작을 수 있습니다. 연봉 실수령액 계산기 기준(본인 1명, 다른 공제 없음)으로 1년 소득세를 보면 연봉 ${donSalaryTax.map((x) => `${man(x.a)}은 약 ${won(x.tax)}`).join(", ")}입니다. 카드·의료비·보험료 공제를 더 받으면 이보다 줄어듭니다.`,
          "다만 특례기부금과 일반기부금은 그해 세금이 모자라 공제받지 못한 금액이나 한도를 넘은 금액을 다음 해부터 10년 안에 이월해 공제받을 수 있습니다(소득세법 제61조제2항). 그래서 결정세액이 적은 사람이 연말에 기부한다면, 이월이 되지 않는 고향사랑·정치자금 기부금은 결정세액 안에서 금액을 정하는 것이 좋습니다.",
          `예를 들어 연봉 ${man(donSalaryTax[2].a)}으로 1년 소득세가 약 ${won(donSalaryTax[2].tax)}인 사람이 고향사랑 20만 원과 일반 기부 30만 원을 냈다면, 소득세에서 빠지는 금액은 고향사랑 약 ${won(donHome(200_000))}과 일반 기부 약 ${won(donGeneral(300_000))}으로 합계 약 ${won(donHome(200_000) + donGeneral(300_000))}입니다. 1년 소득세보다 적으므로 모두 공제받을 수 있습니다. 같은 사람이 다른 공제를 많이 받아 남은 소득세가 이보다 적다면 기부금 공제를 다 받지 못할 수 있습니다.`,
          "이월된 기부금이 있으면 국세청이 안내하는 순서대로 공제합니다. 이월된 특례기부금, 그해 낸 특례기부금, 이월된 종교단체 외 일반기부금, 그해 낸 종교단체 외 일반기부금, 이월된 종교단체 기부금, 그해 낸 종교단체 기부금 순입니다. 2021~2022년에 낸 기부금은 공제율이 한시로 20%(1천만 원 초과분 35%)였기 때문에, 그때 이월된 금액은 높은 공제율로 공제합니다.",
        ],
      },
      {
        heading: "영수증과 간소화 자료 챙기기",
        body: [
          "연말정산에서는 기부금 영수증과 기부금명세서를 회사에 냅니다. 국세청은 기부금 자료를 연말정산 간소화 서비스에서 조회할 수 있지만, 조회되지 않으면 기부한 단체에서 영수증을 발급받아 내면 된다고 안내합니다.",
          "기부금은 그 과세기간에 실제로 지급한 금액으로 공제하므로, 2026년 귀속 연말정산에 넣으려면 2026년 12월 31일까지 지급을 마쳐야 합니다. 정기 후원을 하고 있다면 1년 동안 낸 금액이 단체 영수증과 맞는지, 가족 명의로 낸 기부금이 누구 공제로 들어갈지도 미리 정리해 두세요.",
        ],
      },
      {
        heading: "12월에 기부하기 전에 확인할 것",
        body: [
          "첫째, 기부처가 세액공제 대상 단체인지와 영수증을 발급하는지 확인합니다. 둘째, 고향사랑기부는 내가 주민등록을 둔 시·도와 시·군·구에는 할 수 없으니 기부처를 고를 때 확인합니다. 셋째, 결정세액이 적은 사람은 이월되지 않는 기부금부터 한도 안에서 정합니다.",
          "내 1년 소득세가 대략 얼마인지는 연봉 실수령액 계산기에 연봉을 넣어 월 소득세에 12를 곱하면 가늠할 수 있습니다. 실제 공제액은 다른 공제 항목과 결정세액에 따라 달라지므로 회사 연말정산 담당자나 국세청(국번 없이 126)에 확인하세요.",
        ],
      },
    ],
    sources: [
      { label: "국세청 – 기부금 세액공제(공제율, 이월공제, 구비 서류)", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239040" },
      { label: "국가법령정보센터 – 소득세법(제34조, 제59조의4, 제61조)", url: "https://www.law.go.kr/법령/소득세법" },
      { label: "국가법령정보센터 – 조세특례제한법(제58조 고향사랑 기부금, 제76조 정치자금)", url: "https://www.law.go.kr/법령/조세특례제한법" },
      { label: "고향사랑e음 – 고향사랑기부제 안내", url: "https://ilovegohyang.go.kr/donation/guide1.html" },
      { label: "대한민국 정책브리핑 – 고향사랑기부 세액공제 확대 등 지방 주도 성장 세제개편 추진", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148969910" },
    ],
  },
  {
    slug: "dual-income-year-end-tax",
    title: "맞벌이 부부 연말정산: 부양가족·의료비·카드 공제는 누가 받아야 유리할까",
    description:
      "맞벌이 부부는 부양가족과 자녀 공제를 한 사람만 받고, 의료비는 쓴 사람이, 카드는 명의자가 공제받습니다. 총급여별 의료비 문턱과 부양가족 공제 효과를 계산해 누가 받는 것이 유리한지 정리했습니다.",
    date: "2026-12-19",
    tool: "net-salary",
    sections: [
      {
        heading: "공제마다 '누가 받는지' 기준이 다릅니다",
        body: [
          `맞벌이 부부 연말정산에서 부모님·자녀 같은 부양가족 공제는 두 사람 중 한 명만 받고, 의료비는 실제로 돈을 낸 사람이, 신용카드는 카드 명의자가 공제받습니다. 의료비는 총급여의 3%를 넘게 써야 공제가 시작되므로 급여가 낮은 쪽이 쓰는 것이 유리할 때가 많습니다. 예를 들어 의료비 ${man(MED_SPEND)}을 총급여 ${man(COUPLE_HIGH)}인 사람이 내면 공제액이 약 ${won(medHigh.credit)}이지만, 총급여 ${man(COUPLE_LOW)}인 배우자가 내면 약 ${won(medLow.credit)}으로 늘어납니다.`,
          "반대로 부양가족 기본공제는 세율이 높은, 즉 급여가 많은 쪽이 받을수록 줄어드는 세금이 큽니다. 그래서 맞벌이 부부는 공제 항목마다 누가 받는 것이 나은지 따로 따져야 합니다. 이 글은 2026년 11월 확인 기준 국세청 안내와 소득세법·조세특례제한법을 바탕으로 정리했습니다.",
        ],
      },
      {
        heading: "부양가족과 자녀 공제는 한 사람만",
        body: [
          "소득세법 제50조제3항은 배우자나 부양가족이 다른 사람의 부양가족에도 해당하면 어느 한 사람에게서만 공제하도록 정합니다. 그래서 부모님이나 자녀를 부부가 모두 기본공제 대상으로 올리면 중복 공제가 됩니다. 국세청은 맞벌이 부부가 자녀를 중복으로 공제받았다면 다음 해 5월 종합소득세 신고 기간에 한 사람이 그 자녀를 빼고 신고해 덜 낸 세금을 내야 한다고 안내합니다. 신고 기간이 지나 수정하면 덜 낸 세금의 10%와 하루 0.022%의 납부지연 가산세가 붙습니다.",
          "자녀를 빼면 그 자녀와 관련된 공제도 함께 빠집니다. 국세청은 자녀를 기본공제 받은 근로자만 그 자녀의 장애인 추가공제, 신용카드 사용액, 자녀세액공제, 보장성 보험료, 의료비, 교육비, 기부금 공제를 받을 수 있다고 안내합니다. 또 연간 소득금액이 100만 원(근로소득만 있으면 총급여 500만 원)을 넘는 가족은 기본공제를 받을 수 없으므로, 맞벌이 부부는 서로를 배우자 공제로 올릴 수 없습니다. 부모님은 60세 이상이어야 기본공제 대상이 되고, 70세 이상이면 경로우대 추가공제 100만 원이 더해집니다(소득세법 제50조, 제51조). 부양가족에 해당하는지는 그해 12월 31일 현재 상황으로 판단하고, 연도 중에 사망한 가족은 사망 전날 상황으로 봅니다(소득세법 제53조제4항). 국세청은 연도 중 이혼한 배우자는 배우자 공제 대상이 아니라고 안내합니다.",
        ],
        table: {
          caption: "부양가족 1명을 기본공제(150만 원)로 받을 때 줄어드는 1년 세금",
          head: ["받는 사람의 총급여", "줄어드는 소득세+지방소득세"],
          rows: depRows.map((r) => [man(r.g), won(r.save)]),
          note: "연봉 실수령액 계산기와 같은 방식(비과세 없음, 본인 외 부양가족 1명 추가)으로 계산했습니다. 경로우대·장애인 추가공제와 자녀세액공제는 넣지 않았습니다.",
        },
        after: [
          "같은 150만 원 공제라도 대체로 급여가 높을수록 더 많은 세금이 줄어듭니다. 공제는 과세표준을 줄이는데, 급여가 높을수록 줄어든 과세표준에 붙던 세율이 높기 때문입니다. 줄어드는 폭은 세율 구간과 근로소득세액공제에 따라 달라져, 급여가 달라도 비슷하게 나오는 구간이 있습니다. 다만 부양가족을 데려가면 그 가족의 의료비·카드·보험료 공제도 함께 따라가므로, 기본공제와 의료비를 함께 놓고 판단해야 합니다.",
        ],
      },
      {
        heading: "의료비: 총급여 3% 문턱",
        body: [
          "의료비 세액공제는 기본공제대상자(나이와 소득 요건은 보지 않음)를 위해 쓴 의료비 가운데 총급여의 3%를 넘는 금액의 15%를 세금에서 뺍니다(소득세법 제59조의4제2항). 같은 의료비라도 총급여가 낮은 사람일수록 문턱이 낮아 공제받는 금액이 커집니다.",
          "맞벌이 부부에게 중요한 것은 누구 의료비를 누가 낼 수 있느냐입니다. 국세청 상담 사례에 따르면 배우자를 위해 쓴 의료비는 진료를 받은 배우자가 아니라 돈을 낸 근로자가 공제받습니다. 반면 자녀 의료비는 그 자녀를 기본공제 받는 사람이 직접 냈을 때만 공제됩니다. 남편이 자녀를 기본공제 받고 아내가 자녀 의료비를 냈다면 누구도 그 의료비를 공제받지 못합니다.",
          "공제 대상은 국내 병원·약국에 낸 의료비, 시력 교정용 안경·콘택트렌즈(1인당 50만 원 한도), 산후조리원 비용(출산 1회당 200만 원 한도) 등이고, 미용·성형수술비와 건강증진용 의약품, 국외 의료비는 빠집니다. 실손보험금으로 돌려받은 금액도 빼야 합니다. 본인, 65세 이상, 6세 이하, 장애인 등의 의료비는 한도가 없고, 그 밖의 부양가족 의료비는 1인당 연 700만 원까지입니다(국세청 안내).",
        ],
        table: {
          caption: `의료비 ${man(MED_SPEND)}을 쓸 때 총급여별 공제액`,
          head: ["총급여", "문턱(3%)", "공제액(15%)", "1년 소득세(참고)", "실제로 받을 수 있는 공제"],
          rows: medRows.map((r) => [man(r.g), won(r.threshold), won(r.credit), won(r.tax), won(r.usable)]),
          note: "1년 소득세는 연봉 실수령액 계산기 기준(본인 1명, 다른 공제 없음)의 추정입니다. 공제액은 소득세 기준이며 지방소득세는 그 10%만큼 더 줄어듭니다. 일반 부양가족 의료비는 1인당 연 700만 원 한도가 있습니다.",
        },
        after: [
          `표의 마지막 칸처럼, 급여가 너무 낮으면 공제액이 1년 소득세보다 커서 다 쓰지 못할 수 있습니다. 세액공제를 모두 합한 금액이 산출세액을 넘으면 넘는 부분은 없는 것으로 보기 때문입니다(소득세법 제61조). 그래서 '급여 낮은 쪽이 낸다'는 원칙은 그 사람의 소득세가 공제액을 받아 줄 만큼 있을 때 맞습니다.`,
        ],
      },
      {
        heading: "신용카드는 명의자 기준, 부부 합산은 안 됩니다",
        body: [
          `신용카드·체크카드·현금영수증 공제는 1년 사용액이 총급여의 ${CARD_THRESHOLD * 100}%(최저사용금액)를 넘어야 시작됩니다(조세특례제한법 제126조의2). 총급여 ${man(COUPLE_LOW)}이면 ${man(COUPLE_LOW * CARD_THRESHOLD)}, ${man(COUPLE_HIGH)}이면 ${man(COUPLE_HIGH * CARD_THRESHOLD)}을 넘게 써야 그 위의 금액부터 공제됩니다.`,
          "국세청 상담 사례에 따르면 소득이 기준을 넘는 맞벌이 부부는 카드 사용액을 합쳐 한 사람이 공제받을 수 없고, 각자 쓴 금액을 각자 공제받습니다. 가족카드도 대금을 낸 사람이 아니라 카드 명의자(사용자)가 공제받습니다. 자녀 카드 사용액은 그 자녀를 기본공제 받은 사람만 공제받을 수 있습니다. 배우자가 연도 중에 퇴직해 전업주부가 되었다면, 퇴직할 때까지의 근로소득금액과 퇴직소득금액을 합친 금액이 100만 원 이하일 때만 다른 배우자가 그 카드 사용액을 공제받고, 넘으면 퇴직한 배우자가 퇴직 전에 쓴 금액만 본인 근로소득에서 공제받는다고 국세청은 안내합니다.",
          "그래서 한쪽 카드 사용액이 최저사용금액에 못 미친다면, 연말 남은 기간의 지출을 문턱을 이미 넘은 쪽 카드로 모으는 것이 공제를 늘리는 방법이 될 수 있습니다. 다만 카드 공제는 사용 수단과 한도에 따라 계산이 복잡하므로 실제 효과는 각자 확인하는 것이 좋습니다.",
        ],
      },
      {
        heading: "보험료·교육비·기부금도 기본공제를 따라갑니다",
        body: [
          "국세청은 소득금액이 100만 원을 넘어 부양가족으로 기본공제를 받을 수 없는 가족은 추가공제뿐 아니라 그 가족의 신용카드 사용액, 보험료·교육비·기부금 지출액도 공제받을 수 없다고 안내합니다. 의료비만 예외로, 소득 요건을 넘는 가족을 위해 쓴 의료비도 세액공제를 받을 수 있습니다. 맞벌이 배우자도 소득 요건을 넘는 가족이므로, 내가 배우자를 위해 낸 보장성 보험료나 배우자의 교육비는 내 공제에 넣을 수 없고 배우자를 위해 낸 의료비만 공제받습니다.",
          "형제자매 사이에도 같은 원칙이 적용됩니다. 국세청 사례에 따르면 어머니를 형이 기본공제 받고 있다면 동생이 어머니 의료비를 냈어도 동생은 공제받을 수 없습니다. 부모님을 누가 공제받을지 정할 때는 의료비를 누가 낼지도 함께 정해야 하는 이유입니다.",
        ],
      },
      {
        heading: `예시: 총급여 ${man(COUPLE_HIGH)}과 ${man(COUPLE_LOW)} 부부`,
        body: [
          `총급여 ${man(COUPLE_HIGH)}인 남편과 ${man(COUPLE_LOW)}인 아내가 소득이 없는 어머니 한 분을 부양하고, 아내가 1년 동안 본인 진료비로 ${man(MED_SPEND)}을 썼다고 해 보겠습니다. 어머니 기본공제를 누가 받을지, 아내 의료비를 누가 낼지에 따라 부부가 합쳐 줄이는 세금은 아래처럼 달라집니다.`,
        ],
        table: {
          caption: "부양가족 공제와 배우자 의료비를 누가 받느냐에 따른 부부 합계 절세액(소득세+지방소득세)",
          head: ["어머니 기본공제", "아내 의료비를 낸 사람", "부부 합계 절세액"],
          rows: coupleCases.map((c) => [`${c.dep}(${man(c.dep === "높은 쪽" ? COUPLE_HIGH : COUPLE_LOW)})`, `${c.med}(${man(c.med === "높은 쪽" ? COUPLE_HIGH : COUPLE_LOW)})`, won(c.total)]),
          note: "어머니는 소득 요건을 채운 60세 이상 70세 미만으로 보고 경로우대 추가공제(70세 이상)는 넣지 않았습니다. 의료비는 아내 본인 의료비로, 남편이 내도 배우자 의료비로 공제됩니다. 연봉 실수령액 계산기와 같은 방식의 추정입니다.",
        },
        after: [
          `이 조건에서는 어머니 기본공제는 급여가 ${coupleBest.dep}이 받고 아내 의료비는 급여가 ${coupleBest.med}이 내는 조합이 합계 약 ${won(coupleBest.total)}으로 가장 많이 줄어듭니다. ${coupleDepHigh - coupleDepLow > 10_000 ? `어머니 기본공제로 줄어드는 세금이 남편은 약 ${won(coupleDepHigh)}, 아내는 약 ${won(coupleDepLow)}으로 세율이 높은 쪽이 크고,` : `어머니 기본공제로 줄어드는 세금은 두 사람이 비슷하고,`} 의료비는 문턱이 낮은 아내가 낼 때 공제가 약 ${won(coupleMedLow)}으로 남편이 낼 때(약 ${won(coupleMedHigh)})보다 크기 때문입니다. 실제로는 어머니의 의료비·카드 사용액도 기본공제를 받는 사람에게 따라가므로, 그 금액까지 넣어 다시 비교해야 합니다.`,
        ],
      },
      {
        heading: "부부가 함께 정하는 순서",
        body: [
          "첫째, 부모님·자녀 등 부양가족을 누가 기본공제 받을지 정하고 두 사람 모두 같은 내용으로 신고합니다. 세율이 높은 쪽이 받으면 기본공제 효과가 크지만, 그 가족의 의료비·교육비·카드 공제도 같은 사람에게 가야 한다는 점을 함께 봅니다.",
          "둘째, 배우자 의료비는 낸 사람이 공제받으므로 총급여 3% 문턱을 넘기 쉬운 쪽이 내도록 합니다. 이때 그 사람의 소득세가 공제를 받아 줄 만큼 있는지 확인합니다. 셋째, 카드 사용액은 각자 최저사용금액을 넘었는지 보고 남은 지출을 어느 카드로 할지 정합니다.",
          "부부 각자의 1년 소득세 규모는 연봉 실수령액 계산기에 각자의 연봉과 부양가족 수를 넣어 비교해 볼 수 있습니다. 누가 어떤 공제를 받는지에 따라 결과가 크게 달라질 수 있으므로, 최종 결정 전에는 회사 연말정산 담당자나 국세청(국번 없이 126)에 확인하세요.",
        ],
      },
    ],
    sources: [
      { label: "국세청 보도참고자료 – 자주 하는 연말정산 실수! 오답노트를 공개합니다(2026. 1. 23.)", url: "https://www.nts.go.kr/nts/na/ntt/selectNttInfo.do?nttSn=1348212&mi=2201" },
      { label: "국세상담센터 상담 사례 – 신용카드 등 소득공제(맞벌이 부부)", url: "https://call.nts.go.kr/call/qna/selectQnaInfo.do?ctgId=CTG11898&mi=1318" },
      { label: "국세상담센터 상담 사례 – 의료비 세액공제(맞벌이 부부 의료비)", url: "https://call.nts.go.kr/call/qna/selectQnaInfo.do?ctgId=CTG11909&mi=1318" },
      { label: "국가법령정보센터 – 소득세법(제50조·제51조 기본·추가공제, 제53조 판정 시기, 제59조의4 의료비, 제61조 세액공제 한도)", url: "https://www.law.go.kr/법령/소득세법" },
      { label: "국가법령정보센터 – 조세특례제한법(제126조의2 신용카드 등 사용금액 소득공제)", url: "https://www.law.go.kr/법령/조세특례제한법" },
    ],
  },
  {
    slug: "holiday-work-pay-christmas",
    title: "성탄절·신정에 일하면 휴일근로수당 받을까: 5인 이상 사업장 기준과 계산법",
    description:
      "성탄절과 1월 1일은 5인 이상 사업장의 법정 유급휴일입니다. 이날 일하면 받는 휴일근로수당(8시간 이내 50%, 초과 100% 가산), 5인 미만 사업장의 차이, 휴일 대체를 시급별 계산 예와 함께 정리했습니다.",
    date: "2026-12-22",
    tool: "overtime-pay",
    sections: [
      {
        heading: "5인 이상 사업장이면 성탄절과 1월 1일은 유급휴일입니다",
        body: [
          `상시 근로자가 5명 이상인 회사에서 성탄절(${XMAS.slice(0, 4)}년 12월 25일, ${weekdayOf(XMAS)}요일)이나 1월 1일(${NEWYEAR.slice(0, 4)}년, ${weekdayOf(NEWYEAR)}요일)에 일하면, 일한 시간의 임금에 통상임금의 50%(8시간을 넘는 시간은 100%)를 더한 휴일근로수당을 받습니다. 통상시급 ${won(HOL_EX_WAGE)}인 사람이 8시간 일하면 휴일근로 임금은 ${won(holPay(HOL_EX_WAGE, 8, true).total)}입니다. 5명 미만 회사는 이 규정이 적용되지 않습니다.`,
          "근로기준법 제55조제2항은 회사가 대통령령으로 정한 휴일을 유급으로 보장하도록 하고, 시행령 제30조제2항은 그 휴일을 「관공서의 공휴일에 관한 규정」의 공휴일(일요일 제외)과 대체공휴일로 정합니다. 이 규정의 공휴일에는 1월 1일(제2조제3호)과 기독탄신일 12월 25일(제2조제10호)이 들어 있습니다. 일요일을 빼는 것은 민간 회사는 이미 주 1회 이상 유급 주휴일을 주기 때문이라고 고용노동부는 설명합니다.",
        ],
      },
      {
        heading: "회사 규모별 적용 시점",
        body: [
          "관공서 공휴일을 민간 회사의 유급휴일로 보장하는 규정은 회사 규모에 따라 차례로 시행되었습니다. 상시 300명 이상 사업장과 공공기관은 2020년 1월 1일, 30명 이상 300명 미만은 2021년 1월 1일, 5명 이상 30명 미만은 2022년 1월 1일부터입니다. 지금은 5명 이상인 모든 사업장에 적용됩니다.",
          "상시 4명 이하 사업장에는 공휴일 유급휴일 규정(제55조제2항)과 연장·휴일근로 가산수당(제56조)이 적용되지 않습니다. 고용노동부는 이런 사업장에서는 노사가 공휴일을 휴일로 따로 약정하지 않았다면 그날은 근로일이어서 휴일근로수당이 생기지 않는다고 안내합니다. 이때도 일한 시간만큼의 임금은 평소처럼 받습니다.",
          "5명 이상인지는 그날 출근한 인원이 아니라 '상시 사용하는 근로자 수'로 판단합니다. 근로기준법 시행령 제7조의2는 판단할 일이 생긴 날 전 1개월 동안 쓴 근로자의 연인원을 그 기간의 가동 일수로 나눠 구하도록 하면서, 그 평균과 관계없이 1개월 가운데 근로자가 5명에 못 미친 날이 절반 미만이면 5명 이상 사업장으로, 절반 이상이면 5명 미만 사업장으로 보도록 정합니다. 기간제·단시간 근로자 등 고용 형태와 관계없이 그 사업장에서 일하는 근로자는 모두 연인원에 들어가므로(같은 조 제4항, 파견근로자는 제외), 정규직이 4명뿐이라도 아르바이트까지 합치면 5명 이상일 수 있습니다.",
        ],
      },
      {
        heading: "휴일근로수당 계산법",
        body: [
          "근로기준법 제56조제2항은 휴일근로에 대해 8시간 이내는 통상임금의 50%, 8시간을 넘는 부분은 100% 이상을 가산하도록 정합니다. 그래서 공휴일 근무 임금은 '일한 시간 × 통상시급 × 1.5'에, 8시간을 넘는 시간은 '× 2'로 계산합니다. 밤 10시부터 오전 6시 사이에 일한 시간이 있으면 야간근로 가산 50%가 따로 더해집니다(제56조제3항). 휴일에 8시간을 넘겨 일한 시간은 연장근로 가산(50%)과 휴일근로 가산(50%)을 따로 더하지 않고, 제56조제2항에 따라 100%를 가산합니다.",
          "유급휴일이라는 말은 그날 쉬어도 임금이 나온다는 뜻입니다. 월급제라면 공휴일 임금이 이미 월급에 들어 있어, 공휴일에 일하면 아래 표의 금액을 더 받습니다. 고용노동부도 휴일 대체 없이 공휴일에 일했다면 휴일근로 가산수당을 포함한 임금을 '추가로' 지급해야 한다고 안내합니다.",
          "시급제 아르바이트도 5명 이상 사업장이라면 같습니다. 원래 일하기로 한 날이 공휴일이어서 쉬게 되면 유급휴일이므로 그날 임금을 받고, 그날 일하면 그와 별도로 아래 표의 휴일근로 임금을 받습니다. 반대로 공휴일이 원래 근무가 없는 날과 겹치면 따로 유급휴일 수당을 줄 의무가 없다는 것이 고용노동부의 해석입니다.",
        ],
        table: {
          caption: "통상시급별 공휴일 하루 근무 시 받는 휴일근로 임금",
          head: ["통상시급", "8시간 근무(5인 이상)", "10시간 근무(5인 이상)", "8시간 근무(5인 미만)"],
          rows: holRows.map((r) => [won(r.w), won(r.h8), won(r.h10), won(r.small)]),
          note: `연장·야간·휴일수당 계산기와 같은 식입니다. 5인 이상은 8시간까지 1.5배, 8시간 초과분 2배, 5인 미만은 가산 없이 일한 시간분만 계산했습니다. 첫 줄은 ${RATES.year}년 최저시급입니다. 세전 금액이며 야간근로는 넣지 않았습니다.`,
        },
        after: [
          `월급제의 통상시급은 기본급과 매달 정기적·일률적으로 받는 수당을 '월의 통상임금 산정 기준시간'으로 나눈 금액입니다(근로기준법 시행령 제6조). 이 시간은 주 소정근로시간에 주휴시간처럼 유급으로 처리되는 시간을 더해 월로 환산한 것으로, 주 40시간이면 209시간입니다. 예를 들어 월급 ${man(HOL_MONTHLY)}이 모두 통상임금이라면 통상시급은 약 ${won(holMonthlyHourly)}이고, 성탄절에 8시간 일하면 월급과 별도로 약 ${won(holMonthly8)}을 더 받습니다. 성탄절과 1월 1일에 모두 8시간씩 일했다면 약 ${won(holMonthly8 * 2)}입니다.`,
        ],
      },
      {
        heading: "성탄절 오후부터 자정까지 일한 경우",
        body: [
          `통상시급 ${won(HOL_EX_WAGE)}인 직원이 성탄절 오후 1시부터 자정까지, 휴게 1시간을 빼고 10시간 일했다고 해 보겠습니다. 이 가운데 오후 10시부터 자정까지 2시간은 야간근로입니다.`,
        ],
        table: {
          caption: `통상시급 ${won(HOL_EX_WAGE)}, 성탄절 10시간 근무(야간 2시간 포함)`,
          head: ["항목", "계산", "금액"],
          rows: [
            ["일한 시간분", `${won(HOL_EX_WAGE)} × 10시간`, won(holEx.holidayBase)],
            ["휴일 가산(8시간 이내)", `${won(HOL_EX_WAGE)} × 8시간 × 50%`, won(HOL_EX_WAGE * 8 * 0.5)],
            ["휴일 가산(8시간 초과)", `${won(HOL_EX_WAGE)} × 2시간 × 100%`, won(HOL_EX_WAGE * 2 * 1)],
            ["야간 가산", `${won(HOL_EX_WAGE)} × 2시간 × 50%`, won(holEx.nightPremium)],
            ["합계", "", won(holEx.total)],
          ],
          note: "5인 이상 사업장 기준, 세전 금액입니다. 휴일근로와 야간근로가 겹치는 시간은 두 가산을 모두 더합니다.",
        },
        after: [
          "급여명세서에서 이 금액이 '휴일근로수당' 한 줄로 나오기도 하고, 기본 시간분과 가산분이 나뉘어 나오기도 합니다. 연장·야간·휴일수당 계산기에 통상시급과 휴일근로 8시간 이내·초과 시간, 야간 시간을 넣으면 같은 결과를 볼 수 있습니다.",
        ],
      },
      {
        heading: "휴일 대체와 보상휴가",
        body: [
          "근로기준법 제55조제2항 단서는 근로자대표와 서면으로 합의하면 공휴일을 특정한 다른 근로일로 바꿀 수 있게 합니다. 이를 휴일 대체라고 합니다. 고용노동부는 공휴일에 불가피하게 일해야 할 때 이렇게 다른 근로일을 유급휴일로 정해 주는 방법을 안내합니다. 휴일 대체를 하면 원래 공휴일은 근로일이 되므로 그날 일해도 휴일근로 가산수당은 생기지 않고, 대신 정해진 다른 날에 유급으로 쉽니다.",
          "휴일 대체는 근로자 한 사람과의 합의가 아니라 근로자대표와의 서면 합의가 필요하고, 대체할 근로일을 특정해야 합니다. 이와 달리 보상휴가제(제57조)는 근로자대표와 서면 합의로 연장·야간·휴일근로 임금을 주는 대신 휴가를 주는 제도입니다. 회사가 '수당 대신 쉬는 날을 준다'고 할 때 어느 제도인지, 서면 합의가 있는지 확인해 보세요.",
          "공휴일에 일한 직원에게 회사가 다른 날 하루를 쉬게 해 주면 되느냐는 질문에, 고용노동부는 근로자대표와 서면 합의로 휴일 대체를 하지 않은 채 공휴일에 일했다면 휴일근로 가산수당을 포함한 임금을 추가로 지급해야 한다고 답했습니다. 쉬는 날을 하나 받는 것만으로 가산수당 문제가 정리되는 것은 아니라는 뜻입니다.",
        ],
      },
      {
        heading: "1월 1일은 주말과 겹쳐도 대체공휴일이 없습니다",
        body: [
          `「관공서의 공휴일에 관한 규정」 제3조는 국경일, 어린이날, 부처님 오신 날, 기독탄신일 등이 토요일이나 일요일과 겹치면 그다음의 첫 번째 공휴일이 아닌 날(그날이 토요일이면 다시 그다음 날)을 대체공휴일로 정합니다. 기독탄신일은 여기에 들어 있지만 1월 1일(제2조제3호)은 들어 있지 않아, 1월 1일이 주말이어도 대체공휴일이 생기지 않습니다. ${XMAS.slice(0, 4)}년 성탄절은 ${weekdayOf(XMAS)}요일, ${NEWYEAR.slice(0, 4)}년 1월 1일은 ${weekdayOf(NEWYEAR)}요일${[XMAS, NEWYEAR].every((d) => !['토', '일'].includes(weekdayOf(d))) ? '이라 이번에는 대체공휴일이 생기지 않습니다' : '입니다'}. 12월 24일과 12월 31일은 이 규정의 공휴일이 아니므로, 회사가 따로 쉬는 날로 정하지 않았다면 평소와 같은 근로일입니다.`,
          "고용노동부는 공휴일이 원래 근무가 없는 비번일이나 무급휴무일과 겹치면 노사가 달리 정하지 않은 한 따로 유급휴일 수당을 줄 의무가 없고, 주휴일과 공휴일이 겹치면 근로자에게 유리한 하나만 유급으로 인정하면 된다고 봅니다. 교대제 근무처럼 공휴일이 원래 쉬는 날이었다면 별도 수당이 없을 수 있다는 뜻입니다.",
        ],
      },
      {
        heading: "공휴일 근무 전에 확인할 것",
        body: [
          "먼저 우리 회사의 상시 근로자가 5명 이상인지, 근로계약서나 취업규칙에 공휴일을 어떻게 정해 두었는지 확인합니다. 5명 미만 사업장이라도 노사가 공휴일을 휴일로 약정했다면 그 약정에 따릅니다. 다음으로 공휴일 근무가 휴일 대체로 처리되는지, 휴일근로로 처리되는지 회사 안내를 봅니다. 휴일근로라면 급여명세서에 가산수당이 들어 있는지, 8시간을 넘긴 시간과 밤 10시 이후 시간이 따로 계산되었는지 확인합니다.",
          "임금채권은 3년 동안 행사하지 않으면 시효로 사라지므로(근로기준법 제49조) 급여명세서와 근무 기록을 보관해 두는 것이 좋습니다. 수당이 빠졌다면 먼저 회사 급여 담당자에게 계산 근거를 묻고, 해결되지 않으면 고용노동부 고객상담센터(국번 없이 1350)나 관할 지방고용노동관서에 상담할 수 있습니다. 근로 형태와 회사 규정에 따라 판단이 달라질 수 있으니 구체적인 사안은 관계 기관에 확인하세요.",
        ],
      },
    ],
    sources: [
      { label: "국가법령정보센터 – 근로기준법(제49조 임금의 시효, 제55조 휴일, 제56조 연장·야간 및 휴일 근로, 제57조 보상 휴가제)", url: "https://www.law.go.kr/법령/근로기준법" },
      { label: "국가법령정보센터 – 근로기준법 시행령(제6조 통상임금, 제7조의2 상시 근로자 수, 제30조 휴일)", url: "https://www.law.go.kr/법령/근로기준법시행령" },
      { label: "국가법령정보센터 – 관공서의 공휴일에 관한 규정(제2조 공휴일, 제3조 대체공휴일)", url: "https://www.law.go.kr/법령/관공서의공휴일에관한규정" },
      { label: "고용노동부 정책자료 – 관공서의 공휴일 및 대체공휴일에 대한 유급휴일 확대 적용 안내", url: "https://www.moel.go.kr/policy/policydata/view.do?bbs_seq=20211200972" },
      { label: "고용노동부 빠른인터넷상담 – 법정공휴일 근무와 대체 휴무", url: "https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202302280912404871000" },
    ],
  },
  {
    slug: "2027-minimum-wage",
    title: `2027년 최저임금 시급 ${n(MW_NEXT)}원, 월급·주당 시간별로 환산하면`,
    description: `2027년 최저임금은 시간당 ${n(MW_NEXT)}원으로 2026년보다 ${(mwRate * 100).toFixed(1)}% 올랐습니다. 주 40시간 월급과 주당 근무 시간별 월급, 수습 감액 조건, 최저임금에 들어가는 임금을 정리했습니다.`,
    date: "2026-12-27",
    tool: "wage-converter",
    sections: [
      {
        heading: `2027년 최저임금은 시간당 ${n(MW_NEXT)}원입니다`,
        body: [
          `2027년 1월 1일부터 적용되는 최저임금은 시간당 ${won(MW_NEXT)}입니다. 2026년 ${won(MW_NOW)}보다 ${won(mwRise)}(${(mwRate * 100).toFixed(1)}%) 올랐고, 주 40시간 일하는 사람의 월급(주휴수당 포함 209시간)으로는 ${won(mw40.next)}, 하루 8시간 일급으로는 ${won(MW_NEXT * 8)}입니다. 업종 구분 없이 하나의 금액이고, 5명 미만 사업장이나 아르바이트에도 똑같이 적용됩니다. 최저임금법은 근로자를 쓰는 모든 사업에 적용되고, 동거하는 친족만 쓰는 사업과 가사 사용인, 선원법의 적용을 받는 선원 등만 빠집니다(제3조).`,
          `최저임금위원회가 ${MW_DECIDED}에 의결했고, 고용노동부 장관이 ${MW_NOTICED}에 고시했습니다. 최저임금법은 장관이 매년 8월 5일까지 다음 해 최저임금을 결정하고(제8조), 고시된 최저임금은 다음 해 1월 1일부터 효력이 생긴다고 정합니다(제10조). 그래서 2027년 1월 1일 이후 일한 시간부터 새 금액을 받아야 합니다. 1월 10일에 받는 급여라도 12월에 일한 몫이면 2026년 최저임금이 기준이고, 1월에 일한 몫부터 2027년 기준이 됩니다. 최저임금위원회는 근로자위원·사용자위원·공익위원 각 9명으로 구성되고(제14조), 장관의 심의 요청을 받은 날부터 90일 안에 최저임금안을 의결해 제출합니다(제8조제2항).`,
          `주 단위로 보면 주 40시간에 주휴 8시간을 더한 48시간분인 ${won(MW_NEXT * 48)}이 2027년 최저 주급입니다. 정신장애나 신체장애로 근로능력이 현저히 낮은 사람 등은 사용자가 고용노동부 장관의 인가를 받은 경우에만 최저임금 적용에서 빠질 수 있습니다(제7조).`,
        ],
      },
      {
        heading: "주당 근무 시간별 월급",
        body: [
          "시급을 월급으로 바꿀 때는 주휴시간을 포함한 월 환산 시간을 씁니다. 주 15시간 이상 일하면 주휴수당이 생기므로 (주 근무시간 + 주휴시간) × 365 ÷ 7 ÷ 12로 계산하고, 주 40시간은 급여 실무에서 쓰는 209시간을 그대로 씁니다. 아래 표는 시급·월급·연봉 변환기와 같은 방식입니다.",
        ],
        table: {
          caption: `주당 근무 시간별 최저임금 월급(${RATES.year}년 vs ${RATES.year + 1}년)`,
          head: ["주 근무시간", "월 환산 시간", `${RATES.year}년 월급`, `${RATES.year + 1}년 월급`, "늘어나는 금액"],
          rows: mwRows.map((r) => [`${r.w}시간`, `${Number(r.hours.toFixed(1)).toLocaleString("ko-KR")}시간`, won(r.now), won(r.next), won(Math.round(r.next) - Math.round(r.now))]),
          note: "주 15시간 미만은 주휴수당이 없어 근무 시간만으로 계산했습니다. 세전 금액이며 원 단위 반올림입니다. 연장·야간·휴일근로 수당은 들어 있지 않습니다.",
        },
        after: [
          `주 40시간 월급 ${won(mw40.next)}은 최저임금위원회가 고시 기준으로 함께 밝힌 금액(209시간 기준)과 같고, 1년으로는 ${won(mw40.next * 12)}입니다. 연봉 계약을 해 둔 경우라도 2027년 1월부터 시급으로 바꾼 금액이 ${won(MW_NEXT)}에 못 미치면 최저임금 위반이 되므로, 연봉을 209시간과 12개월로 나눠 미리 확인하는 것이 좋습니다.`,
        ],
      },
      {
        heading: "주 15시간 미만이면 주휴수당이 빠집니다",
        body: [
          "근로기준법 제18조제3항은 4주 동안을 평균해 1주 소정근로시간이 15시간 미만인 근로자에게는 주휴일(제55조)과 연차휴가(제60조)를 적용하지 않습니다. 그래서 주 15시간 미만으로 일하면 주휴수당 없이 일한 시간 × 시급만 받습니다. 표에서 주 10시간과 주 15시간의 월급 차이가 시간 차이보다 큰 이유입니다.",
          `실제로 2027년 기준 주 10시간 월급은 약 ${won(mw10.next)}, 주 15시간은 약 ${won(mw15.next)}입니다. 일하는 시간은 1.5배지만 월급은 약 ${(mw15.next / mw10.next).toFixed(1)}배가 됩니다. 주휴수당은 1주 소정근로일을 개근해야 생기므로(근로기준법 시행령 제30조제1항), 결근한 주에는 그 주의 주휴수당이 빠질 수 있습니다.`,
          "다만 최저임금 자체는 근로시간과 관계없이 적용됩니다. 주 몇 시간을 일하든 시간당 임금이 최저임금보다 적으면 안 됩니다. 월급제라면 월급을 주휴시간까지 포함한 한 달 기준시간(주 40시간이면 209시간)으로 나눈 값이 최저임금 이상인지 봅니다. 최저임금위원회가 주 40시간 월급을 209시간 기준으로 함께 밝히는 것도 같은 방식입니다.",
        ],
      },
      {
        heading: "수습 기간 감액은 조건이 까다롭습니다",
        body: [
          `최저임금법 제5조제2항과 시행령 제3조는 1년 이상의 기간을 정해 근로계약을 맺고 수습 중인 근로자에 한해, 수습을 시작한 날부터 3개월까지 최저임금의 10%를 뺀 금액까지 줄일 수 있게 합니다. 2027년 기준으로는 시간당 ${won(MW_NEXT * (1 - MW_PROBATION_CUT))}, 주 40시간 월급으로는 ${won(MW_NEXT * (1 - MW_PROBATION_CUT) * 209)}입니다.`,
          "조건 세 가지를 모두 채워야 합니다. 근로계약 기간이 1년 이상이어야 하므로 6개월 계약직이나 몇 달짜리 아르바이트는 수습이라는 이름을 붙여도 감액할 수 없습니다. 감액은 수습 시작일부터 3개월까지만 가능하고, 단순노무업무로 고용노동부 장관이 고시한 직종에 종사하는 근로자는 아예 감액할 수 없습니다.",
        ],
      },
      {
        heading: "최저임금에 들어가는 임금과 빠지는 임금",
        body: [
          "최저임금을 지키는지 볼 때는 매달 1회 이상 정기적으로 주는 임금을 넣습니다(최저임금법 제6조제4항). 연장·야간·휴일근로 수당처럼 소정근로시간 외의 근로에 대해 주는 임금은 넣지 않습니다. 매달 주는 정기 상여금과 식비·교통비 같은 복리후생비는 2019년부터 단계적으로 넣는 비율이 늘어났고, 법 부칙에 따라 2024년부터는 빼는 부분 없이 모두 넣습니다. 구체적으로는 2019년에 매달 주는 상여금 가운데 최저임금 월 환산액의 25%, 현금 복리후생비 가운데 7%를 넘는 부분만 넣기 시작해, 빼는 비율이 2020년 20%·5%, 2021년 15%·3%, 2022년 10%·2%, 2023년 5%·1%로 줄었습니다. 다만 복리후생비 중 돈이 아닌 현물로 주는 것은 지금도 넣지 않습니다.",
          `예를 들어 주 40시간 일하며 기본급 210만 원과 매달 식대 20만 원을 받는다면, 둘을 더한 230만 원을 209시간으로 나눈 약 ${won(2_300_000 / 209)}이 2027년 최저임금 ${won(MW_NEXT)} ${2_300_000 / 209 >= MW_NEXT ? "이상이므로 위반이 아닙니다" : "보다 적어 위반입니다"}. 같은 사람이 식대 없이 기본급 210만 원만 받는다면 시간당 약 ${won(2_100_000 / 209)}으로 ${2_100_000 / 209 >= MW_NEXT ? "기준 이상입니다" : "기준에 못 미칩니다"}. 분기마다 주는 상여금처럼 매달 주지 않는 돈은 들어가지 않습니다.`,
        ],
      },
      {
        heading: "연도별 최저임금 흐름",
        body: [
          `최근 몇 년 동안의 최저임금과 전년 대비 인상률입니다. 최저임금위원회의 연도별 결정현황을 기준으로 했습니다. 최저임금은 근로자의 생계비, 비슷한 근로자의 임금, 노동생산성, 소득분배율 등을 고려해 정합니다(최저임금법 제4조). ${RATES.year + 1}년 인상률 ${(mwRate * 100).toFixed(1)}%는 ${mwPrevBig ? `${mwPrevBig.year}년(${((mwPrevBig.rise ?? 0) * 100).toFixed(1)}%) 이후 가장 큰 폭이고` : "표의 기간 중 가장 큰 폭이고"}, ${mwFirst.year}년 ${won(mwFirst.hourly)}과 비교하면 ${(((MW_NEXT - mwFirst.hourly) / mwFirst.hourly) * 100).toFixed(1)}% 올랐습니다.`,
        ],
        table: {
          caption: "연도별 시간급 최저임금",
          head: ["적용 연도", "시간급", "주 40시간 월급(209시간)", "전년 대비"],
          rows: mwHistory.map((x) => [`${x.year}년`, won(x.hourly), won(x.hourly * 209), x.rise === null ? "-" : `${(x.rise * 100).toFixed(1)}%`]),
          note: "인상률은 시간급으로 계산해 소수 첫째 자리에서 반올림했습니다.",
        },
        after: [
          "최저임금이 오르면 함께 움직이는 것도 있습니다. 시급제 근로자의 주휴수당과 연장·야간·휴일근로 수당은 시급이 오른 만큼 함께 늘어납니다. 회사는 바뀐 최저임금을 근로자가 쉽게 볼 수 있는 곳에 게시하거나 다른 적당한 방법으로 알려야 합니다(최저임금법 제11조).",
        ],
      },
      {
        heading: "1월 급여에서 확인할 것",
        body: [
          "2027년 1월분 급여명세서를 받으면 먼저 기본급과 매달 고정으로 받는 수당의 합계를 구하고, 연장·야간·휴일근로 수당은 뺍니다. 이 금액을 한 달 기준시간(주 40시간이면 209시간)으로 나눠 시간당 금액이 새 최저임금 이상인지 봅니다. 시급제라면 계약서의 시급이 1월부터 바뀌었는지 확인하면 됩니다.",
          `연봉제도 같은 방법으로 봅니다. 연봉 ${man(MW_ANNUAL_EX)}을 12개월로 나눈 월급을 209시간으로 나누면 시간당 약 ${won(mwAnnualHourly)}으로, 2027년 최저임금 ${won(MW_NEXT)}${mwAnnualHourly >= MW_NEXT ? " 이상입니다" : "에 못 미칩니다"}. 연봉에 연장근로 수당이 미리 포함된 계약이라면 그 부분을 빼고 계산해야 합니다. 또 최저임금이 올랐다는 이유로 기존 임금 수준을 낮추는 것은 금지됩니다(최저임금법 제6조제2항).`,
          "최저임금보다 적게 정한 근로계약은 그 부분이 무효가 되고 최저임금으로 정한 것으로 봅니다(최저임금법 제6조제3항). 계약서를 새로 쓰지 않았더라도 1월부터는 오른 최저임금 이상을 받아야 한다는 뜻입니다. 최저임금보다 적게 준 사용자는 3년 이하의 징역 또는 2천만 원 이하의 벌금 대상입니다(제28조). 받지 못한 차액은 임금이므로 3년 안에 청구해야 합니다(근로기준법 제49조). 시급과 월급은 시급·월급·연봉 변환기로 서로 바꿔 볼 수 있고, 내 경우가 최저임금 위반인지 판단하기 어렵다면 고용노동부 고객상담센터(국번 없이 1350)나 관할 지방고용노동관서에 확인하세요.",
        ],
      },
    ],
    sources: [
      { label: "최저임금위원회 – 연도별 최저임금 결정현황", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do" },
      { label: "국가법령정보센터 – 최저임금법(제3조, 제5조~제8조, 제10조, 제11조, 제14조, 제28조, 부칙)", url: "https://www.law.go.kr/법령/최저임금법" },
      { label: "국가법령정보센터 – 최저임금법 시행령(제3조 수습 중인 근로자의 최저임금액)", url: "https://www.law.go.kr/법령/최저임금법시행령" },
      { label: "국가법령정보센터 – 근로기준법(제18조 단시간근로자의 근로조건, 제49조 임금의 시효)", url: "https://www.law.go.kr/법령/근로기준법" },
      { label: "국가법령정보센터 – 근로기준법 시행령(제30조 주휴일)", url: "https://www.law.go.kr/법령/근로기준법시행령" },
    ],
  },
  {
    slug: "2027-pay-insurance-changes",
    title: "2027년 바뀌는 급여·보험료: 국민연금 5%, 장기요양보험료, 최저임금",
    description:
      "2027년 1월부터 국민연금 근로자 부담률이 5%로 오르고 장기요양보험료율도 오릅니다. 건강보험료율은 7.19%로 그대로입니다. 월급 250·300·400만 원의 2026년과 2027년 근로자 부담 보험료를 비교했습니다.",
    date: "2026-12-30",
    tool: "social-insurance",
    sections: [
      {
        heading: `월급 300만 원이면 매달 ${won(chg300.b.total - chg300.a.total)} 더 빠집니다`,
        body: [
          `2027년 1월부터 월급 300만 원 직장인의 국민연금·건강보험·장기요양보험 근로자 부담은 월 ${won(chg300.a.total)}에서 ${won(chg300.b.total)}으로 ${won(chg300.b.total - chg300.a.total)} 늘어납니다. 월급 ${man(chgRows[0].pay)}이면 ${won(chgRows[0].b.total - chgRows[0].a.total)}, ${man(chgRows[2].pay)}이면 ${won(chgRows[2].b.total - chgRows[2].a.total)}이 늘어납니다. 국민연금 근로자 부담률이 ${(RATES.pension.rate * 100).toFixed(2)}%에서 ${(PENSION_2027 * 100).toFixed(2)}%로 오르고, 장기요양보험료율도 오르기 때문입니다. 건강보험료율은 ${(HEALTH_TOTAL_2027 * 100).toFixed(2)}%(근로자 ${(HEALTH_2027 * 100).toFixed(3)}%)로 2026년과 같습니다.`,
          `정리하면 2027년에 확정된 변화는 국민연금 보험료율 인상(9.5%→10%), 장기요양보험료율 인상(0.9448%→0.9994%), 최저임금 인상(시간당 ${won(RATES.minimumWage)}→${won(NEXT_MIN_WAGE)})이고, 건강보험료율은 동결입니다. 이 글은 2026년 11월까지 법령과 보건복지부 발표로 확정된 값만 표에 넣었습니다. 고용보험료율 인상안과 2027년 산재보험료율, 2027년 7월부터 적용할 국민연금 기준소득월액 상·하한처럼 아직 확정되지 않았거나 발표 전인 것은 본문에서 따로 설명합니다.`,
        ],
      },
      {
        heading: "국민연금: 2027년 10%, 근로자 5%",
        body: [
          "2025년 연금개혁으로 국민연금법이 바뀌어 보험료율은 2026년 9.5%부터 해마다 0.5%포인트씩 올라 2033년 13%가 됩니다. 직장인은 이 보험료를 회사와 절반씩 내므로, 근로자 부담은 2026년 4.75%에서 2027년 5%가 됩니다(국민연금법 부칙 제4조).",
          `지역가입자와 임의가입자는 같은 보험료를 본인이 모두 냅니다. 기준소득월액이 100만 원인 지역가입자라면 월 보험료가 2026년 ${won(1_000_000 * RATES.pension.rate * 2)}에서 2027년 ${won(1_000_000 * PENSION_2027 * 2)}으로 오릅니다.`,
        ],
        table: {
          caption: "연도별 직장인 국민연금 보험료율(기준소득월액 대비)",
          head: ["연도", "근로자 부담", "회사 부담", "합계"],
          rows: PENSION_SCHEDULE.map((x) => [`${x.year}년`, `${(x.employee * 100).toFixed(2)}%`, `${(x.employee * 100).toFixed(2)}%`, `${(x.employee * 200).toFixed(1)}%`]),
          note: "2026~2032년은 국민연금법 부칙 제4조, 2033년부터는 제88조제3항의 비율입니다. 지역가입자·임의가입자는 합계 비율을 본인이 모두 냅니다.",
        },
        after: [
          `보험료는 기준소득월액에 요율을 곱해 정합니다. 기준소득월액의 상한은 ${RATES.year}년 7월부터 ${RATES.year + 1}년 6월까지 ${won(RATES.pension.maxBase)}, 하한은 ${won(RATES.pension.minBase)}입니다. 상·하한은 해마다 7월에 바뀌는데, 2027년 7월부터 적용할 새 상·하한은 2026년 11월 확인 기준 아직 발표 전입니다. 그래서 상한에 걸리는 고소득자는 2027년 7월 이후 보험료가 아래 표와 조금 달라질 수 있습니다.`,
        ],
      },
      {
        heading: "건강보험료율은 7.19% 그대로",
        body: [
          `보건복지부 건강보험정책심의위원회는 2026년 9월 8일 2027년 건강보험료율을 2026년과 같은 ${(HEALTH_TOTAL_2027 * 100).toFixed(2)}%로 유지하기로 했습니다. 직장인은 회사와 절반씩 내므로 근로자 부담은 보수월액의 ${(HEALTH_2027 * 100).toFixed(3)}%로 바뀌지 않습니다.`,
          "다만 요율이 같아도 건강보험료가 그대로라는 뜻은 아닙니다. 건강보험료는 보수에 요율을 곱해 정하므로 2027년에 월급이 오르면 그만큼 보험료도 늘어납니다. 보건복지부는 보험료 수입 증가와 함께 국민의 보험료 부담을 덜어 줄 필요가 있다는 의견이 모여 동결을 결정했다고 설명했습니다.",
          "같은 자리에서 보건복지부는 희귀질환·중증난치질환자의 건강보험 본인부담률을 10%에서 2026년 12월 7%로, 2028년에는 5%로 단계적으로 낮추겠다고 밝혔습니다. 보험료율은 그대로 두면서 보장 범위를 넓히는 방향입니다.",
        ],
      },
      {
        heading: "장기요양보험료율은 오릅니다",
        body: [
          `보건복지부는 2026년 10월 30일 장기요양위원회에서 2027년 장기요양보험료율을 소득 대비 ${(LTC_INCOME_2027 * 100).toFixed(4)}%로 결정했다고 발표했습니다. 2026년 ${(LTC_INCOME_2026 * 100).toFixed(4)}%보다 ${(((LTC_INCOME_2027 - LTC_INCOME_2026) / LTC_INCOME_2026) * 100).toFixed(2)}% 오른 수준입니다. 건강보험료 대비로는 ${(RATES.longTermCare.rateOfHealth * 100).toFixed(2)}%에서 ${(LTC_OF_HEALTH_2027 * 100).toFixed(2)}%가 됩니다.`,
          `장기요양보험료는 건강보험료에 이 비율을 곱해 함께 걷습니다. 건강보험료가 월 10만 원이면 장기요양보험료는 2026년 ${won(100_000 * RATES.longTermCare.rateOfHealth)}에서 2027년 약 ${won(100_000 * LTC_OF_HEALTH_2027)}이 됩니다. 월 보수 300만 원인 직장인의 근로자 부담으로는 ${won(chg300.a.care)}에서 ${won(chg300.b.care)}으로 ${won(chg300.b.care - chg300.a.care)} 늘어납니다. 2026년 11월 확인 기준으로 노인장기요양보험법 시행령의 요율 조항은 아직 2026년 값(100만분의 9,448)이고, 2027년 요율은 이 조항을 고쳐 반영합니다.`,
          "보건복지부는 같은 위원회에서 2027년 장기요양 제도개선 과제도 의결했다고 밝혔습니다. 집에서 돌봄을 받는 재가서비스의 월 이용 한도액을 등급에 따라 2만 3,880원~37만 8,500원 올리고, 방문간호 가산액을 높이되 수급자 본인부담금은 늘리지 않는 내용 등이 들어 있습니다.",
        ],
      },
      {
        heading: "월급별 2026년과 2027년 근로자 부담 비교",
        body: [
          "확정된 요율로 계산한 국민연금·건강보험·장기요양보험 근로자 부담입니다. 회사도 같은 금액을 냅니다. 고용보험은 2027년 요율이 확정되지 않아 표에서 뺐습니다.",
        ],
        table: {
          caption: "월 보수별 근로자 부담 보험료(국민연금 + 건강보험 + 장기요양보험)",
          head: ["월 보수", "국민연금(2026→2027)", "건강보험(2026→2027)", "장기요양(2026→2027)", "합계(2026→2027)", "늘어나는 금액"],
          rows: chgRows.map((r) => [
            r.pay === Math.round(NEXT_MIN_WAGE * 209) ? `${won(r.pay)}(2027년 최저임금 월급)` : man(r.pay),
            `${won(r.a.pension)} → ${won(r.b.pension)}`,
            `${won(r.a.health)} → ${won(r.b.health)}`,
            `${won(r.a.care)} → ${won(r.b.care)}`,
            `${won(r.a.total)} → ${won(r.b.total)}`,
            won(r.b.total - r.a.total),
          ]),
          note: "월 보수는 비과세 수당을 뺀 금액입니다. 10원 미만 버림. 국민연금은 2027년 6월까지의 기준소득월액 상·하한을 적용했습니다. 마지막 줄은 같은 금액을 두 해의 요율로 계산한 것입니다.",
        },
        after: [
          "늘어나는 금액의 대부분은 국민연금입니다. 국민연금 근로자 부담이 0.25%포인트 올라 월 보수 100만 원당 2,500원씩 더 내고, 장기요양보험료가 조금 더해집니다. 국민연금 보험료는 나중에 받을 연금액 계산에 반영되는 돈이라 다른 보험료와 성격이 다릅니다.",
          `1년으로 보면 월 보수 300만 원인 사람은 국민연금으로 ${won((chg300.b.pension - chg300.a.pension) * 12)}, 장기요양보험료로 ${won((chg300.b.care - chg300.a.care) * 12)}을 더 냅니다. 회사도 국민연금·건강보험·장기요양보험을 근로자와 같은 금액으로 내므로, 직원 한 명당 회사 부담도 같은 만큼 늘어납니다. 4대보험 계산기와 연봉 실수령액 계산기는 2026년 요율로 계산하므로, 2027년 1월 이후의 실제 공제액은 계산기 결과보다 이 표의 2027년 값에 가깝습니다.`,
        ],
      },
      {
        heading: "아직 확정되지 않은 것: 고용보험·산재보험",
        body: [
          "고용노동부는 2026년 9월 1일 고용보험위원회에서 고용보험 제도개편 방안을 심의하고, 2027년에 실업급여 계정 보험료율을 근로자와 회사가 각각 0.1%포인트씩 올려 1.8%에서 2.0%로 하는 방안을 발표했습니다. 이 인상은 고용보험료징수법 시행령을 고쳐야 하는데, 2026년 11월 확인 기준 시행령의 실업급여 보험료율은 아직 1천분의 18(근로자 0.9%)입니다. 그래서 이 글의 표에는 넣지 않았고, 시행령이 바뀌면 근로자 부담이 0.9%에서 1.0%로 오르게 됩니다.",
          "같은 개편 방안에는 2028년에 육아휴직급여 등 모성보호급여를 위한 별도 계정을 만들고, 구직급여를 주 7일이 아니라 무급휴일을 뺀 주 6일 기준으로 지급하는 방식으로 바꾸는 내용도 들어 있습니다. 보험설계사, 방과후학교 강사 등 4개 직종 노무제공자의 고용보험 적용 범위를 2027년 1월부터 넓히겠다는 계획도 함께 발표됐습니다. 모두 법률과 하위법령을 고쳐야 하는 계획이라, 실제 시행 여부와 시기는 개정 결과를 확인해야 합니다.",
          "산재보험료는 회사만 내는 보험료라 근로자 월급에서는 빠지지 않습니다. 2027년 업종별 산재보험료율은 2026년 11월 확인 기준 아직 고시 전입니다. 4대보험 계산기는 2026년 요율로 계산합니다.",
        ],
      },
      {
        heading: "최저임금과 1월 급여에서 확인할 것",
        body: [
          `2027년 최저임금은 시간당 ${won(NEXT_MIN_WAGE)}으로, 주 40시간 기준 월급은 ${won(NEXT_MIN_WAGE * 209)}입니다(2026년 7월 14일 최저임금위원회 의결, 8월 5일 고시). 2026년 최저임금 월급 ${won(RATES.minimumWage * 209)}을 받던 사람의 보험료는 ${won(insuranceOf(RATES.minimumWage * 209).pension + insuranceOf(RATES.minimumWage * 209).health + insuranceOf(RATES.minimumWage * 209).longTermCare)}에서 ${won(ins2027(NEXT_MIN_WAGE * 209).total)}으로 늘지만, 월급이 ${won((NEXT_MIN_WAGE - RATES.minimumWage) * 209)} 오르므로 보험료를 빼고도 매달 약 ${won((NEXT_MIN_WAGE - RATES.minimumWage) * 209 - (ins2027(NEXT_MIN_WAGE * 209).total - (insuranceOf(RATES.minimumWage * 209).pension + insuranceOf(RATES.minimumWage * 209).health + insuranceOf(RATES.minimumWage * 209).longTermCare)))}이 더 남습니다(고용보험·소득세 제외).`,
          "2027년 1월분 급여명세서를 받으면 국민연금이 기준소득월액의 5%로 바뀌었는지, 장기요양보험료가 건강보험료의 새 비율로 계산되었는지 확인해 보세요. 고용보험은 시행령이 바뀌지 않았다면 그대로 0.9%이고, 인상안이 확정되면 1.0%로 바뀝니다. 내 월급에 맞는 금액은 4대보험 계산기와 연봉 실수령액 계산기로 볼 수 있습니다. 회사 규모·업종·개인 사정에 따라 실제 금액이 다를 수 있으니 회사 급여 담당자나 각 공단에 확인하세요.",
        ],
      },
    ],
    sources: [
      { label: "국가법령정보센터 – 국민연금법(제88조, 부칙 제4조 연금보험료에 관한 특례)", url: "https://www.law.go.kr/법령/국민연금법" },
      { label: "대한민국 정책브리핑 – 2027년도 건강보험료율 심의 결과 브리핑(2026. 9. 8.)", url: "https://www.korea.kr/policy/civilView.do?newsId=156780681" },
      { label: "대한민국 정책브리핑 – 2027년 장기요양보험료율 0.9994% 결정(2026. 11. 2.)", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148974757" },
      { label: "고용노동부 보도자료 – 고용보험 제도개편 방안(2027년 실업급여 보험료율 인상안)", url: "https://www.moel.go.kr/news/enews/report/enewsView.do?news_seq=19866" },
      { label: "최저임금위원회 – 연도별 최저임금 결정현황", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do" },
    ],
  },
];
