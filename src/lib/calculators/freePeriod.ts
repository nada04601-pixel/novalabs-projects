// 시간표에서 요일별 공강(수업 사이 빈 시간)과 학교에 머무는 시간을 구합니다. 시간은 분 단위로 다룹니다.
export const DAYS = ["월", "화", "수", "목", "금"] as const;
export type Day = (typeof DAYS)[number];
export type ClassSlot = { name: string; day: Day; start: number; end: number };

export const toMinutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return NaN;
  const h = +m[1], min = +m[2];
  return h < 24 && min < 60 ? h * 60 + min : NaN;
};
export const fmt = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export function analyzeTimetable(slots: ClassSlot[], minGap: number) {
  const days = DAYS.map((day) => {
    const list = slots
      .filter((s) => s.day === day && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
      .sort((a, b) => a.start - b.start);
    // 겹치는 수업은 하나로 합쳐 빈 시간을 계산합니다.
    const merged: { start: number; end: number }[] = [];
    for (const s of list) {
      const last = merged[merged.length - 1];
      if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
      else merged.push({ start: s.start, end: s.end });
    }
    const gaps = merged.slice(1).map((m, k) => ({ start: merged[k].end, end: m.start, minutes: m.start - merged[k].end }));
    const classMinutes = merged.reduce((a, m) => a + (m.end - m.start), 0);
    return {
      day,
      classes: list,
      first: merged[0]?.start ?? null,
      last: merged[merged.length - 1]?.end ?? null,
      stay: merged.length ? merged[merged.length - 1].end - merged[0].start : 0,
      classMinutes,
      gaps: gaps.filter((g) => g.minutes >= minGap),
      overlap: list.length > 1 && merged.length < list.length,
    };
  });
  return {
    days,
    freeDays: days.filter((d) => d.classes.length === 0).map((d) => d.day),
    weeklyClassMinutes: days.reduce((a, d) => a + d.classMinutes, 0),
    weeklyGapMinutes: days.reduce((a, d) => a + d.gaps.reduce((x, g) => x + g.minutes, 0), 0),
  };
}
