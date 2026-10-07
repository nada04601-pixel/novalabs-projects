"use client";
import { useState } from "react";
import { pomodoro } from "@/lib/calculators/planner";
import { fmt, toMinutes } from "@/lib/calculators/freePeriod";
import { num } from "@/lib/format";
import CopyButton from "@/components/CopyButton";

const LABEL = { focus: "집중", short: "짧은 휴식", long: "긴 휴식" } as const;
const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}` : `${m}분`);

export default function PomodoroCalculator() {
  const [start, setStart] = useState("09:00");
  const [rounds, setRounds] = useState("6");
  const [focus, setFocus] = useState("25");
  const [short, setShort] = useState("5");
  const [long, setLong] = useState("15");
  const [every, setEvery] = useState("4");

  const s = toMinutes(start);
  const r = pomodoro(Number.isFinite(s) ? s : 0, Math.min(Math.max(num(rounds), 1), 24), Math.min(num(focus) || 25, 180), Math.min(num(short), 60), Math.min(num(long), 120), Math.min(num(every), 12));
  const text = () => ["뽀모도로 계획", ...r.blocks.map((b) => `${fmt(b.start)}~${fmt(b.end)} ${b.kind === "focus" ? `집중 ${b.n}` : LABEL[b.kind]}`)].join("\n");

  return (
    <div className="calc">
      <div className="fields">
        <label>시작 시각 (24시간)
          <input inputMode="numeric" maxLength={5} value={start} onChange={(e) => setStart(e.target.value.replace(/[^0-9:]/g, ""))} />
        </label>
        <label>집중 횟수
          <input inputMode="numeric" value={rounds} onChange={(e) => setRounds(e.target.value)} />
        </label>
        <label>집중 시간 (분)
          <input inputMode="numeric" value={focus} onChange={(e) => setFocus(e.target.value)} />
        </label>
        <label>짧은 휴식 (분)
          <input inputMode="numeric" value={short} onChange={(e) => setShort(e.target.value)} />
        </label>
        <label>긴 휴식 (분)
          <input inputMode="numeric" value={long} onChange={(e) => setLong(e.target.value)} />
        </label>
        <label>긴 휴식 주기 (몇 번째마다)
          <input inputMode="numeric" value={every} onChange={(e) => setEvery(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>끝나는 시각</span>
          <strong>{fmt(r.end)}</strong>
          <small>집중 {hm(r.focusMinutes)} · 전체 {hm(r.total)}</small>
        </div>
        {r.end >= 24 * 60 && <p className="warn">계획이 자정을 넘깁니다. 집중 횟수를 줄여 보세요.</p>}
        <div className="scroll">
          <table>
            <tbody>
              {r.blocks.map((b, i) => (
                <tr key={i} className={b.kind === "focus" ? "" : "rest"}>
                  <th>{fmt(b.start)}~{fmt(b.end)}</th>
                  <td>{b.kind === "focus" ? `집중 ${b.n}` : LABEL[b.kind]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions"><CopyButton text={text} label="계획 복사" /></div>
      </div>
    </div>
  );
}
