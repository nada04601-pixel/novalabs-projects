// 학점 평균(평점) 계산. 학교마다 등급 체계가 달라 4.5와 4.3 만점 두 가지를 지원합니다.
export type Scale = "4.5" | "4.3";

export const GRADES: Record<Scale, { grade: string; point: number }[]> = {
  "4.5": [
    { grade: "A+", point: 4.5 }, { grade: "A0", point: 4.0 },
    { grade: "B+", point: 3.5 }, { grade: "B0", point: 3.0 },
    { grade: "C+", point: 2.5 }, { grade: "C0", point: 2.0 },
    { grade: "D+", point: 1.5 }, { grade: "D0", point: 1.0 },
    { grade: "F", point: 0 },
  ],
  "4.3": [
    { grade: "A+", point: 4.3 }, { grade: "A0", point: 4.0 }, { grade: "A-", point: 3.7 },
    { grade: "B+", point: 3.3 }, { grade: "B0", point: 3.0 }, { grade: "B-", point: 2.7 },
    { grade: "C+", point: 2.3 }, { grade: "C0", point: 2.0 }, { grade: "C-", point: 1.7 },
    { grade: "D+", point: 1.3 }, { grade: "D0", point: 1.0 }, { grade: "D-", point: 0.7 },
    { grade: "F", point: 0 },
  ],
};

export const PASS_GRADES = ["P", "NP"]; // 평점에 넣지 않는 등급

export type Course = { name: string; credits: number; grade: string; major: boolean };

export function calcGpa(courses: Course[], scale: Scale) {
  const table = new Map(GRADES[scale].map((g) => [g.grade, g.point]));
  let points = 0, graded = 0, majorPoints = 0, majorGraded = 0, earned = 0;
  for (const c of courses) {
    const credits = Math.max(0, c.credits);
    if (!credits) continue;
    if (c.grade === "P") earned += credits;
    if (PASS_GRADES.includes(c.grade)) continue;
    const point = table.get(c.grade);
    if (point === undefined) continue;
    graded += credits;
    points += point * credits;
    if (point > 0) earned += credits; // F는 취득 학점에서 제외
    if (c.major) {
      majorGraded += credits;
      majorPoints += point * credits;
    }
  }
  return {
    gpa: graded ? points / graded : 0,
    majorGpa: majorGraded ? majorPoints / majorGraded : 0,
    gradedCredits: graded,
    earnedCredits: earned,
    max: Number(scale),
  };
}

// 지금까지의 평점과 이수 학점으로, 남은 학점에서 받아야 할 평균 평점
export function requiredGpa(currentGpa: number, doneCredits: number, targetGpa: number, remainingCredits: number) {
  if (remainingCredits <= 0) return NaN;
  return (targetGpa * (doneCredits + remainingCredits) - currentGpa * doneCredits) / remainingCredits;
}

// 소수점 둘째 자리에서 버림(성적표 표기 방식). 학교에 따라 반올림하기도 합니다.
export const floor2 = (v: number) => Math.floor(v * 100 + 1e-9) / 100;
