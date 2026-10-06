export type OvertimeInput = {
  hourlyWage: number; // 통상시급
  overtimeHours: number; // 연장근로 시간
  nightHours: number; // 야간근로 시간(22시~06시). 다른 근로와 겹쳐도 그대로 입력
  holidayHours: number; // 휴일근로 시간(하루 8시간 이내분)
  holidayOverHours: number; // 휴일근로 시간(하루 8시간 초과분)
  fiveOrMore: boolean; // 상시 근로자 5인 이상 사업장
};

export type OvertimeResult = {
  overtimeBase: number;
  overtimePremium: number;
  holidayBase: number;
  holidayPremium: number;
  nightPremium: number;
  total: number;
};

// 연장·휴일근로는 일한 시간분(기본)과 가산분을 나눠 계산하고, 야간은 가산분(50%)만 더합니다.
// 5인 미만 사업장은 가산 의무가 없어 일한 시간분만 계산합니다.
export function calcOvertime(i: OvertimeInput): OvertimeResult {
  const w = i.hourlyWage;
  const on = i.fiveOrMore ? 1 : 0;
  const overtimeBase = w * i.overtimeHours;
  const overtimePremium = w * i.overtimeHours * 0.5 * on;
  const holidayBase = w * (i.holidayHours + i.holidayOverHours);
  const holidayPremium = (w * i.holidayHours * 0.5 + w * i.holidayOverHours * 1.0) * on;
  const nightPremium = w * i.nightHours * 0.5 * on;
  return {
    overtimeBase,
    overtimePremium,
    holidayBase,
    holidayPremium,
    nightPremium,
    total: overtimeBase + overtimePremium + holidayBase + holidayPremium + nightPremium,
  };
}
