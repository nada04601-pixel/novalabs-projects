import { describe, expect, it } from "vitest";
import { backwardPlan, distribute, planAgenda, pomodoro, scheduleTasks, weeklyPlan } from "./planner";
import { parseDate } from "./date";

describe("distribute", () => {
  it("합계를 정확히 맞추고 가중치 0은 0", () => {
    expect(distribute(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(distribute(7, [2, 0, 1])).toEqual([5, 0, 2]);
    expect(distribute(0, [1, 2])).toEqual([0, 0]);
  });
});

describe("회의 시간 배분", () => {
  it("여유 시간과 고정 안건을 뺀 나머지를 중요도대로 5분 단위 배분", () => {
    const r = planAgenda(600, 60, 5, [
      { title: "인사", weight: 0, fixed: 5 },
      { title: "핵심 안건", weight: 3, fixed: null },
      { title: "보조 안건", weight: 1, fixed: null },
      { title: "정리", weight: 0, fixed: 5 },
    ]);
    // 유동 45분 → 9단위를 3:1 → 7:2 → 35분·10분
    expect(r.rows.map((x) => x.minutes)).toEqual([5, 35, 10, 5]);
    expect(r.rows[1].start).toBe(605);
    expect(r.buffer).toBe(5);
    expect(r.overflow).toBe(false);
  });
});

describe("할 일 배치", () => {
  it("우선순위대로 넣고 넘치는 일은 남긴다", () => {
    const r = scheduleTasks(540, 720, 10, [
      { title: "보고서", minutes: 90, priority: 1 },
      { title: "메일", minutes: 30, priority: 2 },
      { title: "기획", minutes: 60, priority: 1 },
    ]);
    expect(r.placed.map((x) => [x.title, x.start, x.end])).toEqual([["보고서", 540, 630], ["기획", 640, 700]]);
    expect(r.left.map((x) => x.title)).toEqual(["메일"]);
    expect(r.need).toBe(200);
  });
});

describe("뽀모도로", () => {
  it("4번째마다 긴 휴식, 마지막엔 휴식 없음", () => {
    const r = pomodoro(540, 5, 25, 5, 15, 4);
    expect(r.blocks.filter((b) => b.kind === "long").length).toBe(1);
    // 25*5 + 5*3 + 15 = 155
    expect(r.total).toBe(155);
    expect(r.end).toBe(695);
  });
});

describe("마감 역산", () => {
  it("주말을 건너뛰며 거꾸로 배정", () => {
    // 2026-11-20(금) 마감: 검토 1일, 작성 3일, 조사 2일
    const r = backwardPlan(parseDate("2026-11-20")!, [
      { title: "조사", days: 2 },
      { title: "작성", days: 3 },
      { title: "검토", days: 1 },
    ], true);
    expect(r.rows).toEqual([
      { title: "조사", days: 2, start: "2026-11-13", end: "2026-11-16" },
      { title: "작성", days: 3, start: "2026-11-17", end: "2026-11-19" },
      { title: "검토", days: 1, start: "2026-11-20", end: "2026-11-20" },
    ]);
  });
  it("주말 포함이면 달력 날짜 그대로", () => {
    const r = backwardPlan(parseDate("2026-11-22")!, [{ title: "a", days: 2 }, { title: "b", days: 1 }], false);
    expect(r.rows[0]).toMatchObject({ start: "2026-11-20", end: "2026-11-21" });
  });
});

describe("주간 목표", () => {
  it("여유 가중치대로 나누고 누적 합계가 목표와 같다", () => {
    const r = weeklyPlan(300, [2, 2, 2, 2, 1, 0, 3]);
    expect(r.map((x) => x.amount)).toEqual([50, 50, 50, 50, 25, 0, 75]);
    expect(r[6].cumulative).toBe(300);
    expect(weeklyPlan(10, [1, 1, 1, 0, 0, 0, 0], 1).map((x) => x.amount).slice(0, 3)).toEqual([3.4, 3.3, 3.3]);
  });
});
