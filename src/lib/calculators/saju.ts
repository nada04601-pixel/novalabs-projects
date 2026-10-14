import { Lunar, Solar } from "lunar-javascript";

// 사주 팔자(네 기둥의 천간·지지)와 오행 분포를 계산합니다.
// 절기 시각과 음력 변환은 lunar-javascript(MIT)가 계산하며, 이 라이브러리는 중국 표준시(UTC+8) 기준이라
// 연주·월주는 태어난 순간을 UTC+8 시각으로 바꿔 넘기고, 일주·시주는 태어난 곳의 시각으로 정합니다.

export type Element = "목" | "화" | "토" | "금" | "수";
export const ELEMENTS: Element[] = ["목", "화", "토", "금", "수"];
export const ELEMENT_HANJA: Record<Element, string> = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" };

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const STEMS_KO = "갑을병정무기경신임계";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const BRANCHES_KO = "자축인묘진사오미신유술해";
const ANIMALS = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
const STEM_ELEMENT: Element[] = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];
const BRANCH_ELEMENT: Element[] = ["수", "토", "목", "목", "토", "화", "화", "토", "금", "금", "토", "수"];
// 지지의 본기(가장 큰 지장간). 지지의 십신은 이 천간으로 정합니다. 子癸 丑己 寅甲 卯乙 辰戊 巳丙 午丁 未己 申庚 酉辛 戌戊 亥壬
const BRANCH_MAIN_STEM = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];

export type TenGod = "비견" | "겁재" | "식신" | "상관" | "편재" | "정재" | "편관" | "정관" | "편인" | "정인";
export type TenGodGroup = "비겁" | "식상" | "재성" | "관성" | "인성";
export const TEN_GOD_GROUPS: TenGodGroup[] = ["비겁", "식상", "재성", "관성", "인성"];
const TEN_GODS: [TenGod, TenGod][] = [["비견", "겁재"], ["식신", "상관"], ["편재", "정재"], ["편관", "정관"], ["편인", "정인"]];

// 일간(천간 번호)과 다른 천간의 관계. 오행 순서 목→화→토→금→수에서 몇 칸 떨어졌는지로
// 같음(비겁)·내가 낳음(식상)·내가 이김(재성)·나를 이김(관성)·나를 낳음(인성)을 가리고, 음양이 같으면 앞쪽(편), 다르면 뒤쪽(정)입니다.
export function tenGod(dayStem: number, other: number): { god: TenGod; group: TenGodGroup } {
  const rel = (Math.floor(other / 2) - Math.floor(dayStem / 2) + 5) % 5;
  return { god: TEN_GODS[rel][dayStem % 2 === other % 2 ? 0 : 1], group: TEN_GOD_GROUPS[rel] };
}

// 경도 보정에 쓰는 도시(동경, 도). 한국 표준시는 동경 135도 기준이라 서울은 약 32분 늦습니다.
export const CITIES = [
  { name: "서울", lon: 126.98 },
  { name: "인천", lon: 126.71 },
  { name: "수원", lon: 127.01 },
  { name: "춘천", lon: 127.73 },
  { name: "강릉", lon: 128.88 },
  { name: "대전", lon: 127.38 },
  { name: "청주", lon: 127.49 },
  { name: "전주", lon: 127.15 },
  { name: "광주", lon: 126.85 },
  { name: "대구", lon: 128.6 },
  { name: "울산", lon: 129.31 },
  { name: "부산", lon: 129.08 },
  { name: "창원", lon: 128.68 },
  { name: "제주", lon: 126.53 },
] as const;

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

export type SajuInput = {
  calendar: "solar" | "lunar";
  year: number;
  month: number;
  day: number;
  leapMonth?: boolean; // 음력 윤달
  time: { hour: number; minute: number } | null; // 모르면 null
  // 경도 보정할 동경 값. null이면 한국 표준시(UTC+9) 그대로 씁니다.
  longitude: number | null;
  // 23시에 날을 바꿀지(자시), 0시에 바꿀지(야자시)
  dayChange: "23" | "00";
};

export type Pillar = {
  label: "연주" | "월주" | "일주" | "시주";
  stem: string;
  branch: string;
  stemKo: string;
  branchKo: string;
  stemElement: Element;
  branchElement: Element;
  stemTenGod: TenGod | null; // 일간 자리는 null
  branchTenGod: TenGod;
};

export type SajuResult = {
  solar: { year: number; month: number; day: number };
  pillars: Pillar[]; // 시주는 시간을 모르면 빠집니다
  elementCount: Record<Element, number>;
  // 일간을 뺀 나머지 글자(시간을 알면 7개, 모르면 5개)의 십신 그룹별 개수
  tenGodCount: Record<TenGodGroup, number>;
  dayMaster: { stem: string; stemKo: string; element: Element; yang: boolean };
  animal: string;
  // 계산에 실제로 쓴 시각(보정 후)과 보정 내역
  usedTime: { year: number; month: number; day: number; hour: number; minute: number } | null;
  adjustments: string[];
  warnings: string[];
  // 대운 계산에 쓰는 태어난 순간(UTC 밀리초). 시간을 모르면 그날 정오(한국 시각)
  birthUtc: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

// 해당 UTC 순간에 한국(Asia/Seoul)의 UTC 오프셋(분). 1954~1961년의 UTC+8:30과 서머타임을 브라우저의 시간대 자료로 반영합니다.
export function seoulOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

// 한국 시계로 적은 날짜·시각을 UTC 밀리초로 바꿉니다.
export function seoulClockToUtc(y: number, m: number, d: number, h: number, mi: number): number {
  const naive = Date.UTC(y, m - 1, d, h, mi);
  let utc = naive - 540 * 60000;
  for (let i = 0; i < 3; i++) utc = naive - seoulOffsetMinutes(utc) * 60000;
  return utc;
}

const clockFields = (ms: number) => {
  const t = new Date(ms);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), hour: t.getUTCHours(), minute: t.getUTCMinutes() };
};

const eightChar = (c: ReturnType<typeof clockFields>, dayChange: SajuInput["dayChange"]) => {
  const ec = Solar.fromYmdHms(c.year, c.month, c.day, c.hour, c.minute, 0).getLunar().getEightChar();
  ec.setSect(dayChange === "23" ? 1 : 2);
  return ec;
};

type GanZhi = Omit<Pillar, "label">;

// 천간·지지 번호로 글자와 오행, 일간 기준 십신을 채웁니다.
const ganZhi = (s: number, b: number, dayStem: number): GanZhi => ({
  stem: STEMS[s],
  branch: BRANCHES[b],
  stemKo: STEMS_KO[s],
  branchKo: BRANCHES_KO[b],
  stemElement: STEM_ELEMENT[s],
  branchElement: BRANCH_ELEMENT[b],
  stemTenGod: tenGod(dayStem, s).god,
  branchTenGod: tenGod(dayStem, BRANCH_MAIN_STEM[b]).god,
});

// 60갑자 순번(甲子=0)
const sexagenary = (k: number, dayStem: number) => ganZhi(((k % 60) + 60) % 60 % 10, ((k % 60) + 60) % 60 % 12, dayStem);
const sexagenaryIndex = (s: number, b: number) => (6 * s - 5 * b + 60) % 60;

const toPillar = (label: Pillar["label"], gz: string, dayStem: number): Pillar => {
  const s = STEMS.indexOf(gz[0]);
  const b = BRANCHES.indexOf(gz[1]);
  return {
    stemTenGod: label === "일주" ? null : tenGod(dayStem, s).god,
    branchTenGod: tenGod(dayStem, BRANCH_MAIN_STEM[b]).god,
    label,
    stem: gz[0],
    branch: gz[1],
    stemKo: STEMS_KO[s],
    branchKo: BRANCHES_KO[b],
    stemElement: STEM_ELEMENT[s],
    branchElement: BRANCH_ELEMENT[b],
  };
};

// 음력 날짜를 양력으로 바꿉니다. 없는 날짜(윤달이 없는 해, 30일이 없는 달 등)면 null.
export function lunarToSolar(year: number, month: number, day: number, leap: boolean) {
  try {
    const s = Lunar.fromYmd(year, leap ? -month : month, day).getSolar();
    return { year: s.getYear(), month: s.getMonth(), day: s.getDay() };
  } catch {
    return null;
  }
}

const isValidSolar = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

export type SajuError = { error: string };

export function calcSaju(input: SajuInput): SajuResult | SajuError {
  const { year, month, day, time, longitude, dayChange } = input;
  if (![year, month, day].every(Number.isInteger) || year < MIN_YEAR || year > MAX_YEAR) {
    return { error: `${MIN_YEAR}년부터 ${MAX_YEAR}년 사이의 날짜를 넣어 주세요.` };
  }
  let solar = { year, month, day };
  if (input.calendar === "lunar") {
    const s = lunarToSolar(year, month, day, !!input.leapMonth);
    if (!s) return { error: input.leapMonth ? "그해에는 해당 윤달이 없거나 없는 날짜입니다." : "음력에 없는 날짜입니다. 달의 날수(29일·30일)를 확인해 주세요." };
    solar = s;
  } else if (!isValidSolar(year, month, day)) {
    return { error: "없는 날짜입니다." };
  }
  if (time && !(Number.isInteger(time.hour) && Number.isInteger(time.minute) && time.hour >= 0 && time.hour < 24 && time.minute >= 0 && time.minute < 60)) {
    return { error: "태어난 시각을 확인해 주세요." };
  }

  const adjustments: string[] = [];
  const warnings: string[] = [];
  const toChina = (utc: number) => clockFields(utc + 480 * 60000);

  let ymChar;
  let dayChar;
  let birthUtc: number;
  let usedTime: SajuResult["usedTime"] = null;

  if (time) {
    const utc = seoulClockToUtc(solar.year, solar.month, solar.day, time.hour, time.minute);
    const offset = seoulOffsetMinutes(utc);
    if (offset === 600 || offset === 570) adjustments.push("서머타임 기간이라 1시간을 뺐습니다.");
    if (offset === 510 || offset === 570) adjustments.push("당시 표준시가 UTC+8:30이라 그 기준으로 맞췄습니다.");
    // 경도 보정이면 지방 평균태양시, 아니면 한국 표준시(UTC+9)
    const localOffset = longitude === null ? 540 : (longitude / 15) * 60;
    if (longitude !== null) {
      const diff = Math.round(localOffset - 540);
      adjustments.push(`동경 ${longitude}도 기준 경도 보정으로 ${diff < 0 ? `${-diff}분을 뺐습니다` : `${diff}분을 더했습니다`}.`);
    }
    const local = clockFields(Math.round((utc + localOffset * 60000) / 60000) * 60000);
    usedTime = local;
    birthUtc = utc;
    ymChar = eightChar(toChina(utc), dayChange);
    dayChar = eightChar(local, dayChange);
  } else {
    // 시간을 모르면 정오로 보고 시주는 빼며, 절기가 바뀌는 날이면 알려 줍니다.
    const noon = clockFields(Date.UTC(solar.year, solar.month - 1, solar.day, 12, 0));
    dayChar = eightChar(noon, dayChange);
    const start = eightChar(toChina(seoulClockToUtc(solar.year, solar.month, solar.day, 0, 0)), dayChange);
    const end = eightChar(toChina(seoulClockToUtc(solar.year, solar.month, solar.day, 23, 59)), dayChange);
    birthUtc = seoulClockToUtc(solar.year, solar.month, solar.day, 12, 0);
    ymChar = eightChar(toChina(birthUtc), dayChange);
    if (start.getMonth() !== end.getMonth()) {
      warnings.push("이날은 절기가 바뀌는 날이라 태어난 시각에 따라 월주" + (start.getYear() !== end.getYear() ? "와 연주가" : "가") + " 달라집니다. 정오 기준으로 보여 드리니 시각을 알면 넣어 주세요.");
    }
  }

  const dmIndex = STEMS.indexOf(dayChar.getDay()[0]);
  const pillars = [
    toPillar("연주", ymChar.getYear(), dmIndex),
    toPillar("월주", ymChar.getMonth(), dmIndex),
    toPillar("일주", dayChar.getDay(), dmIndex),
    ...(time ? [toPillar("시주", dayChar.getTime(), dmIndex)] : []),
  ];

  const elementCount = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  for (const p of pillars) {
    elementCount[p.stemElement]++;
    elementCount[p.branchElement]++;
  }

  const tenGodCount = Object.fromEntries(TEN_GOD_GROUPS.map((g) => [g, 0])) as Record<TenGodGroup, number>;
  for (const p of pillars) {
    if (p.stemTenGod) tenGodCount[groupOf(p.stemTenGod)]++;
    tenGodCount[groupOf(p.branchTenGod)]++;
  }

  const dm = pillars[2];
  return {
    solar,
    pillars,
    elementCount,
    tenGodCount,
    dayMaster: { stem: dm.stem, stemKo: dm.stemKo, element: dm.stemElement, yang: dmIndex % 2 === 0 },
    animal: ANIMALS[BRANCHES.indexOf(pillars[0].branch)],
    usedTime,
    adjustments,
    warnings,
    birthUtc,
  };
}

export type LuckPillar = GanZhi & {
  year: number; // 시작하는 해(대운) 또는 그해(세운)
  month?: number; // 대운이 시작하는 달
  age: number; // 시작할 때 만 나이(대운) 또는 그해 생일이 지난 뒤의 만 나이(세운)
  current: boolean;
};

export type LuckResult = {
  forward: boolean; // 순행이면 true
  // 태어나서 첫 대운이 시작되기까지
  start: { years: number; months: number };
  daeun: LuckPillar[];
  seun: LuckPillar[];
};

const DAY_MS = 86_400_000;
const YEAR_MS = 365.2425 * DAY_MS;

// 대운과 세운. 대운은 월주에서 한 칸씩 나아가거나(순행) 물러나며(역행), 양년생 남자·음년생 여자는 순행입니다.
// 태어난 순간부터 다음 절입(순행) 또는 지난 절입(역행)까지의 시간을 3일 = 1년으로 바꿔 첫 대운의 시작 시점을 정합니다.
export function calcLuck(
  r: SajuResult,
  gender: "male" | "female",
  today: { year: number; month: number; day: number },
  seunRange: [number, number] = [-2, 7],
): LuckResult {
  const dayStem = STEMS.indexOf(r.dayMaster.stem);
  const yearStem = STEMS.indexOf(r.pillars[0].stem);
  const forward = (yearStem % 2 === 0) === (gender === "male");

  // 절기 시각은 중국 표준시 기준이라 태어난 순간도 같은 기준의 시계로 넘겨 차이를 구합니다.
  const china = clockFields(r.birthUtc + 480 * 60000);
  const lunar = Solar.fromYmdHms(china.year, china.month, china.day, china.hour, china.minute, 0).getLunar();
  const jie = (forward ? lunar.getNextJie(false) : lunar.getPrevJie(false)).getSolar();
  const jieUtc = Date.UTC(jie.getYear(), jie.getMonth() - 1, jie.getDay(), jie.getHour(), jie.getMinute(), jie.getSecond()) - 480 * 60000;
  const offsetYears = Math.abs(jieUtc - r.birthUtc) / (3 * DAY_MS);
  const totalMonths = Math.round(offsetYears * 12);
  const firstStart = new Date(r.birthUtc + 540 * 60000 + offsetYears * YEAR_MS); // 한국 시계 기준

  const todayKey = today.year * 100 + today.month;
  const month = r.pillars[1];
  const monthIndex = sexagenaryIndex(STEMS.indexOf(month.stem), BRANCHES.indexOf(month.branch));
  const daeun: LuckPillar[] = [];
  for (let i = 1; i <= 10; i++) {
    const year = firstStart.getUTCFullYear() + 10 * (i - 1);
    const m = firstStart.getUTCMonth() + 1;
    daeun.push({ ...sexagenary(monthIndex + (forward ? i : -i), dayStem), year, month: m, age: Math.floor(totalMonths / 12) + 10 * (i - 1), current: false });
  }
  const cur = daeun.findLastIndex((d) => d.year * 100 + d.month! <= todayKey);
  if (cur >= 0) daeun[cur].current = true;

  // 세운: 그해의 간지(입춘 기준). 1984년이 甲子년입니다.
  const seun: LuckPillar[] = [];
  for (let y = today.year + seunRange[0]; y <= today.year + seunRange[1]; y++) {
    seun.push({ ...sexagenary(y - 1984, dayStem), year: y, age: y - r.solar.year, current: y === today.year });
  }

  return { forward, start: { years: Math.floor(totalMonths / 12), months: totalMonths % 12 }, daeun, seun };
}

export const groupOf = (god: TenGod): TenGodGroup => TEN_GOD_GROUPS[TEN_GODS.findIndex((pair) => pair.includes(god))];

export const formatUsedTime = (t: NonNullable<SajuResult["usedTime"]>) =>
  `${t.year}-${pad(t.month)}-${pad(t.day)} ${pad(t.hour)}:${pad(t.minute)}`;

// ---- 합·충·형·파·해 ----
export type RelationKind = "천간합" | "천간충" | "육합" | "삼합" | "반합" | "방합" | "지지충" | "삼형" | "형" | "자형" | "파" | "해";
export type Relation = {
  kind: RelationKind;
  chars: string; // 관계를 이루는 글자들(예: 子午)
  places: string[]; // 자리 이름(예: 월지, 일지, 대운 지지)
  element?: Element; // 합으로 만들어지는 오행
  name?: string; // 형의 이름(무은지형·지세지형·무례지형)
};
// 자리 하나. name은 "연"·"월"·"일"·"시" 또는 "대운"·"세운"
export type Slot = { name: string; stem: string; branch: string };

const STEM_COMBINE_ELEMENT: Element[] = ["토", "금", "수", "목", "화"]; // 甲己 乙庚 丙辛 丁壬 戊癸
const SIX_COMBINE_ELEMENT: Record<number, Element> = { 0: "토", 2: "목", 3: "화", 4: "금", 5: "수", 6: "화" }; // 子丑 寅亥 卯戌 辰酉 巳申 午未
// 삼합: [생지, 왕지, 고지]와 만들어지는 오행. 왕지가 끼어 있어야 반합으로 봅니다.
const THREE_COMBINE: [number[], Element][] = [[[8, 0, 4], "수"], [[11, 3, 7], "목"], [[2, 6, 10], "화"], [[5, 9, 1], "금"]];
const DIRECTION_COMBINE: [number[], Element][] = [[[2, 3, 4], "목"], [[5, 6, 7], "화"], [[8, 9, 10], "금"], [[11, 0, 1], "수"]];

// 형: 寅巳申(무은지형)·丑戌未(지세지형) 삼형과 그 두 글자, 子卯(무례지형). 寅申·丑未는 충으로 따로 잡히므로 형으로 다시 세지 않습니다.
const THREE_PUNISH: [number[], string][] = [[[2, 5, 8], "무은지형"], [[1, 10, 7], "지세지형"]];
const PAIR_PUNISH: [number, number, string][] = [[2, 5, "무은지형"], [5, 8, "무은지형"], [1, 10, "지세지형"], [10, 7, "지세지형"], [0, 3, "무례지형"]];
const SELF_PUNISH = [4, 6, 9, 11]; // 辰 午 酉 亥
const BREAK_PAIRS = [[0, 9], [1, 4], [2, 11], [3, 6], [5, 8], [7, 10]]; // 子酉 丑辰 寅亥 卯午 巳申 未戌
const samePair = (a: number, b: number, [x, y]: number[]) => (a === x && b === y) || (a === y && b === x);

const stemPlace = (n: string) => (n.length === 1 ? `${n}간` : `${n} 천간`);
const branchPlace = (n: string) => (n.length === 1 ? `${n}지` : `${n} 지지`);

// 자리들 사이의 합·충을 찾습니다. must를 주면 그 자리가 끼어 있는 관계만 돌려줍니다(운과 원국 사이를 볼 때).
export function findRelations(slots: Slot[], must?: string): Relation[] {
  const out: Relation[] = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      const sa = STEMS.indexOf(a.stem);
      const sb = STEMS.indexOf(b.stem);
      const sp = [stemPlace(a.name), stemPlace(b.name)];
      if (Math.abs(sa - sb) === 5) out.push({ kind: "천간합", chars: a.stem + b.stem, places: sp, element: STEM_COMBINE_ELEMENT[Math.min(sa, sb)] });
      if (Math.abs(sa - sb) === 6) out.push({ kind: "천간충", chars: a.stem + b.stem, places: sp });
      const ba = BRANCHES.indexOf(a.branch);
      const bb = BRANCHES.indexOf(b.branch);
      const bp = [branchPlace(a.name), branchPlace(b.name)];
      if ((ba + bb) % 12 === 1) out.push({ kind: "육합", chars: a.branch + b.branch, places: bp, element: SIX_COMBINE_ELEMENT[Math.min(ba, bb)] });
      if (Math.abs(ba - bb) === 6) out.push({ kind: "지지충", chars: a.branch + b.branch, places: bp });
      const punish = PAIR_PUNISH.find(([x, y]) => samePair(ba, bb, [x, y]));
      if (punish) out.push({ kind: "형", chars: a.branch + b.branch, places: bp, name: punish[2] });
      if (ba === bb && SELF_PUNISH.includes(ba)) out.push({ kind: "자형", chars: a.branch + b.branch, places: bp });
      if (BREAK_PAIRS.some((pair) => samePair(ba, bb, pair))) out.push({ kind: "파", chars: a.branch + b.branch, places: bp });
      if (ba !== bb && (ba + bb) % 12 === 7) out.push({ kind: "해", chars: a.branch + b.branch, places: bp });
    }
  }
  const groups = (list: [number[], Element][], full: RelationKind, half?: RelationKind) => {
    for (const [members, element] of list) {
      const inGroup = slots.filter((s) => members.includes(BRANCHES.indexOf(s.branch)));
      const present = members.filter((m) => inGroup.some((s) => BRANCHES.indexOf(s.branch) === m));
      const places = inGroup.map((s) => branchPlace(s.name));
      const chars = present.map((m) => BRANCHES[m]).join("");
      if (present.length === 3) out.push({ kind: full, chars, places, element });
      else if (half && present.length === 2 && present.includes(members[1])) out.push({ kind: half, chars, places, element });
    }
  };
  groups(THREE_COMBINE, "삼합", "반합");
  groups(DIRECTION_COMBINE, "방합");
  // 삼형이 다 모이면 그 안의 두 글자 형은 삼형 하나로 묶습니다.
  for (const [members, name] of THREE_PUNISH) {
    const inGroup = slots.filter((s) => members.includes(BRANCHES.indexOf(s.branch)));
    if (members.every((m) => inGroup.some((s) => BRANCHES.indexOf(s.branch) === m))) {
      for (let k = out.length - 1; k >= 0; k--) if (out[k].kind === "형" && out[k].name === name) out.splice(k, 1);
      out.push({ kind: "삼형", chars: members.map((m) => BRANCHES[m]).join(""), places: inGroup.map((s) => branchPlace(s.name)), name });
    }
  }
  if (!must) return out;
  const mp = [stemPlace(must), branchPlace(must)];
  return out.filter((r) => r.places.some((p) => mp.includes(p)));
}

const NATAL_NAMES = ["연", "월", "일", "시"];
export const natalSlots = (r: SajuResult): Slot[] => r.pillars.map((p, i) => ({ name: NATAL_NAMES[i], stem: p.stem, branch: p.branch }));

// ---- 신살 ----
export type ShinsalName =
  | "천을귀인" | "문창귀인" | "도화살" | "역마살" | "화개살" | "홍염살"
  | "양인살" | "백호살" | "괴강살" | "원진살" | "공망";
export type Shinsal = { name: ShinsalName; places: string[] };

// 일간 기준으로 찾는 지지(천간 순서 甲乙丙丁戊己庚辛壬癸). 학파마다 조금씩 다르며, 국내 만세력에서 흔히 쓰는 표를 따릅니다.
const HEAVENLY_NOBLE = ["丑未", "子申", "亥酉", "亥酉", "丑未", "子申", "丑未", "寅午", "巳卯", "巳卯"];
const LITERARY = "巳午申酉申酉亥子寅卯";
const RED_FLAME = "午午寅未辰辰戌酉子申";
const BLADE: Record<string, string> = { 甲: "卯", 丙: "午", 戊: "午", 庚: "酉", 壬: "子" }; // 양간만 봅니다
// 연지·일지가 속한 삼합(申子辰 寅午戌 巳酉丑 亥卯未)마다 도화·역마·화개가 되는 지지
const GROUP_OF = (b: number) => [8, 0, 4].includes(b) ? 0 : [2, 6, 10].includes(b) ? 1 : [5, 9, 1].includes(b) ? 2 : 3;
const PEACH = "酉卯午子";
const HORSE = "寅申亥巳";
const CANOPY = "辰戌丑未";
const WHITE_TIGER = ["甲辰", "乙未", "丙戌", "丁丑", "戊辰", "壬戌", "癸丑"];
const KUIGANG = ["庚辰", "庚戌", "壬辰", "壬戌", "戊戌"];
const RESENTMENT = [[0, 7], [1, 6], [2, 9], [3, 8], [4, 11], [5, 10]]; // 子未 丑午 寅酉 卯申 辰亥 巳戌

const pillarPlace = (n: string) => (n.length === 1 ? `${n}주` : n);

// 자리들에서 신살을 찾습니다. 일간·연지·일지·일주(공망)를 기준으로 삼으므로 slots에는 "연"과 "일"이 있어야 합니다.
// must를 주면 그 자리(대운·세운)에 걸린 신살만 돌려줍니다.
export function findShinsal(slots: Slot[], must?: string): Shinsal[] {
  const day = slots.find((s) => s.name === "일")!;
  const dayStem = STEMS.indexOf(day.stem);
  const hits = new Map<ShinsalName, string[]>();
  const add = (name: ShinsalName, place: string) => {
    const list = hits.get(name) ?? [];
    if (!list.includes(place)) list.push(place);
    hits.set(name, list);
  };

  for (const s of slots) {
    const p = branchPlace(s.name);
    if (HEAVENLY_NOBLE[dayStem].includes(s.branch)) add("천을귀인", p);
    if (LITERARY[dayStem] === s.branch) add("문창귀인", p);
    if (RED_FLAME[dayStem] === s.branch) add("홍염살", p);
    if (BLADE[day.stem] === s.branch) add("양인살", p);
    if (WHITE_TIGER.includes(s.stem + s.branch)) add("백호살", pillarPlace(s.name));
    if (KUIGANG.includes(s.stem + s.branch)) add("괴강살", pillarPlace(s.name));
  }
  // 도화·역마·화개는 연지와 일지를 기준으로, 기준 자리를 뺀 나머지에서 찾습니다.
  for (const base of slots.filter((s) => s.name === "연" || s.name === "일")) {
    const g = GROUP_OF(BRANCHES.indexOf(base.branch));
    for (const s of slots) {
      if (s === base) continue;
      if (PEACH[g] === s.branch) add("도화살", branchPlace(s.name));
      if (HORSE[g] === s.branch) add("역마살", branchPlace(s.name));
      if (CANOPY[g] === s.branch) add("화개살", branchPlace(s.name));
    }
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (must && slots[i].name !== must && slots[j].name !== must) continue; // 운을 볼 때는 운이 낀 쌍만
      const a = BRANCHES.indexOf(slots[i].branch);
      const b = BRANCHES.indexOf(slots[j].branch);
      if (RESENTMENT.some((pair) => samePair(a, b, pair))) {
        add("원진살", branchPlace(slots[i].name));
        add("원진살", branchPlace(slots[j].name));
      }
    }
  }
  // 공망: 일주가 속한 순(旬)에서 짝이 없는 두 지지가 일주 밖의 자리에 있으면
  const k = sexagenaryIndex(dayStem, BRANCHES.indexOf(day.branch));
  const xun = k - (k % 10);
  const empty = [BRANCHES[(xun + 10) % 12], BRANCHES[(xun + 11) % 12]];
  for (const s of slots) if (s !== day && empty.includes(s.branch)) add("공망", branchPlace(s.name));

  const order: ShinsalName[] = ["천을귀인", "문창귀인", "도화살", "역마살", "화개살", "홍염살", "괴강살", "공망", "양인살", "백호살", "원진살"];
  const out = order.filter((n) => hits.has(n)).map((name) => ({ name, places: hits.get(name)! }));
  if (!must) return out;
  const mine = [branchPlace(must), pillarPlace(must)];
  return out.filter((x) => x.places.some((p) => mine.includes(p))).map((x) => ({ ...x, places: x.places.filter((p) => mine.includes(p) || x.name === "원진살") }));
}
