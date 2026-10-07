import { describe, expect, it } from "vitest";
import { calcGpa, floor2, requiredGpa } from "./gpa";
import { calcTargetScore } from "./targetScore";
import { calcGraduation } from "./graduation";
import { calcAttendance } from "./attendance";
import { analyzeTimetable, toMinutes } from "./freePeriod";

describe("학점 평균", () => {
  it("학점 가중 평균과 전공 평점, P/F 처리", () => {
    const r = calcGpa(
      [
        { name: "전공1", credits: 3, grade: "A+", major: true },
        { name: "전공2", credits: 3, grade: "B0", major: true },
        { name: "교양", credits: 2, grade: "A0", major: false },
        { name: "채플", credits: 1, grade: "P", major: false },
        { name: "실패", credits: 3, grade: "F", major: false },
      ],
      "4.5"
    );
    // (4.5*3 + 3.0*3 + 4.0*2 + 0*3) / 11 = 30.5 / 11
    expect(r.gpa).toBeCloseTo(30.5 / 11);
    expect(r.majorGpa).toBeCloseTo(3.75);
    expect(r.gradedCredits).toBe(11);
    expect(r.earnedCredits).toBe(9); // 3+3+2+1(P), F 제외
  });
  it("4.3 만점 등급표를 쓴다", () => {
    expect(calcGpa([{ name: "a", credits: 3, grade: "A-", major: false }], "4.3").gpa).toBeCloseTo(3.7);
  });
  it("목표 평점에 필요한 남은 학점 평균", () => {
    // 60학점 3.5 → 130학점에서 4.0 목표: (4.0*130 - 3.5*60)/70 = 4.4286
    expect(requiredGpa(3.5, 60, 4.0, 70)).toBeCloseTo(310 / 70);
    expect(floor2(3.4567)).toBe(3.45);
  });
});

describe("목표 성적", () => {
  it("남은 평가에서 받아야 할 점수", () => {
    const r = calcTargetScore(
      [
        { name: "중간", weight: 30, score: 70 },
        { name: "과제", weight: 20, score: 90 },
        { name: "기말", weight: 40, score: null },
        { name: "출석", weight: 10, score: 100 },
      ],
      80
    );
    // 확보 21 + 18 + 10 = 49, 남은 40%에서 31점 → 77.5점
    expect(r.earned).toBeCloseTo(49);
    expect(r.required).toBeCloseTo(77.5);
    expect(r.maxPossible).toBeCloseTo(89);
  });
});

describe("졸업학점", () => {
  it("영역 부족분과 전체 부족분 중 큰 쪽", () => {
    const r = calcGraduation(
      130,
      [
        { name: "전공", required: 60, earned: 45 },
        { name: "교양", required: 30, earned: 33 },
      ],
      10,
      3
    );
    expect(r.earnedTotal).toBe(88);
    expect(r.remaining).toBe(42); // 전체 부족 42 > 전공 부족 15
    expect(r.perSemester).toBe(14);
  });
});

describe("출석 기준", () => {
  it("1/4 이상 결석이면 F, 지각 3회 = 결석 1회", () => {
    const r = calcAttendance({ classesPerWeek: 2, weeks: 15, failRatio: 0.25, absences: 3, lates: 4, latesPerAbsence: 3, maxScore: 10, deductPerAbsence: 1 });
    expect(r.total).toBe(30);
    expect(r.failAt).toBe(8); // 7.5 → 8회부터 F
    expect(r.counted).toBe(4);
    expect(r.allowedMore).toBe(3);
    expect(r.failed).toBe(false);
    expect(r.score).toBe(6);
  });
});

describe("공강 시간", () => {
  it("요일별 공강과 머무는 시간, 겹치는 수업 처리", () => {
    const r = analyzeTimetable(
      [
        { name: "A", day: "월", start: toMinutes("09:00"), end: toMinutes("10:15") },
        { name: "B", day: "월", start: toMinutes("13:00"), end: toMinutes("14:15") },
        { name: "C", day: "화", start: toMinutes("10:30"), end: toMinutes("12:00") },
        { name: "D", day: "화", start: toMinutes("11:30"), end: toMinutes("13:00") },
      ],
      60
    );
    const mon = r.days[0];
    expect(mon.stay).toBe(315);
    expect(mon.gaps).toEqual([{ start: 615, end: 780, minutes: 165 }]);
    expect(r.days[1].overlap).toBe(true);
    expect(r.days[1].classMinutes).toBe(150);
    expect(r.freeDays).toEqual(["수", "목", "금"]);
  });
});
