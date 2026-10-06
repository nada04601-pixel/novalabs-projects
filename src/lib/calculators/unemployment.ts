import { RATES } from "@/data/rates/2026";

export type InsuredPeriod = "lt1" | "1to3" | "3to5" | "5to10" | "10plus";

// 구직급여 소정급여일수(고용보험법 별표 1). [50세 미만, 50세 이상·장애인]
const DAYS: Record<InsuredPeriod, [number, number]> = {
  lt1: [120, 120],
  "1to3": [150, 180],
  "3to5": [180, 210],
  "5to10": [210, 240],
  "10plus": [240, 270],
};

export type UnemploymentInput = {
  wages3m: number; // 이직 전 3개월 임금 총액(세전)
  days3m: number; // 그 3개월의 달력상 일수
  dailyHours: number; // 하루 소정근로시간
  period: InsuredPeriod;
  over50OrDisabled: boolean;
};

export function calcUnemployment(i: UnemploymentInput) {
  const avgDaily = i.days3m > 0 ? i.wages3m / i.days3m : 0;
  const raw = avgDaily * 0.6;
  const lower = RATES.minimumWage * 0.8 * Math.min(Math.max(i.dailyHours, 1), 8);
  // 하한액이 상한액보다 크면 하한액을 상한액으로 봅니다.
  const upper = Math.max(RATES.unemployment.dailyMax, lower);
  const daily = Math.floor(Math.min(Math.max(raw, lower), upper));
  const days = DAYS[i.period][i.over50OrDisabled ? 1 : 0];
  return { avgDaily, raw, lower, upper, daily, days, total: daily * days, monthly: daily * 30 };
}
