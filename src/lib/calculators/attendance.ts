// 출석 기준. 많은 학교가 '수업 시간의 1/4 이상 결석하면 F'처럼 정해 두지만 비율은 학교·과목마다 다릅니다.
export type AttendanceInput = {
  classesPerWeek: number;
  weeks: number;
  failRatio: number; // 이 비율 '이상' 결석하면 F (예: 0.25)
  absences: number;
  lates: number;
  latesPerAbsence: number; // 지각 몇 번이 결석 1회인지(0이면 환산 안 함)
  maxScore: number; // 출석 점수 만점
  deductPerAbsence: number; // 결석 1회당 감점
};

export function calcAttendance(i: AttendanceInput) {
  const total = Math.max(0, Math.round(i.classesPerWeek * i.weeks));
  const failAt = Math.ceil(total * i.failRatio - 1e-9); // 이 횟수부터 F
  const fromLates = i.latesPerAbsence > 0 ? Math.floor(i.lates / i.latesPerAbsence) : 0;
  const counted = i.absences + fromLates;
  const allowedMore = Math.max(0, failAt - 1 - counted); // F가 되기 전까지 더 빠질 수 있는 횟수
  return {
    total,
    failAt,
    fromLates,
    counted,
    allowedMore,
    failed: total > 0 && counted >= failAt,
    score: Math.max(0, i.maxScore - counted * i.deductPerAbsence),
    rate: total > 0 ? Math.max(0, (total - counted) / total) : 0,
  };
}
