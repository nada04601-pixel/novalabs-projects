export type SeveranceInput = {
  startDate: string; // 입사일 YYYY-MM-DD
  endDate: string; // 퇴사일(마지막 근무일 다음 날) YYYY-MM-DD
  last3MonthsWage: number; // 퇴직 전 3개월 임금 총액(원)
  annualBonus: number; // 직전 1년 상여금 총액(원)
  annualLeavePay: number; // 직전 1년 연차수당(원)
  monthlyOrdinaryWage?: number; // 월 통상임금(기본급 + 매달 고정으로 받는 수당). 넣으면 1일 통상임금과 비교합니다.
};

export type SeveranceResult = {
  eligible: boolean;
  serviceDays: number;
  periodDays: number; // 평균임금 산정기간(퇴직 전 3개월) 일수
  averageDailyWage: number;
  ordinaryDailyWage: number; // 1일 통상임금(월 통상임금을 넣지 않으면 0)
  dailyWage: number; // 퇴직금 계산에 쓴 1일 임금(평균임금과 통상임금 중 큰 쪽)
  usesOrdinary: boolean; // 통상임금이 더 커서 통상임금으로 계산했는지
  severancePay: number;
};

// 1일 통상임금(주 5일 근무 기준): 월 통상임금 ÷ 209시간 × 8시간 (근로기준법 시행령 제6조).
// 하루 근무시간이 짧아도 월 소정근로시간이 같은 비율로 줄어 결과는 같습니다.
export const ordinaryDailyFromMonthly = (monthly: number) => (monthly > 0 ? (monthly / 209) * 8 : 0);

const DAY = 86_400_000;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function calcSeverance(input: SeveranceInput): SeveranceResult | null {
  const start = parse(input.startDate);
  const end = parse(input.endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  const serviceDays = Math.round((end - start) / DAY);
  // 퇴직일 이전 3개월(달력 기준) 일수
  const e = new Date(end);
  const threeMonthsAgo = Date.UTC(e.getUTCFullYear(), e.getUTCMonth() - 3, e.getUTCDate());
  const periodDays = Math.round((end - threeMonthsAgo) / DAY);

  const wages = input.last3MonthsWage + (input.annualBonus * 3) / 12 + (input.annualLeavePay * 3) / 12;
  const averageDailyWage = periodDays > 0 ? wages / periodDays : 0;
  // 평균임금이 통상임금보다 적으면 통상임금을 평균임금으로 합니다(근로기준법 제2조제2항).
  const ordinaryDailyWage = ordinaryDailyFromMonthly(input.monthlyOrdinaryWage ?? 0);
  const dailyWage = Math.max(averageDailyWage, ordinaryDailyWage);
  const severancePay = dailyWage * 30 * (serviceDays / 365);

  // 계속근로 1년은 달력상 1년입니다. 2월 29일이 끼면 365일을 채워도 하루 모자랄 수 있어 날짜로 비교합니다.
  const s = new Date(start);
  const oneYearLater = Date.UTC(s.getUTCFullYear() + 1, s.getUTCMonth(), s.getUTCDate());

  return {
    eligible: end >= oneYearLater,
    serviceDays,
    periodDays,
    averageDailyWage,
    ordinaryDailyWage,
    dailyWage,
    usesOrdinary: ordinaryDailyWage > averageDailyWage,
    severancePay: Math.floor(severancePay),
  };
}
