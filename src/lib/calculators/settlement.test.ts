import { describe, expect, it } from "vitest";
import { minimizeTransfers, settle } from "./settlement";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("settle", () => {
  it("1차만 있으면 참석자끼리 똑같이 나눈다", () => {
    const r = settle(4, [{ place: "고깃집", amount: 120_000, alcohol: 0, payer: 0, attendees: [0, 1, 2, 3], drinkers: [] }]);
    expect(r.share).toEqual([30_000, 30_000, 30_000, 30_000]);
    expect(r.balance).toEqual([90_000, -30_000, -30_000, -30_000]);
    expect(r.transfers).toEqual([
      { from: 1, to: 0, amount: 30_000 },
      { from: 2, to: 0, amount: 30_000 },
      { from: 3, to: 0, amount: 30_000 },
    ]);
  });

  it("2차는 참석한 사람만 나눈다", () => {
    const r = settle(3, [
      { place: "1차", amount: 90_000, alcohol: 0, payer: 0, attendees: [0, 1, 2], drinkers: [] },
      { place: "2차", amount: 40_000, alcohol: 0, payer: 1, attendees: [0, 1], drinkers: [] },
    ]);
    expect(r.share).toEqual([50_000, 50_000, 30_000]);
    expect(r.paid).toEqual([90_000, 40_000, 0]);
    expect(sum(r.balance)).toBe(0);
  });

  it("술값은 마신 사람끼리만 나눈다", () => {
    // 음식 60,000원은 3명, 술 30,000원은 2명
    const r = settle(3, [{ place: "1차", amount: 90_000, alcohol: 30_000, payer: 2, attendees: [0, 1, 2], drinkers: [0, 1] }]);
    expect(r.share).toEqual([35_000, 35_000, 20_000]);
  });

  it("마신 사람이 없으면 술값도 전원이 나눈다", () => {
    const r = settle(2, [{ place: "1차", amount: 50_000, alcohol: 10_000, payer: 0, attendees: [0, 1], drinkers: [] }]);
    expect(r.share).toEqual([25_000, 25_000]);
  });

  it("나누어떨어지지 않는 자투리는 결제자가 부담하고 합계가 맞는다", () => {
    const r = settle(3, [{ place: "1차", amount: 100_000, alcohol: 0, payer: 1, attendees: [0, 1, 2], drinkers: [] }]);
    expect(r.share).toEqual([33_333, 33_334, 33_333]);
    expect(sum(r.share)).toBe(100_000);
    expect(sum(r.balance)).toBe(0);
  });

  it("범위를 벗어난 인덱스와 빈 차수는 무시한다", () => {
    const r = settle(2, [
      { place: "x", amount: 10_000, alcohol: 0, payer: 5, attendees: [0, 1], drinkers: [] },
      { place: "y", amount: 10_000, alcohol: 0, payer: 0, attendees: [], drinkers: [] },
      { place: "z", amount: 10_000, alcohol: 0, payer: 0, attendees: [0, 1, 7, 1], drinkers: [] },
    ]);
    expect(r.share).toEqual([5_000, 5_000]);
    expect(r.total).toBe(10_000);
  });
});

describe("minimizeTransfers", () => {
  it("송금 후 모든 잔액이 0이 되고 횟수는 사람 수 − 1 이하다", () => {
    const balance = [50_000, -20_000, -10_000, -35_000, 15_000];
    const t = minimizeTransfers(balance);
    const after = [...balance];
    for (const x of t) {
      after[x.from] += x.amount;
      after[x.to] -= x.amount;
      expect(x.amount).toBeGreaterThan(0);
    }
    expect(after).toEqual([0, 0, 0, 0, 0]);
    expect(t.length).toBeLessThanOrEqual(balance.length - 1);
  });
});
