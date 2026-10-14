import { CITIES, MAX_YEAR, MIN_YEAR } from "./calculators/saju";

// 사주 입력값을 링크(#y=1995&m=5&d=15…)에 담아 공유합니다. 해시(#)는 서버로 보내지지 않습니다.
// 궁합은 두 사람의 값을 a·b 접두어로 담습니다(#ay=1995&am=5&…&by=1993&…).

// 한 사람의 생년월일시
export type BirthLink = {
  calendar: "solar" | "lunar";
  year: number;
  month: number;
  day: number;
  leap: boolean;
  time: string | null; // "HH:MM", 모르면 null
};

export type SajuLinkState = BirthLink & {
  city: string; // 경도 보정 도시 이름, ""이면 보정 안 함
  dayChange: "23" | "00";
  gender: "male" | "female";
};

export type MatchLinkState = { a: BirthLink; b: BirthLink; city: string; dayChange: "23" | "00" };

function putBirth(p: URLSearchParams, s: BirthLink, prefix = "") {
  p.set(prefix + "y", String(s.year));
  p.set(prefix + "m", String(s.month));
  p.set(prefix + "d", String(s.day));
  if (s.calendar === "lunar") p.set(prefix + "cal", "l");
  if (s.calendar === "lunar" && s.leap) p.set(prefix + "leap", "1");
  if (s.time) p.set(prefix + "t", s.time.replace(":", ""));
}

const int = (v: string | null, min: number, max: number) => {
  if (v === null || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};

// 날짜가 없거나 범위를 벗어나면 null
function getBirth(p: URLSearchParams, prefix = ""): BirthLink | null {
  const year = int(p.get(prefix + "y"), MIN_YEAR, MAX_YEAR);
  const month = int(p.get(prefix + "m"), 1, 12);
  const day = int(p.get(prefix + "d"), 1, 31);
  if (year === null || month === null || day === null) return null;
  const t = p.get(prefix + "t");
  const calendar = p.get(prefix + "cal") === "l" ? "lunar" : "solar";
  return {
    calendar,
    year,
    month,
    day,
    leap: calendar === "lunar" && p.get(prefix + "leap") === "1",
    time: t && /^([01]\d|2[0-3])[0-5]\d$/.test(t) ? `${t.slice(0, 2)}:${t.slice(2)}` : null,
  };
}

// 모르는 도시 이름은 서울로 둡니다(옛 링크나 잘못 고친 주소 대비).
const getCity = (c: string | null) => (c === "-" ? "" : CITIES.some((x) => x.name === c) ? c! : "서울");
const getDayChange = (p: URLSearchParams) => (p.get("dc") === "00" ? "00" : "23");

export function encodeSajuLink(s: SajuLinkState): string {
  const p = new URLSearchParams();
  putBirth(p, s);
  p.set("c", s.city || "-");
  if (s.dayChange === "00") p.set("dc", "00");
  p.set("g", s.gender === "male" ? "m" : "f");
  return p.toString();
}

// 해시를 읽어 입력값으로 바꿉니다. 날짜가 없거나 범위를 벗어나면 null(기본 화면 유지)을 돌려줍니다.
export function decodeSajuLink(hash: string): SajuLinkState | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const birth = getBirth(p);
  if (!birth) return null;
  return { ...birth, city: getCity(p.get("c")), dayChange: getDayChange(p), gender: p.get("g") === "m" ? "male" : "female" };
}

export function encodeMatchLink(s: MatchLinkState): string {
  const p = new URLSearchParams();
  putBirth(p, s.a, "a");
  putBirth(p, s.b, "b");
  p.set("c", s.city || "-");
  if (s.dayChange === "00") p.set("dc", "00");
  return p.toString();
}

// 두 사람 중 한 명이라도 날짜가 잘못되면 null
export function decodeMatchLink(hash: string): MatchLinkState | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const a = getBirth(p, "a");
  const b = getBirth(p, "b");
  if (!a || !b) return null;
  return { a, b, city: getCity(p.get("c")), dayChange: getDayChange(p) };
}
