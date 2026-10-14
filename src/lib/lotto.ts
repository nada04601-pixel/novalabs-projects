// 로또 6/45 번호 생성과 당첨 결과 계산. 화면 없이 테스트할 수 있게 순수 함수로 둡니다.
import { cryptoRandom, randomInt, type RandomSource } from "./tools/password";

export const MAX = 45;
export const PICK = 6;
// 1등 확률의 분모 = 45개 중 6개를 고르는 조합 수
export const COMBINATIONS = 8_145_060;

export type Draw = {
  no: number;
  date: string; // YYYY-MM-DD (추첨일, 토요일)
  nums: number[]; // 오름차순 6개
  bonus: number;
  prizes: [number, number][]; // 1~5등 [1게임당 당첨금, 당첨 게임 수]
  sales: number; // 총 판매액
  firstBy: { auto: number; manual: number; semi: number };
};

// 1등 배출점: [상호, 구분(자동·수동·반자동), 주소, 당첨 당시 주소(바뀐 경우만), 폐점이면 1]
export type Store = [string, string, string, string, number];

// 주소 앞부분(시·도)으로 지역별 배출점 수를 셉니다. 인터넷 판매는 따로 묶습니다.
export function storeRegions(stores: Store[]): [string, number][] {
  const m = new Map<string, number>();
  for (const [name, , addr, old] of stores) {
    const region = /인터넷|dhlottery/.test(name + addr) ? "인터넷" : ((old || addr).split(" ")[0] || "기타");
    m.set(region, (m.get(region) ?? 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
}

// 화면으로 보내는 가벼운 형식: [회차, 추첨일, 번호 6개, 보너스]
export type DrawLite = [number, string, number[], number];
export const lite = (d: Draw): DrawLite => [d.no, d.date, d.nums, d.bonus];

// 동행복권 공 색상 구간: 1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록
export const ballTone = (n: number) => Math.min(Math.ceil(n / 10), 5);

export type GenerateOptions = { fixed?: number[]; excluded?: number[] };

// 고정수·제외수 조건을 검사하고, 문제가 있으면 안내 문구를 돌려줍니다.
export function validateOptions({ fixed = [], excluded = [] }: GenerateOptions): string | null {
  if (fixed.length > PICK - 1) return `고정수는 최대 ${PICK - 1}개까지 고를 수 있습니다.`;
  if (fixed.some((n) => excluded.includes(n))) return "같은 번호를 고정수와 제외수로 함께 고를 수 없습니다.";
  const pool = MAX - fixed.length - excluded.length;
  if (pool < PICK - fixed.length) return `제외수가 너무 많습니다. 나머지 번호가 ${PICK - fixed.length}개 이상 남아야 합니다.`;
  return null;
}

// 고정수는 반드시 넣고, 제외수는 빼고, 나머지를 치우침 없이 무작위로 채웁니다(부분 피셔-예이츠).
export function generateGame(opts: GenerateOptions = {}, rand: RandomSource = cryptoRandom): number[] {
  const fixed = [...new Set(opts.fixed ?? [])];
  const excluded = new Set(opts.excluded ?? []);
  if (validateOptions({ fixed, excluded: [...excluded] })) throw new Error("invalid options");
  const pool: number[] = [];
  for (let n = 1; n <= MAX; n++) if (!excluded.has(n) && !fixed.includes(n)) pool.push(n);
  const need = PICK - fixed.length;
  for (let i = 0; i < need; i++) {
    const j = i + randomInt(pool.length - i, rand);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return [...fixed, ...pool.slice(0, need)].sort((a, b) => a - b);
}

// 같은 조합이 두 번 나오지 않게 여러 게임을 만듭니다.
export function generateGames(count: number, opts: GenerateOptions = {}, rand: RandomSource = cryptoRandom): number[][] {
  const seen = new Set<string>();
  const games: number[][] = [];
  // 고정수가 5개면 가능한 조합이 몇십 개뿐이라, 시도 횟수에 상한을 둡니다.
  for (let tries = 0; games.length < count && tries < count * 50; tries++) {
    const g = generateGame(opts, rand);
    const key = g.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    games.push(g);
  }
  return games;
}

// 내 번호 6개와 한 회차 결과를 비교해 등수(1~5)를 돌려줍니다. 낙첨이면 0.
export function rankOf(mine: number[], nums: number[], bonus: number): number {
  const hit = mine.filter((n) => nums.includes(n)).length;
  if (hit === 6) return 1;
  if (hit === 5) return mine.includes(bonus) ? 2 : 3;
  if (hit === 4) return 4;
  if (hit === 3) return 5;
  return 0;
}

export const RANK_RULES = ["6개 번호 일치", "5개 번호 + 보너스 번호 일치", "5개 번호 일치", "4개 번호 일치", "3개 번호 일치"];

// 내 번호로 지난 모든 회차를 맞춰 본 결과: 등수별 횟수와 3등 이상 회차
export function checkHistory(mine: number[], draws: DrawLite[]) {
  const counts = [0, 0, 0, 0, 0, 0];
  const best: { no: number; date: string; rank: number }[] = [];
  for (const [no, date, nums, bonus] of draws) {
    const r = rankOf(mine, nums, bonus);
    counts[r]++;
    if (r >= 1 && r <= 3) best.push({ no, date, rank: r });
  }
  return { counts, best: best.sort((a, b) => a.rank - b.rank || b.no - a.no) };
}

export const oddEven = (nums: number[]) => {
  const odd = nums.filter((n) => n % 2 === 1).length;
  return `${odd}:${nums.length - odd}`;
};
export const sum = (nums: number[]) => nums.reduce((a, b) => a + b, 0);

// 번호별 출현 횟수(보너스 제외). 인덱스가 번호이며 0번은 쓰지 않습니다.
export function frequency(draws: { nums: number[] }[] | DrawLite[]): number[] {
  const f = Array<number>(MAX + 1).fill(0);
  for (const d of draws) for (const n of Array.isArray(d) ? d[2] : d.nums) f[n]++;
  return f;
}

// 마지막 추첨 다음 토요일(=7일 뒤). 추첨은 매주 토요일 20:35경입니다.
export function nextDrawDate(lastDate: string): string {
  const d = new Date(`${lastDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEK[d.getUTCDay()]})`;
}

// 숫자 문자열(쉼표·공백 구분)에서 1~45 번호를 중복 없이 뽑아냅니다.
export function parseNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.match(/\d+/g) ?? []) {
    const n = Number(m);
    if (n >= 1 && n <= MAX && !out.includes(n)) out.push(n);
  }
  return out;
}
