// 졸업학점 진행도. 영역별 기준을 채워야 하고, 전체 졸업 학점도 따로 채워야 합니다.
export type Area = { name: string; required: number; earned: number };

export function calcGraduation(totalRequired: number, areas: Area[], extraEarned: number, semestersLeft: number) {
  const areaRows = areas.map((a) => ({ ...a, short: Math.max(0, a.required - a.earned) }));
  const areaShort = areaRows.reduce((s, a) => s + a.short, 0);
  const earnedTotal = areas.reduce((s, a) => s + Math.max(0, a.earned), 0) + Math.max(0, extraEarned);
  const totalShort = Math.max(0, totalRequired - earnedTotal);
  // 영역 기준을 모두 채우고 전체 학점도 채워야 하므로 둘 중 큰 쪽이 남은 학점입니다.
  const remaining = Math.max(totalShort, areaShort);
  return {
    areas: areaRows,
    earnedTotal,
    remaining,
    progress: totalRequired > 0 ? Math.min(1, earnedTotal / totalRequired) : 0,
    perSemester: semestersLeft > 0 ? remaining / semestersLeft : NaN,
  };
}
