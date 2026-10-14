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
