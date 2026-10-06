import { daysBetween } from "./date";

// 두 날짜 사이 일수. includeStart면 시작일도 1일로 셉니다(예: 근무 일수, 기념일).
export function diffDays(start: Date, end: Date, includeStart: boolean) {
  const d = daysBetween(start, end);
  return includeStart ? d + (d >= 0 ? 1 : -1) : d;
}

// 기준일에서 n일 뒤(음수면 전). countStartAsDay1이면 기준일을 1일째로 봅니다(100일 = 기준일 + 99일).
export function addDays(base: Date, n: number, countStartAsDay1: boolean) {
  const offset = countStartAsDay1 && n !== 0 ? n - Math.sign(n) : n;
  return new Date(base.getTime() + offset * 86_400_000);
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
