import { describe, expect, it } from "vitest";
import { DAY_MASTER } from "../../data/sajuReading";
import { calcLuck, calcSaju, lunarToSolar, seoulClockToUtc, seoulOffsetMinutes, tenGod, type SajuInput, type SajuResult } from "./saju";

const base: SajuInput = { calendar: "solar", year: 2000, month: 1, day: 1, time: { hour: 12, minute: 0 }, longitude: null, dayChange: "23" };
const ok = (input: Partial<SajuInput>) => {
  const r = calcSaju({ ...base, ...input });
  if ("error" in r) throw new Error(r.error);
  return r as SajuResult;
};
const gz = (r: SajuResult) => r.pillars.map((p) => p.stem + p.branch);

describe("한국 시간대", () => {
  it("서머타임과 UTC+8:30 시절의 오프셋", () => {
    expect(seoulOffsetMinutes(Date.UTC(2000, 0, 1))).toBe(540);
    expect(seoulOffsetMinutes(Date.UTC(1988, 6, 1))).toBe(600);
    expect(seoulOffsetMinutes(Date.UTC(1960, 0, 1))).toBe(510);
    expect(seoulOffsetMinutes(Date.UTC(1958, 6, 1))).toBe(570);
  });
  it("한국 시계 시각을 UTC로 바꾼다", () => {
    expect(seoulClockToUtc(2000, 1, 1, 9, 0)).toBe(Date.UTC(2000, 0, 1, 0, 0));
    expect(seoulClockToUtc(1988, 7, 1, 12, 0)).toBe(Date.UTC(1988, 6, 1, 2, 0));
  });
});

describe("사주 팔자", () => {
  it("2000-01-01은 기묘년 병자월 무오일", () => {
    expect(gz(ok({}))).toEqual(["己卯", "丙子", "戊午", "戊午"]);
    expect(ok({}).pillars.map((p) => p.stemKo + p.branchKo)).toEqual(["기묘", "병자", "무오", "무오"]);
  });
  it("입춘 시각(2024-02-04 17:27 KST)을 기준으로 연주·월주가 바뀐다", () => {
    expect(gz(ok({ year: 2024, month: 2, day: 4, time: { hour: 17, minute: 26 } })).slice(0, 2)).toEqual(["癸卯", "乙丑"]);
    expect(gz(ok({ year: 2024, month: 2, day: 4, time: { hour: 17, minute: 28 } })).slice(0, 2)).toEqual(["甲辰", "丙寅"]);
  });
  it("자시 기준에 따라 23시대의 일주가 달라진다", () => {
    const t = { year: 1990, month: 5, day: 15, time: { hour: 23, minute: 30 } };
    expect(ok({ ...t, dayChange: "23" }).pillars[2].stem + ok({ ...t, dayChange: "23" }).pillars[2].branch).toBe("辛巳");
    expect(ok({ ...t, dayChange: "00" }).pillars[2].stem + ok({ ...t, dayChange: "00" }).pillars[2].branch).toBe("庚辰");
    expect(ok({ ...t, dayChange: "00" }).pillars[3].branch).toBe("子");
  });
  it("서머타임과 경도 보정을 반영한다", () => {
    const r = ok({ year: 1988, month: 7, day: 1, time: { hour: 12, minute: 0 } });
    expect(r.usedTime).toMatchObject({ hour: 11, minute: 0 });
    expect(r.adjustments[0]).toContain("서머타임");
    const s = ok({ year: 1988, month: 7, day: 1, time: { hour: 12, minute: 0 }, longitude: 126.98 });
    expect(s.usedTime).toMatchObject({ hour: 10, minute: 28 });
    // 경도 보정으로 시(時)의 경계를 넘는 경우: 13:20 KST → 12:48 지방시(오시)
    expect(ok({ time: { hour: 13, minute: 20 } }).pillars[3].branch).toBe("未");
    expect(ok({ time: { hour: 13, minute: 20 }, longitude: 126.98 }).pillars[3].branch).toBe("午");
  });
  it("UTC+8:30 시절의 시각은 30분을 더해 한국 표준시로 맞춘다", () => {
    expect(ok({ year: 1960, month: 1, day: 1, time: { hour: 12, minute: 0 } }).usedTime).toMatchObject({ hour: 12, minute: 30 });
  });
  it("오행은 기둥마다 두 글자씩 센다", () => {
    const r = ok({});
    expect(Object.values(r.elementCount).reduce((a, b) => a + b)).toBe(8);
    expect(r.elementCount).toEqual({ 목: 1, 화: 3, 토: 3, 금: 0, 수: 1 });
    expect(r.dayMaster).toEqual({ stem: "戊", stemKo: "무", element: "토", yang: true });
    expect(r.animal).toBe("토끼");
  });
  it("시간을 모르면 시주를 빼고, 절입일이면 알려 준다", () => {
    const r = ok({ year: 2024, month: 2, day: 4, time: null });
    expect(r.pillars).toHaveLength(3);
    expect(r.warnings[0]).toContain("연주");
    expect(Object.values(r.elementCount).reduce((a, b) => a + b)).toBe(6);
    expect(ok({ year: 2024, month: 2, day: 10, time: null }).warnings).toHaveLength(0);
  });
});

describe("음력", () => {
  it("윤달을 포함해 양력으로 바꾼다", () => {
    expect(lunarToSolar(2023, 2, 1, true)).toEqual({ year: 2023, month: 3, day: 22 });
    expect(lunarToSolar(2024, 1, 1, false)).toEqual({ year: 2024, month: 2, day: 10 });
    expect(ok({ calendar: "lunar", year: 2024, month: 1, day: 1 }).solar).toEqual({ year: 2024, month: 2, day: 10 });
  });
  it("없는 날짜는 오류", () => {
    expect(calcSaju({ ...base, calendar: "lunar", year: 2024, month: 2, day: 1, leapMonth: true })).toHaveProperty("error");
    expect(calcSaju({ ...base, calendar: "lunar", year: 2024, month: 1, day: 30 })).toHaveProperty("error");
    expect(calcSaju({ ...base, month: 2, day: 30 })).toHaveProperty("error");
    expect(calcSaju({ ...base, year: 1899 })).toHaveProperty("error");
  });
});

describe("십신", () => {
  it("일간과의 오행·음양 관계로 정한다", () => {
    // 일간 甲(0) 기준
    expect(tenGod(0, 0).god).toBe("비견");
    expect(tenGod(0, 1).god).toBe("겁재");
    expect(tenGod(0, 2).god).toBe("식신");
    expect(tenGod(0, 3).god).toBe("상관");
    expect(tenGod(0, 4).god).toBe("편재");
    expect(tenGod(0, 5).god).toBe("정재");
    expect(tenGod(0, 6).god).toBe("편관");
    expect(tenGod(0, 7).god).toBe("정관");
    expect(tenGod(0, 8).god).toBe("편인");
    expect(tenGod(0, 9).god).toBe("정인");
    // 일간 癸(9) 기준: 戊는 정관, 甲은 상관
    expect(tenGod(9, 4).god).toBe("정관");
    expect(tenGod(9, 0).god).toBe("상관");
  });
  it("지지는 본기로 십신을 정하고 그룹별로 센다", () => {
    // 2000-01-01 12시: 己卯 丙子 戊午 戊午, 일간 戊
    const r = ok({});
    expect(r.pillars.map((p) => [p.stemTenGod, p.branchTenGod])).toEqual([
      ["겁재", "정관"],
      ["편인", "정재"],
      [null, "정인"],
      ["비견", "정인"],
    ]);
    expect(r.tenGodCount).toEqual({ 비겁: 2, 식상: 0, 재성: 1, 관성: 1, 인성: 3 });
    expect(Object.values(ok({ time: null }).tenGodCount).reduce((a, b) => a + b)).toBe(5);
  });
});

describe("풀이 문구", () => {
  it("일간 10가지 문구가 모두 있다", () => {
    expect(Object.keys(DAY_MASTER).join("")).toBe("甲乙丙丁戊己庚辛壬癸");
  });
});

describe("대운·세운", () => {
  // 1990-05-15 11:00 KST(중국 표준시 10:00), 庚午년 辛巳월. 다음 절입 망종 06-06 06:46, 지난 절입 입하 05-06 02:35(중국 표준시)
  const r = ok({ year: 1990, month: 5, day: 15, time: { hour: 11, minute: 0 } });
  const today = { year: 2026, month: 10, day: 14 };

  it("양년생 남자는 순행, 다음 절입까지 21.87일 ÷ 3 = 7년 3개월", () => {
    const l = calcLuck(r, "male", today);
    expect(l.forward).toBe(true);
    expect(l.start).toEqual({ years: 7, months: 3 });
    expect(l.daeun.slice(0, 3).map((d) => d.stem + d.branch)).toEqual(["壬午", "癸未", "甲申"]);
    expect(l.daeun.map((d) => d.age).slice(0, 3)).toEqual([7, 17, 27]);
    expect(l.daeun[0]).toMatchObject({ year: 1997, month: 8 });
    expect(l.daeun.filter((d) => d.current).map((d) => d.stem + d.branch)).toEqual(["甲申"]);
    expect(l.daeun).toHaveLength(10);
  });
  it("양년생 여자는 역행, 지난 절입까지 9.31일 ÷ 3 = 3년 1개월", () => {
    const l = calcLuck(r, "female", today);
    expect(l.forward).toBe(false);
    expect(l.start).toEqual({ years: 3, months: 1 });
    expect(l.daeun.slice(0, 2).map((d) => d.stem + d.branch)).toEqual(["庚辰", "己卯"]);
  });
  it("세운은 그해 간지와 일간 기준 십신", () => {
    const l = calcLuck(r, "male", today);
    expect(l.seun.map((s) => s.year)).toEqual([2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]);
    const y2026 = l.seun.find((s) => s.current)!;
    expect(y2026.stem + y2026.branch).toBe("丙午");
    expect(y2026.age).toBe(36);
    expect(l.seun[0].stem + l.seun[0].branch).toBe("甲辰");
  });
});
