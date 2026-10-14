import { ELEMENTS, STEMS, findRelations, groupOf, isResentment, sameTrine, tenGod, type Element, type SajuResult, type TenGod, type TenGodGroup } from "./saju";

// 두 사람의 사주로 궁합 점수를 냅니다. 일간 관계(30) + 일지(배우자 자리) 관계(30) + 오행 보완(25) + 띠(15) = 100점.
// 전통 궁합에서 흔히 보는 요소를 단순하게 점수로 옮긴 것이라 재미와 참고용입니다.

export type DayMasterRel = "합" | "상생" | "비화" | "상극" | "충";
export type BranchRel = "육합" | "삼합" | "반합" | "같음" | "없음" | "파" | "해" | "원진" | "형" | "자형" | "충";

export type MatchResult = {
  total: number;
  grade: string;
  dayMaster: { rel: DayMasterRel; giver?: "a" | "b"; score: number }; // giver: 생하거나 극하는 쪽
  spouse: { rel: BranchRel; chars: string; score: number };
  elements: { aWeak: Element[]; bWeak: Element[]; aFilled: Element[]; bFilled: Element[]; score: number };
  zodiac: { rel: BranchRel; chars: string; score: number };
  // 상대가 나에게 어떤 십신인지(a 기준으로 본 b, b 기준으로 본 a)
  bToA: { god: TenGod; group: TenGodGroup };
  aToB: { god: TenGod; group: TenGodGroup };
};

export const MAX = { dayMaster: 30, spouse: 30, elements: 25, zodiac: 15 } as const;

const DAY_SCORE: Record<DayMasterRel, number> = { 합: 30, 상생: 24, 비화: 16, 상극: 8, 충: 2 };
const SPOUSE_SCORE: Record<BranchRel, number> = { 육합: 30, 삼합: 24, 반합: 24, 같음: 14, 없음: 16, 파: 10, 해: 8, 원진: 8, 형: 6, 자형: 8, 충: 2 };
const ZODIAC_SCORE: Record<BranchRel, number> = { 육합: 15, 삼합: 15, 반합: 15, 같음: 10, 없음: 8, 파: 6, 해: 4, 원진: 4, 형: 4, 자형: 6, 충: 1 };

// 실제 사주들의 점수는 대개 35~65점에 모여서, 평범한 경우가 "무난한 궁합"이 되도록 나눕니다.
export const GRADES: [number, string][] = [[80, "천생연분"], [65, "좋은 궁합"], [50, "무난한 궁합"], [35, "노력이 필요한 궁합"], [0, "서로 많이 다른 두 사람"]];

export function dayMasterRel(a: string, b: string): { rel: DayMasterRel; giver?: "a" | "b" } {
  const kinds = findRelations([{ name: "갑", stem: a, branch: "子" }, { name: "을", stem: b, branch: "子" }]).map((r) => r.kind);
  if (kinds.includes("천간합")) return { rel: "합" };
  if (kinds.includes("천간충")) return { rel: "충" };
  const d = (Math.floor(STEMS.indexOf(b) / 2) - Math.floor(STEMS.indexOf(a) / 2) + 5) % 5;
  if (d === 0) return { rel: "비화" };
  if (d === 1) return { rel: "상생", giver: "a" }; // a가 b를 생함
  if (d === 4) return { rel: "상생", giver: "b" };
  return { rel: "상극", giver: d === 2 ? "a" : "b" }; // d=2면 a가 b를 극함
}

// 두 지지의 관계 하나를 고릅니다. 여러 관계가 겹치면 영향이 큰 것부터 봅니다.
export function branchRel(a: string, b: string, zodiac = false): BranchRel {
  const kinds = new Set(findRelations([{ name: "갑", stem: "甲", branch: a }, { name: "을", stem: "甲", branch: b }]).map((r) => r.kind));
  if (kinds.has("지지충")) return "충";
  if (kinds.has("육합")) return "육합";
  if (kinds.has("반합")) return "반합";
  if (zodiac && sameTrine(a, b)) return "삼합"; // 띠 궁합은 같은 삼합 무리면 좋게 봅니다
  if (kinds.has("형")) return "형";
  if (kinds.has("자형")) return "자형";
  if (isResentment(a, b)) return "원진";
  if (kinds.has("해")) return "해";
  if (kinds.has("파")) return "파";
  return a === b ? "같음" : "없음";
}

// 지장간까지 반영한 세력이 1 미만이면 약한 오행, 상대가 1.5 이상이면 채워 준다고 봅니다.
const weak = (r: SajuResult) => ELEMENTS.filter((e) => r.elementPower[e] < 1);
const fills = (weakOf: SajuResult, other: SajuResult) => weak(weakOf).filter((e) => other.elementPower[e] >= 1.5);

export function calcMatch(a: SajuResult, b: SajuResult): MatchResult {
  const dm = dayMasterRel(a.dayMaster.stem, b.dayMaster.stem);
  const sa = a.pillars[2].branch;
  const sb = b.pillars[2].branch;
  const spouse = branchRel(sa, sb);
  const za = a.pillars[0].branch;
  const zb = b.pillars[0].branch;
  const zodiac = branchRel(za, zb, true);

  const aWeak = weak(a);
  const bWeak = weak(b);
  const aFilled = fills(a, b);
  const bFilled = fills(b, a);
  const weakCount = aWeak.length + bWeak.length;
  const elementScore = weakCount === 0 ? 18 : Math.round(8 + (17 * (aFilled.length + bFilled.length)) / weakCount);

  const parts = {
    dayMaster: { ...dm, score: DAY_SCORE[dm.rel] },
    spouse: { rel: spouse, chars: sa + sb, score: SPOUSE_SCORE[spouse] },
    elements: { aWeak, bWeak, aFilled, bFilled, score: elementScore },
    zodiac: { rel: zodiac, chars: za + zb, score: ZODIAC_SCORE[zodiac] },
  };
  const total = parts.dayMaster.score + parts.spouse.score + parts.elements.score + parts.zodiac.score;
  const ai = STEMS.indexOf(a.dayMaster.stem);
  const bi = STEMS.indexOf(b.dayMaster.stem);
  const bToA = tenGod(ai, bi);
  const aToB = tenGod(bi, ai);
  return {
    total,
    grade: GRADES.find(([min]) => total >= min)![1],
    ...parts,
    bToA: { god: bToA.god, group: groupOf(bToA.god) },
    aToB: { god: aToB.god, group: groupOf(aToB.god) },
  };
}
