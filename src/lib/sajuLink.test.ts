import { describe, expect, it } from "vitest";
import { decodeSajuLink, encodeSajuLink, type SajuLinkState } from "./sajuLink";

const base: SajuLinkState = {
  calendar: "solar",
  year: 1995,
  month: 5,
  day: 15,
  leap: false,
  time: "09:30",
  city: "서울",
  dayChange: "23",
  gender: "female",
};

describe("사주 공유 링크", () => {
  it("짧은 해시로 담는다", () => {
    expect(encodeSajuLink(base)).toBe("y=1995&m=5&d=15&t=0930&c=%EC%84%9C%EC%9A%B8&g=f");
  });
  it("담은 값을 그대로 되살린다", () => {
    const cases: SajuLinkState[] = [
      base,
      { ...base, calendar: "lunar", leap: true, time: null, city: "", dayChange: "00", gender: "male" },
      { ...base, time: "00:00", city: "제주" },
    ];
    for (const s of cases) expect(decodeSajuLink("#" + encodeSajuLink(s))).toEqual(s);
  });
  it("양력에서는 윤달 표시를 무시한다", () => {
    expect(encodeSajuLink({ ...base, leap: true })).not.toContain("leap");
    expect(decodeSajuLink("#y=1995&m=5&d=15&leap=1")!.leap).toBe(false);
  });
  it("날짜가 없거나 범위를 벗어나면 null", () => {
    expect(decodeSajuLink("")).toBeNull();
    expect(decodeSajuLink("#z=abc")).toBeNull();
    expect(decodeSajuLink("#y=1800&m=1&d=1")).toBeNull();
    expect(decodeSajuLink("#y=2000&m=13&d=1")).toBeNull();
    expect(decodeSajuLink("#y=2000&m=1&d=1.5")).toBeNull();
  });
  it("잘못된 시각·도시는 안전한 값으로", () => {
    const s = decodeSajuLink("#y=2000&m=1&d=1&t=2460&c=평양")!;
    expect(s.time).toBeNull();
    expect(s.city).toBe("서울");
    expect(s.gender).toBe("female");
  });
});
