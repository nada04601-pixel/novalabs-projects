import { WEEKS_PER_MONTH } from "./weeklyHolidayPay";

export type WageBasis = "hourly" | "monthly" | "annual";

// 월 환산 시간 = (주 소정근로시간 + 주휴시간) × 365 ÷ 7 ÷ 12.
// 주 40시간은 급여 실무에서 쓰는 209시간을 그대로 씁니다.
export function monthlyPaidHours(weeklyHours: number) {
  const w = Math.min(Math.max(weeklyHours, 0), 40);
  if (w >= 40) return 209;
  const holiday = w >= 15 ? (w / 40) * 8 : 0;
  return (w + holiday) * WEEKS_PER_MONTH;
}

export function convertWage(basis: WageBasis, amount: number, weeklyHours: number) {
  const hours = monthlyPaidHours(weeklyHours);
  const monthly = basis === "hourly" ? amount * hours : basis === "monthly" ? amount : amount / 12;
  const hourly = hours > 0 ? monthly / hours : 0;
  return { hours, hourly, monthly, annual: monthly * 12 };
}
