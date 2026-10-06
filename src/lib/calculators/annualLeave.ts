import { addMonths, daysBetween, fullMonths } from "./date";

export type AnnualLeaveResult = {
  serviceDays: number; // 입사일부터 기준일까지 일수
  years: number; // 채운 근속연수
  months: number; // 채운 근속개월
  firstYearLeave: number; // 입사 첫해 월 단위 연차(최대 11일)
  currentLeave: number; // 기준일 현재 해당 연도에 생긴 연차
  nextGrantDate: Date | null; // 다음 연차가 생기는 날
  nextGrantDays: number; // 그날 생기는 일수
};

// 근속연수에 따른 연차(1년 15일, 이후 2년마다 1일, 최대 25일)
export const leaveForYears = (years: number) => (years < 1 ? 0 : Math.min(15 + Math.floor((years - 1) / 2), 25));

// 입사일 기준 연차 일수. 매달 개근, 매년 출근율 80% 이상을 가정합니다.
export function calcAnnualLeave(join: Date, ref: Date): AnnualLeaveResult {
  const months = ref < join ? 0 : fullMonths(join, ref);
  const years = Math.floor(months / 12);
  const firstYearLeave = Math.min(months, 11);
  const currentLeave = years < 1 ? firstYearLeave : leaveForYears(years);
  let nextGrantDate: Date | null;
  let nextGrantDays: number;
  if (ref < join) {
    nextGrantDate = addMonths(join, 1);
    nextGrantDays = 1;
  } else if (months < 11) {
    nextGrantDate = addMonths(join, months + 1);
    nextGrantDays = 1;
  } else {
    nextGrantDate = addMonths(join, (years + 1) * 12);
    nextGrantDays = leaveForYears(years + 1);
  }
  return {
    serviceDays: Math.max(0, daysBetween(join, ref)),
    years,
    months,
    firstYearLeave,
    currentLeave,
    nextGrantDate,
    nextGrantDays,
  };
}

// 미사용 연차수당 = 1일 통상임금 × 남은 일수. 1일 통상임금 = 월 통상임금 ÷ 월 기준시간 × 하루 소정근로시간
export function calcLeaveAllowance(monthlyOrdinaryWage: number, monthlyHours: number, dailyHours: number, unusedDays: number) {
  const hourly = monthlyHours > 0 ? monthlyOrdinaryWage / monthlyHours : 0;
  const daily = hourly * dailyHours;
  return { hourly, daily, allowance: daily * unusedDays };
}
