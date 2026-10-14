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

// 동행복권이 1등 배출점을 공개하는 첫 회차
export const STORES_FROM = 262;

// 1등 배출점: [상호, 구분(자동·수동·반자동), 주소, 당첨 당시 주소(바뀐 경우만), 폐점이면 1, 위도, 경도]
// 좌표는 나중에 추가한 값이라 예전 자료에는 없을 수 있고, 동행복권에 좌표가 없으면 0입니다.
export type Store = [string, string, string, string, number, number?, number?];

export const isOnlineStore = ([name, , addr]: Store) => /인터넷|dhlottery/.test(name + addr);

// 판매점 지도·길찾기 링크. 좌표가 있으면 그 위치로, 없으면 주소 검색으로 엽니다.
// 인터넷 판매와 폐점한 곳은 찾아갈 곳이 없어 null입니다.
export function storeMapLinks(store: Store): { map: string; route: string; naver: string } | null {
  const [name, , addr, , closed, lat, lng] = store;
  if (closed || isOnlineStore(store) || !addr) return null;
  const label = name.replace(/,/g, " ");
  const q = encodeURIComponent(addr);
  const naver = `https://map.naver.com/p/search/${q}`;
  if (lat && lng) {
    const at = `${encodeURIComponent(label)},${lat},${lng}`;
    return { map: `https://map.kakao.com/link/map/${at}`, route: `https://map.kakao.com/link/to/${at}`, naver };
  }
  const search = `https://map.kakao.com/link/search/${q}`;
  return { map: search, route: search, naver };
}

// 주소 앞부분(시·도)으로 지역별 배출점 수를 셉니다. 인터넷 판매는 따로 묶습니다.
export function storeRegions(stores: Store[]): [string, number][] {
  const m = new Map<string, number>();
  for (const s of stores) {
    const [, , addr, old] = s;
    const region = isOnlineStore(s) ? "인터넷" : ((old || addr).split(" ")[0] || "기타");
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

// ── 로또 시뮬레이터: "지난 N년간 매주 이 번호로 샀다면?" ──

// 시뮬레이터로 보내는 형식: [회차, 추첨일, 번호 6개, 보너스, 1~5등 1게임당 당첨금]
export type SimDraw = [number, string, number[], number, number[]];
export const simLite = (d: Draw): SimDraw => [d.no, d.date, d.nums, d.bonus, d.prizes.map(([p]) => p)];

export const TICKET = 1000;

// 복권 당첨금 원천징수: 200만 원 이하 비과세, 넘으면 구입비 1,000원을 뺀 금액에
// 3억 원까지 22%(소득세 20%+지방소득세 2%), 3억 원 초과분 33%
export function lottoTax(prize: number): number {
  if (prize <= 2_000_000) return 0;
  const base = prize - TICKET;
  const high = Math.max(0, base - 300_000_000);
  return Math.floor((base - high) * 0.22 + high * 0.33);
}

// 최근 years년 동안의 회차(years가 0이면 전체). 최신 추첨일에서 years년을 거슬러 올라갑니다.
export function drawsSince<T extends { 1: string }>(draws: T[], years: number): T[] {
  if (!years || draws.length === 0) return draws;
  const last = new Date(`${draws[draws.length - 1][1]}T00:00:00Z`);
  last.setUTCFullYear(last.getUTCFullYear() - years);
  const from = last.toISOString().slice(0, 10);
  return draws.filter((d) => d[1] > from);
}

export type SimResult = {
  weeks: number;
  spent: number;
  won: number; // 세전 당첨금 합계
  tax: number;
  counts: number[]; // 인덱스 1~5: 등수별 당첨 횟수(장 수 반영)
  best: { no: number; date: string; rank: number; prize: number } | null;
  firstDate: string;
  lastDate: string;
};

// 매주 같은 번호 tickets장을 샀다고 보고 회차별 실제 당첨금으로 계산합니다.
export function simulate(mine: number[], draws: SimDraw[], tickets = 1): SimResult {
  const counts = [0, 0, 0, 0, 0, 0];
  let won = 0;
  let tax = 0;
  let best: SimResult["best"] = null;
  for (const [no, date, nums, bonus, prizes] of draws) {
    const rank = rankOf(mine, nums, bonus);
    if (rank === 0) continue;
    const prize = prizes[rank - 1];
    counts[rank] += tickets;
    won += prize * tickets;
    tax += lottoTax(prize) * tickets;
    if (!best || rank < best.rank || (rank === best.rank && prize > best.prize)) best = { no, date, rank, prize };
  }
  return {
    weeks: draws.length,
    spent: draws.length * TICKET * tickets,
    won,
    tax,
    counts,
    best,
    firstDate: draws[0]?.[1] ?? "",
    lastDate: draws[draws.length - 1]?.[1] ?? "",
  };
}

// 같은 돈을 매주 적금처럼 넣었다면(연 rate, 주 단위 복리, 세전) 마지막 주에 얼마인지
export function savingsValue(weekly: number, weeks: number, rate = 0.03): number {
  const r = rate / 52;
  return Math.round(r === 0 ? weekly * weeks : weekly * (((1 + r) ** weeks - 1) / r) * (1 + r));
}

// 공유 링크의 해시(#n=1,2,3,4,5,6&y=10&t=1)를 읽고 씁니다.
export const SIM_YEARS = [1, 5, 10, 20, 0] as const;
export function parseSimHash(hash: string): { nums: number[]; years: number; tickets: number } | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const nums = parseNumbers(p.get("n") ?? "").slice(0, PICK).sort((a, b) => a - b);
  if (nums.length !== PICK) return null;
  const y = Number(p.get("y"));
  const t = Number(p.get("t"));
  return {
    nums,
    years: (SIM_YEARS as readonly number[]).includes(y) ? y : 10,
    tickets: Number.isInteger(t) && t >= 1 && t <= 5 ? t : 1,
  };
}
export const simHash = (nums: number[], years: number, tickets: number) => `#n=${nums.join(",")}&y=${years}&t=${tickets}`;
