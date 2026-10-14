import { CITIES, MAX_YEAR, MIN_YEAR } from "./calculators/saju";

// 사주 입력값을 링크(#y=1995&m=5&d=15…)에 담아 공유합니다. 해시(#)는 서버로 보내지지 않습니다.
export type SajuLinkState = {
  calendar: "solar" | "lunar";
  year: number;
  month: number;
  day: number;
  leap: boolean;
  time: string | null; // "HH:MM", 모르면 null
  city: string; // 경도 보정 도시 이름, ""이면 보정 안 함
  dayChange: "23" | "00";
  gender: "male" | "female";
};

export function encodeSajuLink(s: SajuLinkState): string {
  const p = new URLSearchParams();
  p.set("y", String(s.year));
  p.set("m", String(s.month));
  p.set("d", String(s.day));
  if (s.calendar === "lunar") p.set("cal", "l");
  if (s.calendar === "lunar" && s.leap) p.set("leap", "1");
  if (s.time) p.set("t", s.time.replace(":", ""));
  p.set("c", s.city || "-");
  if (s.dayChange === "00") p.set("dc", "00");
  p.set("g", s.gender === "male" ? "m" : "f");
  return p.toString();
}

const int = (v: string | null, min: number, max: number) => {
  if (v === null || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};

// 해시를 읽어 입력값으로 바꿉니다. 날짜가 없거나 범위를 벗어나면 null(기본 화면 유지)을 돌려줍니다.
export function decodeSajuLink(hash: string): SajuLinkState | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const year = int(p.get("y"), MIN_YEAR, MAX_YEAR);
  const month = int(p.get("m"), 1, 12);
  const day = int(p.get("d"), 1, 31);
  if (year === null || month === null || day === null) return null;
  const t = p.get("t");
  const time = t && /^([01]\d|2[0-3])[0-5]\d$/.test(t) ? `${t.slice(0, 2)}:${t.slice(2)}` : null;
  const c = p.get("c");
  const calendar = p.get("cal") === "l" ? "lunar" : "solar";
  return {
    calendar,
    year,
    month,
    day,
    leap: calendar === "lunar" && p.get("leap") === "1",
    time,
    // 모르는 도시 이름은 서울로 둡니다(옛 링크나 잘못 고친 주소 대비).
    city: c === "-" ? "" : CITIES.some((x) => x.name === c) ? c! : "서울",
    dayChange: p.get("dc") === "00" ? "00" : "23",
    gender: p.get("g") === "m" ? "male" : "female",
  };
}
