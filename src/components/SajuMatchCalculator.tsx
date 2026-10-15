"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ShareLinkButtons from "@/components/ShareLinkButtons";
import { decodeMatchLink, encodeMatchLink, type BirthLink } from "@/lib/sajuLink";
import { CITIES, ELEMENTS, ELEMENT_HANJA, MAX_YEAR, MIN_YEAR, calcSaju, type Element, type SajuResult } from "@/lib/calculators/saju";
import { MAX, calcMatch } from "@/lib/calculators/sajuMatch";
import { DAY_MASTER_REL_TEXT, GRADE_TEXT, PARTNER_GOD_TEXT, SPOUSE_REL_TEXT, ZODIAC_REL_TEXT } from "@/data/sajuMatchText";
import DayChangeField from "@/components/DayChangeField";

const EL_CLASS: Record<Element, string> = { 목: "el-wood", 화: "el-fire", 토: "el-earth", 금: "el-metal", 수: "el-water" };
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

type Person = { calendar: "solar" | "lunar"; year: string; month: number; day: number; leap: boolean; time: string; noTime: boolean };

const toLink = (p: Person): BirthLink => ({ calendar: p.calendar, year: Number(p.year), month: p.month, day: p.day, leap: p.leap, time: p.noTime || !p.time ? null : p.time });
// 링크에 시각이 없으면 "시간 모름"으로, 입력칸에는 이전 시각을 그대로 둡니다.
const fromLink = (l: BirthLink, prev: Person): Person => ({ calendar: l.calendar, year: String(l.year), month: l.month, day: l.day, leap: l.leap, time: l.time ?? prev.time, noTime: !l.time });

function PersonFields({ title, p, set }: { title: string; p: Person; set: (p: Person) => void }) {
  const up = (patch: Partial<Person>) => set({ ...p, ...patch });
  return (
    <fieldset className="match-person">
      <legend>{title}</legend>
      <div className="seg" role="group" aria-label={`${title} 달력`}>
        <button type="button" aria-pressed={p.calendar === "solar"} onClick={() => up({ calendar: "solar" })}>양력</button>
        <button type="button" aria-pressed={p.calendar === "lunar"} onClick={() => up({ calendar: "lunar" })}>음력</button>
      </div>
      <div className="fields">
        <label>태어난 해
          <input type="number" inputMode="numeric" min={MIN_YEAR} max={MAX_YEAR} value={p.year} onChange={(e) => up({ year: e.target.value })} />
        </label>
        <label>월
          <select value={p.month} onChange={(e) => up({ month: Number(e.target.value) })}>
            {range(1, 12).map((v) => <option key={v} value={v}>{v}월</option>)}
          </select>
        </label>
        <label>일
          <select value={p.day} onChange={(e) => up({ day: Number(e.target.value) })}>
            {range(1, p.calendar === "lunar" ? 30 : 31).map((v) => <option key={v} value={v}>{v}일</option>)}
          </select>
        </label>
        <label>태어난 시각
          <input type="time" value={p.time} disabled={p.noTime} onChange={(e) => up({ time: e.target.value })} />
        </label>
      </div>
      <div className="checks">
        {p.calendar === "lunar" && (
          <label className="inline"><input type="checkbox" checked={p.leap} onChange={(e) => up({ leap: e.target.checked })} />윤달</label>
        )}
        <label className="inline"><input type="checkbox" checked={p.noTime} onChange={(e) => up({ noTime: e.target.checked })} />시간 모름</label>
      </div>
    </fieldset>
  );
}

function Mini({ title, r }: { title: string; r: SajuResult }) {
  return (
    <div className="match-mini">
      <span className="saju-label">{title} · {r.dayMaster.stemKo}{r.dayMaster.element} 일간 · {r.animal}띠</span>
      <div className="match-mini-row">
        {[...r.pillars].reverse().map((p) => (
          <span key={p.label}>
            <b className={EL_CLASS[p.stemElement]}>{p.stem}</b>
            <b className={EL_CLASS[p.branchElement]}>{p.branch}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SajuMatchCalculator() {
  const [a, setA] = useState<Person>({ calendar: "solar", year: "1995", month: 5, day: 15, leap: false, time: "09:30", noTime: false });
  const [b, setB] = useState<Person>({ calendar: "solar", year: "1993", month: 11, day: 2, leap: false, time: "14:00", noTime: false });
  const [city, setCity] = useState("서울");
  const [dayChange, setDayChange] = useState<"23" | "00">("23");
  const [linked, setLinked] = useState(false);

  // 공유 링크(#ay=…&by=…)로 들어오면 두 사람의 입력값을 채웁니다.
  useEffect(() => {
    const load = () => {
      const s = decodeMatchLink(window.location.hash);
      if (!s) return;
      setA((prev) => fromLink(s.a, prev));
      setB((prev) => fromLink(s.b, prev));
      setCity(s.city);
      setDayChange(s.dayChange);
      setLinked(true);
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  const calc = (p: Person) => {
    const [h, m] = p.time.split(":").map(Number);
    return calcSaju({
      calendar: p.calendar,
      year: Number(p.year),
      month: p.month,
      day: p.day,
      leapMonth: p.calendar === "lunar" && p.leap,
      time: p.noTime || !p.time ? null : { hour: h, minute: m },
      longitude: CITIES.find((c) => c.name === city)?.lon ?? null,
      dayChange,
    });
  };
  const ra = calc(a);
  const rb = calc(b);

  return (
    <div className="calc">
      {linked && <p className="warn">공유받은 링크의 두 사람 생년월일로 계산한 궁합입니다. 값을 바꾸면 그 값으로 다시 계산합니다.</p>}
      <div className="match-people">
        <PersonFields title="나" p={a} set={setA} />
        <PersonFields title="상대" p={b} set={setB} />
      </div>
      <div className="fields limit">
        <label>태어난 곳 (경도 보정, 두 사람 공통)
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            <option value="">보정 안 함 (한국 표준시)</option>
          </select>
        </label>
        <DayChangeField value={dayChange} onChange={setDayChange} />
      </div>

      <div className="result" aria-live="polite">
        {"error" in ra || "error" in rb ? (
          <p className="warn">{"error" in ra ? `나: ${ra.error}` : ""} {"error" in rb ? `상대: ${rb.error}` : ""}</p>
        ) : (
          <>
            <MatchResultView a={ra} b={rb} />
            <ShareLinkButtons
              hash={() => encodeMatchLink({ a: toLink(a), b: toLink(b), city, dayChange })}
              title="우리 궁합 결과"
              note="링크에는 두 사람의 생년월일·시각이 담기니, 두 사람 모두 괜찮을 때 믿을 수 있는 사람에게만 보내세요."
            />
          </>
        )}
      </div>
    </div>
  );
}

function MatchResultView({ a, b }: { a: SajuResult; b: SajuResult }) {
  const m = calcMatch(a, b);
  const rows = [
    { label: "일간 관계", score: m.dayMaster.score, max: MAX.dayMaster, head: `${a.dayMaster.stem}·${b.dayMaster.stem} ${m.dayMaster.rel}`, text: DAY_MASTER_REL_TEXT[m.dayMaster.rel](m.dayMaster.giver) },
    { label: "배우자 자리(일지)", score: m.spouse.score, max: MAX.spouse, head: `${m.spouse.chars} ${m.spouse.rel === "없음" ? "특별한 관계 없음" : m.spouse.rel}`, text: SPOUSE_REL_TEXT[m.spouse.rel] },
    { label: "오행 보완", score: m.elements.score, max: MAX.elements, head: elementHead(m.elements), text: elementText(m.elements) },
    { label: "띠", score: m.zodiac.score, max: MAX.zodiac, head: `${a.animal}띠·${b.animal}띠`, text: ZODIAC_REL_TEXT[m.zodiac.rel] },
  ];

  return (
    <>
      <div className="big">
        <span>궁합 점수</span>
        <strong>{m.total}<span className="of">점 / 100</span></strong>
        <small>{m.grade} · {GRADE_TEXT[m.grade]}</small>
      </div>

      <div className="match-people">
        <Mini title="나" r={a} />
        <Mini title="상대" r={b} />
      </div>

      <div className="saju-reading">
        {rows.map((row) => (
          <section key={row.label} className="saju-card">
            <h4>{row.label} <span className="match-score">{row.score} / {row.max}</span></h4>
            <span className="saju-bar match-bar"><i style={{ width: `${(row.score / row.max) * 100}%` }} /></span>
            <p><b>{row.head}</b><br />{row.text}</p>
          </section>
        ))}

        <section className="saju-card">
          <h4>오행 비교 (지장간 반영)</h4>
          <div className="saju-elements">
            {ELEMENTS.map((e) => (
              <div key={e} className="match-el-row">
                <span>{e}({ELEMENT_HANJA[e]})</span>
                <span className="saju-bar"><i className={EL_CLASS[e]} style={{ width: `${Math.min(a.elementPower[e] / 4, 1) * 100}%` }} /></span>
                <span className="saju-bar"><i className={EL_CLASS[e]} style={{ width: `${Math.min(b.elementPower[e] / 4, 1) * 100}%` }} /></span>
                <strong>{a.elementPower[e]} · {b.elementPower[e]}</strong>
              </div>
            ))}
          </div>
          <p className="saju-muted">왼쪽 막대가 나, 오른쪽 막대가 상대입니다.</p>
        </section>

        <section className="saju-card">
          <h4>서로에게 어떤 사람인가</h4>
          <p><b>상대는 나에게 {m.bToA.god}</b><br />{PARTNER_GOD_TEXT[m.bToA.group]}</p>
          <p><b>나는 상대에게 {m.aToB.god}</b><br />{PARTNER_GOD_TEXT[m.aToB.group]}</p>
        </section>

        <p className="saju-muted">
          일간·일지·오행·띠의 일반적인 궁합 원리를 점수로 단순하게 옮긴 것으로, 두 사람의 관계를 결정하지 않습니다. 재미와 참고용으로 봐 주세요.
          각자의 자세한 사주 풀이는 <Link href="/tools/saju">내 사주 보기</Link>에서 볼 수 있습니다.
        </p>
      </div>
    </>
  );
}

type Elements = ReturnType<typeof calcMatch>["elements"];
const elementHead = (e: Elements) => {
  if (!e.aWeak.length && !e.bWeak.length) return "두 사람 모두 크게 부족한 오행이 없음";
  const parts = [];
  if (e.aWeak.length) parts.push(`나의 약한 기운 ${e.aWeak.join("·")}${e.aFilled.length ? ` → 상대가 ${e.aFilled.join("·")} 채워 줌` : ""}`);
  if (e.bWeak.length) parts.push(`상대의 약한 기운 ${e.bWeak.join("·")}${e.bFilled.length ? ` → 내가 ${e.bFilled.join("·")} 채워 줌` : ""}`);
  return parts.join(" / ");
};
const elementText = (e: Elements) => {
  const weak = e.aWeak.length + e.bWeak.length;
  const filled = e.aFilled.length + e.bFilled.length;
  if (!weak) return "둘 다 오행이 고르게 갖춰져 있어 서로에게 크게 기대지 않고도 안정적입니다.";
  if (filled === weak) return "서로에게 부족한 기운을 상대가 채워 주는 보완 관계입니다. 함께 있을 때 균형이 맞춰집니다.";
  if (filled) return "부족한 기운의 일부를 상대가 채워 줍니다. 채워지지 않는 부분은 생활 습관이나 주변 사람으로 보완해 보세요.";
  return "약한 기운을 상대도 채워 주지 못해, 같은 부분에서 함께 어려움을 겪을 수 있습니다. 서로의 약점을 알고 미리 대비해 두세요.";
};
