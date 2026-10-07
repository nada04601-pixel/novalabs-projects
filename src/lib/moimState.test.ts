import { describe, expect, it } from "vitest";
import { decodeLink, decodeState, encodeLink, encodeState, removeMember, sampleState } from "./moimState";

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

describe("압축 링크(#z=)", () => {
  it("압축 링크로 바꿨다가 그대로 되살린다", async () => {
    const s = { ...sampleState(), bank: "토스뱅크 1000-1234-5678 민수", sent: ["수진→민수"], round100: true };
    const hash = await encodeLink(s);
    expect(hash.startsWith("z=")).toBe(true);
    expect(await decodeLink("#" + hash)).toEqual(s);
  });

  it("예전 형식보다 짧다", async () => {
    const s = sampleState();
    expect((await encodeLink(s)).length).toBeLessThan(("d=" + encodeState(s)).length / 2);
  });

  it("예전 형식(#d=) 링크도 계속 읽는다", async () => {
    const s = sampleState();
    expect(await decodeLink("#d=" + encodeState(s))).toEqual(s);
  });

  it("깨진 압축 링크는 null을 돌려준다", async () => {
    expect(await decodeLink("#z=AAAA")).toBeNull();
    expect(await decodeLink("#z=!!!")).toBeNull();
  });

  it("압축을 풀면 지나치게 커지는 링크는 거부한다", async () => {
    const huge = JSON.stringify([1, "x".repeat(200_000)]);
    const stream = new Blob([huge]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(b64.length).toBeLessThan(2_000);
    expect(await decodeLink("#z=" + b64)).toBeNull();
  });

  it("참석·음주 비트마스크는 참여자 수 범위 밖을 버린다", async () => {
    const s = sampleState();
    const hash = await encodeLink({ ...s, members: s.members.slice(0, 2) });
    const back = (await decodeLink("#" + hash))!;
    expect(back.rounds[0].attendees).toEqual([0, 1]);
    expect(back.rounds[0].drinkers).toEqual([0]);
  });
});
