import { describe, expect, it } from "vitest";
import { draws, getStores } from "../data/lotto";
import stores from "../data/lotto/stores.json";
import {
  ballTone, checkHistory, storeRegions, frequency, generateGame, generateGames, lite, nextDrawDate, oddEven, parseNumbers, rankOf, sum, validateOptions,
} from "./lotto";

const seeded = (seed = 1) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);

describe("로또 번호 생성", () => {
  it("1~45 중 서로 다른 6개를 오름차순으로 만든다", () => {
    const r = seeded(5);
    for (let i = 0; i < 500; i++) {
      const g = generateGame({}, r);
      expect(g).toHaveLength(6);
      expect(new Set(g).size).toBe(6);
      expect(g.every((n) => n >= 1 && n <= 45)).toBe(true);
      expect([...g].sort((a, b) => a - b)).toEqual(g);
    }
  });
  it("고정수는 항상 넣고 제외수는 넣지 않는다", () => {
    const r = seeded(11);
    for (let i = 0; i < 300; i++) {
      const g = generateGame({ fixed: [7, 27], excluded: [1, 2, 3, 44, 45] }, r);
      expect(g).toEqual(expect.arrayContaining([7, 27]));
      expect(g.some((n) => [1, 2, 3, 44, 45].includes(n))).toBe(false);
    }
  });
  it("잘못된 조건을 알려 준다", () => {
    expect(validateOptions({ fixed: [1, 2, 3, 4, 5, 6] })).toMatch(/최대 5개/);
    expect(validateOptions({ fixed: [1], excluded: [1] })).toMatch(/함께/);
    expect(validateOptions({ excluded: Array.from({ length: 40 }, (_, i) => i + 1) })).toMatch(/너무 많/);
    expect(validateOptions({ excluded: Array.from({ length: 39 }, (_, i) => i + 1) })).toBeNull();
  });
  it("여러 게임은 서로 겹치지 않고, 가능한 조합이 적으면 그만큼만 만든다", () => {
    const games = generateGames(10, {}, seeded(3));
    expect(new Set(games.map((g) => g.join())).size).toBe(10);
    // 고정 5개 + 남은 번호 3개 → 가능한 조합 3개
    const few = generateGames(10, { fixed: [1, 2, 3, 4, 5], excluded: Array.from({ length: 37 }, (_, i) => i + 9) }, seeded(4));
    expect(few).toHaveLength(3);
  });
});

describe("당첨 확인", () => {
  const nums = [4, 5, 25, 28, 32, 42];
  it("등수를 판정한다", () => {
    expect(rankOf(nums, nums, 12)).toBe(1);
    expect(rankOf([4, 5, 25, 28, 32, 12], nums, 12)).toBe(2);
    expect(rankOf([4, 5, 25, 28, 32, 1], nums, 12)).toBe(3);
    expect(rankOf([4, 5, 25, 28, 1, 12], nums, 12)).toBe(4);
    expect(rankOf([4, 5, 25, 1, 2, 12], nums, 12)).toBe(5);
    expect(rankOf([4, 5, 1, 2, 3, 12], nums, 12)).toBe(0);
  });
  it("지난 회차 1등 번호는 그 회차 1등으로 나온다", () => {
    const d = draws[1243];
    const res = checkHistory(d.nums, draws.map(lite));
    expect(res.counts[1]).toBeGreaterThanOrEqual(1);
    expect(res.best[0]).toMatchObject({ no: d.no, rank: 1 });
  });
});

describe("보조 함수", () => {
  it("공 색 구간", () => {
    expect([1, 10, 11, 20, 21, 30, 31, 40, 41, 45].map(ballTone)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
  it("홀짝·합계·다음 추첨일", () => {
    expect(oddEven([4, 5, 25, 28, 32, 42])).toBe("2:4");
    expect(sum([4, 5, 25, 28, 32, 42])).toBe(136);
    expect(nextDrawDate("2026-10-10")).toBe("2026-10-17");
    expect(nextDrawDate("2026-12-26")).toBe("2027-01-02");
  });
  it("입력 문자열에서 번호를 뽑는다", () => {
    expect(parseNumbers("3, 11 17/25 0 46 11 42")).toEqual([3, 11, 17, 25, 42]);
  });
  it("출현 횟수 합은 회차 수 × 6", () => {
    expect(sum(frequency(draws))).toBe(draws.length * 6);
  });
});

describe("당첨 결과 자료", () => {
  it("1회부터 빠짐없이 이어지고 추첨일은 7일 간격 토요일이다", () => {
    draws.forEach((d, i) => {
      expect(d.no).toBe(i + 1);
      expect(new Date(`${d.date}T00:00:00Z`).getUTCDay()).toBe(6);
      expect(new Set([...d.nums, d.bonus]).size).toBe(7);
      expect(d.prizes).toHaveLength(5);
    });
  });
  it("참고 사이트와 같은 최근 결과", () => {
    expect(draws[1244]).toMatchObject({ no: 1245, date: "2026-10-10", nums: [4, 5, 25, 28, 32, 42], bonus: 12 });
    expect(draws[1244].prizes[0]).toEqual([3006515775, 10]);
  });
});

describe("1등 배출점", () => {
  it("지역별로 세고 인터넷 판매는 따로 묶는다", () => {
    expect(
      storeRegions([
        ["가", "자동", "서울 성북구 1", "", 0],
        ["인터넷 복권판매사이트", "자동", "동행복권(dhlottery.co.kr)", "", 0],
        ["나", "수동", "서울 도봉구 2", "", 0],
        ["다", "자동", "CU관설점", "강원 원주시 관설동", 1],
      ]),
    ).toEqual([["서울", 2], ["강원", 1], ["인터넷", 1]]);
  });
  it("저장된 배출점 자료는 형식이 맞고, 1등이 있던 회차에만 있다", () => {
    for (const [no, list] of Object.entries(stores as Record<string, unknown[]>)) {
      const d = draws[Number(no) - 1];
      expect(d.prizes[0][1]).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(d.prizes[0][1]);
      for (const s of list as unknown[][]) {
        expect(s).toHaveLength(5);
        expect(typeof s[0]).toBe("string");
        expect((s[0] as string).length).toBeGreaterThan(0);
        expect(["자동", "수동", "반자동", ""]).toContain(s[1]);
      }
    }
    expect(getStores(1)).toBeUndefined();
  });
});
