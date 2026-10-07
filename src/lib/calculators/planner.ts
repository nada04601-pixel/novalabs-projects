import { addDays as addCalendarDays } from "./dateDiff";
import { formatDate } from "./date";

// 업무·일정 도구가 함께 쓰는 계산. 시각은 0시부터의 분 단위로 다룹니다.

// 정수 total을 가중치 비율대로 나눕니다. 나머지는 소수점이 큰 쪽부터 1씩 더해 합계를 정확히 맞춥니다(최대 나머지 방식).
export function distribute(total: number, weights: number[]) {
  const sum = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (Math.max(0, w) / sum) * total);
  const base = raw.map(Math.floor);
  let rest = total - base.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const o of order) {
    if (rest <= 0) break;
    if (weights[o.i] > 0) {
      base[o.i] += 1;
      rest -= 1;
    }
  }
  return base;
}

// 회의 시간 배분: 전체 시간에서 여유 시간을 떼고, 고정 시간 안건을 먼저 배정한 뒤 나머지를 중요도 비율로 나눕니다.
export type AgendaItem = { title: string; weight: number; fixed: number | null };

export function planAgenda(start: number, totalMinutes: number, bufferMinutes: number, items: AgendaItem[], step = 5) {
  const usable = Math.max(0, totalMinutes - bufferMinutes);
  const fixedSum = items.reduce((a, it) => a + (it.fixed ?? 0), 0);
  const flexible = Math.max(0, usable - fixedSum);
  // 유동 시간은 step(기본 5분) 단위로 나눠 시각표가 깔끔하게 떨어지게 합니다.
  const units = Math.floor(flexible / step);
  const shares = distribute(units, items.map((it) => (it.fixed === null ? it.weight : 0)));
  let t = start;
  const rows = items.map((it, i) => {
    const minutes = it.fixed ?? shares[i] * step;
    const row = { title: it.title, minutes, start: t, end: t + minutes };
    t += minutes;
    return row;
  });
  return { rows, used: t - start, buffer: totalMinutes - (t - start), overflow: fixedSum > usable, end: start + totalMinutes };
}

// 할 일 배치: 우선순위(1이 가장 높음) 순으로 근무 시간 안에 차례로 넣고, 일 사이에 쉬는 시간을 둡니다.
export type Task = { title: string; minutes: number; priority: number };

export function scheduleTasks(start: number, end: number, gap: number, tasks: Task[]) {
  const order = tasks
    .map((t, i) => ({ ...t, i }))
    .filter((t) => t.minutes > 0)
    .sort((a, b) => a.priority - b.priority || a.i - b.i);
  let t = start;
  const placed: (Task & { start: number; end: number })[] = [];
  const left: Task[] = [];
  for (const task of order) {
    const s = placed.length ? t + gap : t;
    if (s + task.minutes <= end) {
      placed.push({ title: task.title, minutes: task.minutes, priority: task.priority, start: s, end: s + task.minutes });
      t = s + task.minutes;
    } else left.push({ title: task.title, minutes: task.minutes, priority: task.priority });
  }
  const need = order.reduce((a, x) => a + x.minutes, 0) + Math.max(0, order.length - 1) * gap;
  return { placed, left, available: Math.max(0, end - start), need, freeAfter: Math.max(0, end - t) };
}

// 뽀모도로: 집중 → 짧은 휴식, n번째마다 긴 휴식. 마지막 집중 뒤에는 휴식을 넣지 않습니다.
export type Block = { kind: "focus" | "short" | "long"; n: number; start: number; end: number };

export function pomodoro(start: number, rounds: number, focus: number, shortBreak: number, longBreak: number, longEvery: number) {
  const blocks: Block[] = [];
  let t = start;
  for (let n = 1; n <= rounds; n++) {
    blocks.push({ kind: "focus", n, start: t, end: t + focus });
    t += focus;
    if (n === rounds) break;
    const long = longEvery > 0 && n % longEvery === 0;
    const len = long ? longBreak : shortBreak;
    blocks.push({ kind: long ? "long" : "short", n, start: t, end: t + len });
    t += len;
  }
  return { blocks, end: t, focusMinutes: rounds * focus, total: t - start };
}

// 마감 역산: 마지막 단계부터 거꾸로 작업일을 배정합니다. skipWeekends면 토·일은 건너뜁니다.
export type Step = { title: string; days: number };

const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
const prevWorkday = (d: Date, skip: boolean) => {
  let x = d;
  while (skip && isWeekend(x)) x = addCalendarDays(x, -1, false);
  return x;
};

export function backwardPlan(deadline: Date, steps: Step[], skipWeekends: boolean) {
  // 마감일 당일까지 작업한다고 보고, 마감일이 주말이면 직전 평일로 당깁니다.
  let cursor = prevWorkday(deadline, skipWeekends);
  const rows: { title: string; days: number; start: string; end: string }[] = [];
  for (let k = steps.length - 1; k >= 0; k--) {
    const days = Math.max(1, Math.round(steps[k].days));
    const end = cursor;
    let startDay = end;
    for (let left = days - 1; left > 0; left--) startDay = prevWorkday(addCalendarDays(startDay, -1, false), skipWeekends);
    rows.unshift({ title: steps[k].title, days, start: formatDate(startDay), end: formatDate(end) });
    cursor = prevWorkday(addCalendarDays(startDay, -1, false), skipWeekends);
  }
  return { rows, startBy: rows[0]?.start ?? formatDate(deadline) };
}

// 주간 목표 분배: 요일별 여유(0=쉼, 1=가볍게, 2=보통, 3=많이)를 가중치로 목표량을 나눕니다.
export const WEEKDAYS_MON = ["월", "화", "수", "목", "금", "토", "일"] as const;

export function weeklyPlan(goal: number, loads: number[], decimals = 0) {
  const scale = 10 ** decimals;
  const parts = distribute(Math.round(goal * scale), loads).map((v) => v / scale);
  let acc = 0;
  return parts.map((v, i) => {
    acc += v;
    return { day: WEEKDAYS_MON[i], amount: v, cumulative: Math.round(acc * scale) / scale };
  });
}
