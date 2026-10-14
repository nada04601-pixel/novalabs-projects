import { describe, expect, it } from "vitest";
import { DAY_MASTER } from "../../data/sajuReading";
import { calcLuck, calcSaju, findRelations, findShinsal, natalSlots, lunarToSolar, seoulClockToUtc, seoulOffsetMinutes, tenGod, type SajuInput, type SajuResult } from "./saju";

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

describe("합·충", () => {
  const slot = (name: string, gz: string) => ({ name, stem: gz[0], branch: gz[1] });
  it("천간합·천간충·육합·지지충", () => {
    const rel = findRelations([slot("연", "甲子"), slot("월", "己丑"), slot("일", "庚午")]);
    expect(rel).toContainEqual({ kind: "천간합", chars: "甲己", places: ["연간", "월간"], element: "토" });
    expect(rel).toContainEqual({ kind: "천간충", chars: "甲庚", places: ["연간", "일간"] });
    expect(rel).toContainEqual({ kind: "육합", chars: "子丑", places: ["연지", "월지"], element: "토" });
    expect(rel).toContainEqual({ kind: "지지충", chars: "子午", places: ["연지", "일지"] });
    expect(rel).toContainEqual({ kind: "해", chars: "丑午", places: ["월지", "일지"] });
    expect(rel).toHaveLength(5);
  });
  it("삼합·반합·방합", () => {
    expect(findRelations([slot("연", "甲申"), slot("월", "丙子"), slot("일", "戊辰")])).toContainEqual({ kind: "삼합", chars: "申子辰", places: ["연지", "월지", "일지"], element: "수" });
    expect(findRelations([slot("연", "甲子"), slot("월", "丙辰")])).toEqual([{ kind: "반합", chars: "子辰", places: ["연지", "월지"], element: "수" }]);
    // 왕지(子)가 없는 申辰은 반합으로 보지 않음
    expect(findRelations([slot("연", "甲申"), slot("월", "丙辰")])).toEqual([]);
    expect(findRelations([slot("연", "甲寅"), slot("월", "丁卯"), slot("일", "戊辰")])).toContainEqual({ kind: "방합", chars: "寅卯辰", places: ["연지", "월지", "일지"], element: "목" });
  });
  it("원국의 충과, 운이 끼어 있는 관계만 고르기", () => {
    // 2000-01-01 12시: 己卯 丙子 戊午 戊午 → 월지 子와 일지·시지 午가 충
    const natal = natalSlots(ok({}));
    // 卯子午午: 子卯 형, 卯午 파 둘, 子午 충 둘, 午午 자형
    expect(findRelations(natal)).toEqual([
      { kind: "형", chars: "卯子", places: ["연지", "월지"], name: "무례지형" },
      { kind: "파", chars: "卯午", places: ["연지", "일지"] },
      { kind: "파", chars: "卯午", places: ["연지", "시지"] },
      { kind: "지지충", chars: "子午", places: ["월지", "일지"] },
      { kind: "지지충", chars: "子午", places: ["월지", "시지"] },
      { kind: "자형", chars: "午午", places: ["일지", "시지"] },
    ]);
    // 甲申 세운: 연간 己와 천간합, 월지 子(왕지)와 반합. 원국끼리의 충은 빠짐
    const withYear = findRelations([...natal, slot("세운", "甲申")], "세운");
    expect(withYear).toContainEqual({ kind: "천간합", chars: "己甲", places: ["연간", "세운 천간"], element: "토" });
    expect(withYear).toContainEqual({ kind: "반합", chars: "申子", places: ["월지", "세운 지지"], element: "수" });
    expect(withYear.some((r) => r.kind === "지지충")).toBe(false);
  });
});

describe("형·파·해", () => {
  const slot = (name: string, gz: string) => ({ name, stem: gz[0], branch: gz[1] });
  const kinds = (gzs: string[]) => findRelations(gzs.map((g, i) => slot("연월일시"[i], g))).map((r) => `${r.chars}${r.kind}${r.name ?? ""}`);
  it("삼형이 다 모이면 두 글자 형 대신 삼형 하나", () => {
    const k = kinds(["甲寅", "乙巳", "庚申"]);
    expect(k).toContain("寅巳申삼형무은지형");
    expect(k.filter((x) => x.includes("형") && !x.includes("삼형"))).toEqual([]);
    expect(k).toContain("寅申지지충");
    expect(kinds(["丁丑", "戊戌", "己未"])).toContain("丑戌未삼형지세지형");
  });
  it("두 글자 형과 상형·자형", () => {
    expect(kinds(["甲寅", "乙巳"])).toEqual(["寅巳형무은지형", "寅巳해"]);
    expect(kinds(["甲子", "乙卯"])).toEqual(["子卯형무례지형"]);
    expect(kinds(["甲辰", "丙辰"])).toEqual(["辰辰자형"]);
    expect(kinds(["甲子", "丙子"])).toEqual([]);
  });
  it("파와 해", () => {
    expect(kinds(["甲子", "乙酉"])).toEqual(["子酉파"]);
    expect(kinds(["甲子", "乙未"])).toEqual(["子未해"]);
    expect(kinds(["甲申", "乙亥"])).toEqual(["申亥해"]);
    expect(kinds(["乙未", "甲戌"])).toEqual(["未戌형지세지형", "未戌파"]);
  });
});

describe("신살", () => {
  const slot = (name: string, gz: string) => ({ name, stem: gz[0], branch: gz[1] });
  it("2000-01-01 12시(己卯 丙子 戊午 戊午)", () => {
    // 일간 戊: 양인 午. 연지 卯(亥卯未)의 도화 子, 일지 午(寅午戌)의 도화 卯. 일주 戊午는 甲寅순이라 子丑 공망
    expect(findShinsal(natalSlots(ok({})))).toEqual([
      { name: "도화살", places: ["월지", "연지"] },
      { name: "공망", places: ["월지"] },
      { name: "양인살", places: ["일지", "시지"] },
    ]);
  });
  it("일간 기준 귀인·홍염과 기둥 기준 백호·괴강, 원진", () => {
    const r = findShinsal([slot("연", "甲辰"), slot("월", "丙寅"), slot("일", "庚戌"), slot("시", "乙酉")]);
    const names = r.map((x) => x.name);
    // 일간 庚: 천을귀인 丑未(없음), 문창 亥(없음), 홍염 戌(일지)
    expect(names).not.toContain("천을귀인");
    expect(r).toContainEqual({ name: "홍염살", places: ["일지"] });
    expect(r).toContainEqual({ name: "백호살", places: ["연주"] });
    expect(r).toContainEqual({ name: "괴강살", places: ["일주"] });
    expect(r).toContainEqual({ name: "원진살", places: ["월지", "시지"] }); // 寅酉
    // 연지 辰(申子辰): 화개 辰은 기준 자리라 제외, 일지 戌(寅午戌): 도화 卯·역마 申·화개 戌 없음
    expect(names).not.toContain("화개살");
  });
  it("운에 걸린 신살만 고르기", () => {
    const natal = natalSlots(ok({}));
    // 2025 乙巳 세운: 일간 戊 기준 천을귀인 丑未 아님, 연지 卯의 역마 巳
    expect(findShinsal([...natal, slot("세운", "乙巳")], "세운")).toEqual([{ name: "역마살", places: ["세운 지지"] }]);
    // 丑 세운은 공망이자 원진(일지·시지 午와 丑午)
    const ox = findShinsal([...natal, slot("세운", "辛丑")], "세운");
    expect(ox.map((x) => x.name)).toEqual(["천을귀인", "공망", "원진살"]);
    expect(ox.find((x) => x.name === "원진살")!.places).toEqual(["일지", "세운 지지", "시지"]);
    // 원국끼리의 원진(寅酉)은 운 쪽 목록에 섞이지 않음
    const withPair = [slot("연", "甲寅"), slot("월", "乙酉"), slot("일", "戊午"), slot("세운", "辛丑")];
    expect(findShinsal(withPair, "세운").find((x) => x.name === "원진살")!.places).toEqual(["일지", "세운 지지"]);
  });
});

describe("지장간", () => {
  // 2000-01-01 12시: 己卯 丙子 戊午 戊午, 일간 戊
  const r = ok({});
  it("지지마다 여기·중기·정기와 십신", () => {
    expect(r.pillars.map((p) => p.hidden.map((h) => h.stem).join(""))).toEqual(["甲乙", "壬癸", "丙己丁", "丙己丁"]);
    expect(r.pillars[2].hidden.map((h) => h.tenGod)).toEqual(["편인", "겁재", "정인"]);
    expect(r.pillars.every((p) => p.hidden.reduce((a, h) => a + h.days, 0) === 30)).toBe(true);
  });
  it("지장간을 일수 비율로 반영한 오행 세력", () => {
    // 천간 토3·화1, 卯 목1, 子 수1, 午 두 개 → 화 21/30·토 9/30씩
    expect(r.elementPower).toEqual({ 목: 1, 화: 2.4, 토: 3.6, 금: 0, 수: 1 });
  });
  it("통근과 투출", () => {
    expect(r.roots).toEqual(["일지", "시지"]); // 戊토가 午 속 己토에 뿌리
    expect(r.revealed).toEqual([{ stem: "己", places: ["연간"] }, { stem: "丙", places: ["월간"] }]);
  });
  it("12지지 모두 일수 합계가 30일이고 마지막(정기)이 본기", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 12; d++) {
      for (const p of ok({ year: 2000, month: 3, day: d }).pillars) {
        expect(p.hidden.reduce((a, h) => a + h.days, 0)).toBe(30);
        expect(p.hidden.at(-1)!.tenGod).toBe(p.branchTenGod);
        seen.add(p.branch);
      }
    }
    expect(seen.size).toBe(12);
  });
});
