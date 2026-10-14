import { describe, expect, it } from "vitest";
import { draws } from "../data/lotto";
import { drawsSince, lottoTax, parseSimHash, savingsValue, simHash, simLite, simulate, type SimDraw } from "./lotto";

const all = draws.map(simLite);

describe("로또 시뮬레이터", () => {
  it("당첨금 세금: 200만 원 이하 비과세, 3억까지 22%, 초과분 33%", () => {
    expect(lottoTax(5000)).toBe(0);
    expect(lottoTax(2_000_000)).toBe(0);
    expect(lottoTax(2_001_000)).toBe(440_000);
    expect(lottoTax(300_001_000)).toBe(66_000_000);
    expect(lottoTax(1_000_001_000)).toBe(66_000_000 + 231_000_000);
  });
  it("실제 1등 번호로 그 회차만 돌리면 그 회차 1등 당첨금", () => {
    const d = draws[1244];
    const r = simulate(d.nums, [simLite(d)]);
    expect(r).toMatchObject({ weeks: 1, spent: 1000, won: d.prizes[0][0], best: { no: 1245, rank: 1 } });
    expect(r.counts[1]).toBe(1);
  });
  it("장 수를 늘리면 쓴 돈과 당첨금이 같은 배수로 늘어난다", () => {
    const mine = [3, 11, 17, 25, 34, 42];
    const one = simulate(mine, all, 1);
    const three = simulate(mine, all, 3);
    expect(three.spent).toBe(one.spent * 3);
    expect(three.won).toBe(one.won * 3);
    expect(one.weeks).toBe(draws.length);
  });
  it("5등은 고정 5천 원(87회 이후)", () => {
    const fake: SimDraw[] = [[1, "2026-01-03", [1, 2, 3, 4, 5, 6], 7, [1e9, 5e7, 1.5e6, 50000, 5000]]];
    expect(simulate([1, 2, 3, 40, 41, 42], fake).won).toBe(5000);
    expect(simulate([1, 2, 3, 4, 5, 7], fake).best).toMatchObject({ rank: 2, prize: 5e7 });
  });
  it("최근 N년 회차만 고른다", () => {
    const ten = drawsSince(all, 10);
    expect(ten.length).toBeGreaterThan(515);
    expect(ten.length).toBeLessThan(525);
    expect(drawsSince(all, 0)).toHaveLength(all.length);
  });
  it("적금 비교: 이자 0이면 넣은 돈 그대로, 이자가 있으면 더 많다", () => {
    expect(savingsValue(1000, 52, 0)).toBe(52000);
    expect(savingsValue(1000, 52, 0.03)).toBeGreaterThan(52000);
    expect(savingsValue(1000, 52, 0.03)).toBeLessThan(53600);
  });
  it("공유 링크 해시를 읽고 쓴다", () => {
    const h = simHash([42, 3, 11, 17, 25, 34].sort((a, b) => a - b), 20, 2);
    expect(h).toBe("#n=3,11,17,25,34,42&y=20&t=2");
    expect(parseSimHash(h)).toEqual({ nums: [3, 11, 17, 25, 34, 42], years: 20, tickets: 2 });
    expect(parseSimHash("#n=1,2,3&y=5")).toBeNull();
    expect(parseSimHash("#n=1,2,3,4,5,6&y=7&t=99")).toEqual({ nums: [1, 2, 3, 4, 5, 6], years: 10, tickets: 1 });
  });
});
