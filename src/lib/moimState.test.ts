import { describe, expect, it } from "vitest";
import { decodeState, encodeState, removeMember, sampleState } from "./moimState";

describe("moimState", () => {
  it("한글이 들어간 상태를 링크로 바꿨다가 그대로 되살린다", () => {
    const s = sampleState();
    expect(decodeState("#d=" + encodeState(s))).toEqual(s);
  });

  it("잘못된 링크는 null을 돌려준다", () => {
    expect(decodeState("#d=!!!")).toBeNull();
    expect(decodeState("#x=abc")).toBeNull();
    expect(decodeState("#d=bm90LWpzb24")).toBeNull();
  });

  it("범위를 벗어난 값은 잘라낸다", () => {
    const bad = { title: "t", members: ["a", "b"], rounds: [{ place: "p", amount: -5, alcohol: 99, payer: 9, attendees: [0, 5, 1], drinkers: [1, 3] }] };
    const enc = btoa(JSON.stringify(bad)).replace(/=+$/, "");
    const s = decodeState("#d=" + enc)!;
    expect(s.rounds[0]).toEqual({ place: "p", amount: 0, alcohol: 0, payer: -1, attendees: [0, 1], drinkers: [1] });
  });

  it("참여자를 지우면 차수 인덱스를 당긴다", () => {
    const s = removeMember(sampleState(), 1);
    expect(s.members).toEqual(["민수", "현우", "수진"]);
    expect(s.rounds[0]).toMatchObject({ payer: 0, attendees: [0, 1, 2], drinkers: [0, 1, 2] });
    expect(s.rounds[1]).toMatchObject({ payer: 1, attendees: [0, 1, 2] });
  });
});
