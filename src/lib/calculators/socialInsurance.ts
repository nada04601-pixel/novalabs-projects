import { RATES as R } from "@/data/rates/2026";

// 4대보험 계산기: 근로자 부담분과 회사(사업주) 부담분을 함께 계산합니다.
// 근로자 부담 요율과 계산 순서는 연봉 실수령액 계산기(netSalary.ts)와 같습니다.

// 고용보험 중 고용안정·직업능력개발사업 보험료율(사업주만 부담).
// 출처: 근로복지공단 보험료율 안내(https://www.comwel.or.kr/comwel/paym/paym/tari.jsp), 확인 2026-11-27
export const STABILITY_RATES = [
  { key: "under150", label: "150명 미만 기업", rate: 0.0025 },
  { key: "priority", label: "150명 이상 우선지원대상기업", rate: 0.0045 },
  { key: "under1000", label: "150명 이상 1,000명 미만 기업", rate: 0.0065 },
  { key: "over1000", label: "1,000명 이상 기업, 국가·지방자치단체", rate: 0.0085 },
] as const;
export type StabilityKey = (typeof STABILITY_RATES)[number]["key"];

// 2026년 사업종류별 산재보험료율(천분율, 출퇴근재해 0.6 포함). 출처는 위와 같은 근로복지공단 보험료율 안내, 확인 2026-11-27
// 회사의 정확한 사업종류와 요율은 근로복지공단에서 받은 보험료 고지서나 "산재보험 사업종류 검색기"로 확인합니다.
export const INDUSTRIAL_RATES: { code: string; label: string; permille: number }[] = [
  { code: "907", label: "전문·보건·교육·여가 관련 서비스업", permille: 6.6 },
  { code: "000", label: "금융 및 보험업", permille: 5.6 },
  { code: "224", label: "전기기계기구·정밀기구·전자제품 제조업", permille: 6.6 },
  { code: "911", label: "부동산업 및 임대업", permille: 7.6 },
  { code: "300", label: "전기·가스·증기 및 수도사업", permille: 7.6 },
  { code: "910", label: "도소매·음식·숙박업", permille: 8.6 },
  { code: "901", label: "시설관리 및 사업지원 서비스업", permille: 8.6 },
  { code: "905", label: "기타의 각종 사업", permille: 8.6 },
  { code: "500", label: "철도·항공·창고·운수 관련 서비스업", permille: 8.6 },
  { code: "510", label: "통신업", permille: 9.6 },
  { code: "206", label: "출판·인쇄·제본업", permille: 9.6 },
  { code: "202", label: "섬유 및 섬유제품 제조업", permille: 11.6 },
  { code: "229", label: "수제품 및 기타제품 제조업", permille: 12.6 },
  { code: "209", label: "화학 및 고무제품 제조업", permille: 13.6 },
  { code: "218", label: "기계기구·금속·비금속광물제품 제조업", permille: 13.6 },
  { code: "200", label: "식료품 제조업", permille: 16.6 },
  { code: "501", label: "육상 및 수상운수업", permille: 18.6 },
  { code: "800", label: "농업", permille: 20.6 },
  { code: "226", label: "선박건조 및 수리업", permille: 24.6 },
  { code: "400", label: "건설업", permille: 35.6 },
];

// 산재보험료와 함께 사업주가 내는 부담금(천분율). 같은 출처, 2026년 값.
export const WAGE_CLAIM_PERMILLE = 0.6; // 임금채권부담금
export const ASBESTOS_PERMILLE = 0.06; // 석면피해구제분담금

export type SocialInsuranceInput = {
  monthlyPay: number; // 월 급여(세전)
  monthlyNonTaxable: number; // 월 비과세액(식대 등)
  stability: StabilityKey; // 회사 규모(고용안정·직업능력개발사업 요율)
  industrialPermille: number; // 산재보험료율(천분율, 출퇴근재해 포함)
  over60?: boolean; // 만 60세 이상: 국민연금 의무가입 대상이 아님
  hiredAfter65?: boolean; // 만 65세 이후 새로 고용: 고용보험 실업급여 보험료 없음
};

export type InsuranceRow = { key: string; label: string; employee: number; employer: number };

export type SocialInsuranceResult = {
  base: number; // 보험료 기준 월 보수(세전 − 비과세)
  pensionBase: number; // 국민연금 기준소득월액(상·하한 적용, 천 원 미만 버림)
  rows: InsuranceRow[];
  employeeTotal: number;
  employerTotal: number;
  total: number;
  takeHomeBeforeTax: number; // 월 급여 − 근로자 4대보험(소득세는 빼지 않음)
  companyCost: number; // 월 급여 + 사업주 부담
};

// 10원 미만 버림. 소수 계산 오차(26,999.999…)로 10원이 덜 나오지 않게 먼저 소수 둘째 자리에서 반올림합니다.
export const floor10 = (v: number) => Math.floor(Math.round(v * 100) / 1000) * 10;

export const stabilityRate = (key: StabilityKey) => STABILITY_RATES.find((s) => s.key === key)?.rate ?? STABILITY_RATES[0].rate;

export function calcSocialInsurance(input: SocialInsuranceInput): SocialInsuranceResult {
  const pay = Math.max(0, input.monthlyPay);
  const nonTax = Math.min(Math.max(0, input.monthlyNonTaxable), pay);
  const base = pay - nonTax;
  const has = base > 0;

  const pensionBase = Math.floor(Math.min(Math.max(base, R.pension.minBase), R.pension.maxBase) / 1000) * 1000;
  const pension = has && !input.over60 ? floor10(pensionBase * R.pension.rate) : 0;
  const health = has ? floor10(base * R.health.rate) : 0;
  const longTermCare = floor10(health * R.longTermCare.rateOfHealth);
  const unemployment = has && !input.hiredAfter65 ? floor10(base * R.employment.rate) : 0;
  const stability = has ? floor10(base * stabilityRate(input.stability)) : 0;
  const permille = Math.max(0, input.industrialPermille);
  const industrial = has ? floor10((base * permille) / 1000) : 0;
  const wageClaim = has ? floor10((base * WAGE_CLAIM_PERMILLE) / 1000) : 0;
  const asbestos = has ? floor10((base * ASBESTOS_PERMILLE) / 1000) : 0;

  const rows: InsuranceRow[] = [
    { key: "pension", label: "국민연금", employee: pension, employer: pension },
    { key: "health", label: "건강보험", employee: health, employer: health },
    { key: "longTermCare", label: "장기요양보험", employee: longTermCare, employer: longTermCare },
    { key: "unemployment", label: "고용보험(실업급여)", employee: unemployment, employer: unemployment },
    { key: "stability", label: "고용보험(고용안정·직업능력개발)", employee: 0, employer: stability },
    { key: "industrial", label: "산재보험", employee: 0, employer: industrial },
    { key: "wageClaim", label: "임금채권부담금", employee: 0, employer: wageClaim },
    { key: "asbestos", label: "석면피해구제분담금", employee: 0, employer: asbestos },
  ];
  const employeeTotal = rows.reduce((s, r) => s + r.employee, 0);
  const employerTotal = rows.reduce((s, r) => s + r.employer, 0);
  return {
    base,
    pensionBase,
    rows,
    employeeTotal,
    employerTotal,
    total: employeeTotal + employerTotal,
    takeHomeBeforeTax: pay - employeeTotal,
    companyCost: pay + employerTotal,
  };
}
