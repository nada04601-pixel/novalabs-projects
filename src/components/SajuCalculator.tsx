"use client";
import { useState } from "react";
import { CITIES, ELEMENTS, ELEMENT_HANJA, MAX_YEAR, MIN_YEAR, calcSaju, formatUsedTime, type Element } from "@/lib/calculators/saju";

const EL_CLASS: Record<Element, string> = { 목: "el-wood", 화: "el-fire", 토: "el-earth", 금: "el-metal", 수: "el-water" };
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export default function SajuCalculator() {
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [year, setYear] = useState("1995");
  const [month, setMonth] = useState(5);
  const [day, setDay] = useState(15);
  const [leap, setLeap] = useState(false);
  const [time, setTime] = useState("09:30");
  const [noTime, setNoTime] = useState(false);
  const [city, setCity] = useState<string>("서울");
  const [dayChange, setDayChange] = useState<"23" | "00">("23");

  const [h, m] = time.split(":").map(Number);
  const r = calcSaju({
    calendar,
    year: Number(year),
    month,
    day,
    leapMonth: calendar === "lunar" && leap,
    time: noTime || !time ? null : { hour: h, minute: m },
    longitude: CITIES.find((c) => c.name === city)?.lon ?? null,
    dayChange,
  });

  return (
    <div className="calc">
      <div className="seg" role="group" aria-label="달력">
        <button type="button" aria-pressed={calendar === "solar"} onClick={() => setCalendar("solar")}>양력</button>
        <button type="button" aria-pressed={calendar === "lunar"} onClick={() => setCalendar("lunar")}>음력</button>
      </div>
      <div className="fields">
        <label>태어난 해
          <input type="number" inputMode="numeric" min={MIN_YEAR} max={MAX_YEAR} value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
        <label>월
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {range(1, 12).map((v) => <option key={v} value={v}>{v}월</option>)}
          </select>
        </label>
        <label>일
          <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {range(1, calendar === "lunar" ? 30 : 31).map((v) => <option key={v} value={v}>{v}일</option>)}
          </select>
        </label>
        <label>태어난 시각
          <input type="time" value={time} disabled={noTime} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label>태어난 곳 (경도 보정)
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            <option value="">보정 안 함 (한국 표준시)</option>
          </select>
        </label>
        <label>날이 바뀌는 시각
          <select value={dayChange} onChange={(e) => setDayChange(e.target.value as "23" | "00")}>
            <option value="23">23시 (자시부터 다음 날)</option>
            <option value="00">0시 (야자시 적용)</option>
          </select>
        </label>
      </div>
      <div className="checks">
        {calendar === "lunar" && (
          <label className="inline">
            <input type="checkbox" checked={leap} onChange={(e) => setLeap(e.target.checked)} />
            윤달
          </label>
        )}
        <label className="inline">
          <input type="checkbox" checked={noTime} onChange={(e) => setNoTime(e.target.checked)} />
          태어난 시간을 모름
        </label>
      </div>

      <div className="result" aria-live="polite">
        {"error" in r ? (
          <p className="warn">{r.error}</p>
        ) : (
          <>
            <div className="saju-pillars">
              {[...r.pillars].reverse().map((p) => (
                <div key={p.label} className="saju-pillar">
                  <span className="saju-label">{p.label}</span>
                  <span className={`saju-char ${EL_CLASS[p.stemElement]}`}>
                    <b>{p.stem}</b><small>{p.stemKo} · {p.stemElement}</small>
                  </span>
                  <span className={`saju-char ${EL_CLASS[p.branchElement]}`}>
                    <b>{p.branch}</b><small>{p.branchKo} · {p.branchElement}</small>
                  </span>
                </div>
              ))}
            </div>

            {r.warnings.map((w) => <p key={w} className="warn">{w}</p>)}

            <table>
              <tbody>
                <tr>
                  <th>일간 (나를 나타내는 글자)</th>
                  <td>{r.dayMaster.stemKo}{r.dayMaster.element} ({r.dayMaster.stem}{ELEMENT_HANJA[r.dayMaster.element]}, {r.dayMaster.yang ? "양" : "음"})</td>
                </tr>
                <tr><th>띠</th><td>{r.animal}띠</td></tr>
                {calendar === "lunar" && <tr><th>양력 생일</th><td>{r.solar.year}년 {r.solar.month}월 {r.solar.day}일</td></tr>}
                {r.usedTime && <tr><th>계산에 쓴 시각</th><td>{formatUsedTime(r.usedTime)}</td></tr>}
              </tbody>
            </table>
            {r.adjustments.length > 0 && (
              <ul className="saju-notes">
                {r.adjustments.map((a) => <li key={a}>{a}</li>)}
              </ul>
            )}

            <h3>오행 분포</h3>
            <div className="saju-elements">
              {ELEMENTS.map((e) => {
                const n = r.elementCount[e];
                const total = r.pillars.length * 2;
                return (
                  <div key={e} className="saju-el-row">
                    <span>{e}({ELEMENT_HANJA[e]})</span>
                    <span className="saju-bar"><i className={EL_CLASS[e]} style={{ width: `${(n / total) * 100}%` }} /></span>
                    <strong>{n}</strong>
                  </div>
                );
              })}
            </div>
            <p className="saju-summary">
              {summary(r.elementCount)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function summary(count: Record<Element, number>) {
  const max = Math.max(...ELEMENTS.map((e) => count[e]));
  const most = ELEMENTS.filter((e) => count[e] === max);
  const missing = ELEMENTS.filter((e) => count[e] === 0);
  const parts = [`가장 많은 기운은 ${most.join("·")}(${max}개)입니다.`];
  parts.push(missing.length ? `${missing.join("·")} 기운은 팔자에 없습니다.` : "다섯 기운이 모두 있습니다.");
  return parts.join(" ");
}
