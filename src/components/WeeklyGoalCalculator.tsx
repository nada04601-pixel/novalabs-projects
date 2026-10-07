"use client";
import { useState } from "react";
import { weeklyPlan, WEEKDAYS_MON } from "@/lib/calculators/planner";
import CopyButton from "@/components/CopyButton";

const LOADS = [{ v: 0, l: "쉼" }, { v: 1, l: "조금" }, { v: 2, l: "보통" }, { v: 3, l: "많이" }];
const parse = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;

export default function WeeklyGoalCalculator() {
  const [goal, setGoal] = useState("300");
  const [unit, setUnit] = useState("쪽");
  const [decimals, setDecimals] = useState("0");
  const [loads, setLoads] = useState<number[]>([2, 2, 1, 2, 1, 0, 3]);

  const total = Math.min(parse(goal), 1_000_000);
  const r = weeklyPlan(total, loads, Number(decimals));
  const active = loads.filter((l) => l > 0).length;
  const text = () => [`이번 주 목표 ${total.toLocaleString("ko-KR")}${unit}`, ...r.map((x) => `${x.day} ${x.amount.toLocaleString("ko-KR")}${unit} (누적 ${x.cumulative.toLocaleString("ko-KR")})`)].join("\n");

  return (
    <div className="calc">
      <div className="fields">
        <label>이번 주 목표량
          <input inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
        <label>단위
          <input value={unit} maxLength={8} placeholder="쪽, 시간, 개, km" onChange={(e) => setUnit(e.target.value)} />
        </label>
        <label>나누는 단위
          <select value={decimals} onChange={(e) => setDecimals(e.target.value)}>
            <option value="0">정수로 (예: 43쪽)</option>
            <option value="1">소수 첫째 자리까지 (예: 1.5시간)</option>
          </select>
        </label>
      </div>
      <h3 style={{ marginTop: 18 }}>요일별 여유</h3>
      <div className="weekgrid">
        {WEEKDAYS_MON.map((d, i) => (
          <label key={d}>{d}
            <select value={loads[i]} onChange={(e) => setLoads((ls) => ls.map((x, k) => (k === i ? Number(e.target.value) : x)))}>
              {LOADS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
            </select>
          </label>
        ))}
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>하루 평균 (쉬는 날 제외)</span>
          <strong>{active ? `${(Math.round((total / active) * 10) / 10).toLocaleString("ko-KR")}${unit}` : "-"}</strong>
          <small>{active}일 동안 {total.toLocaleString("ko-KR")}{unit}</small>
        </div>
        {active === 0 && <p className="warn">적어도 하루는 '쉼'이 아닌 날로 정해 주세요.</p>}
        <table>
          <tbody>
            {r.map((x, i) => (
              <tr key={x.day}><th>{x.day} · {LOADS[loads[i]].l}</th><td>{x.amount.toLocaleString("ko-KR")}{unit} <span className="note-sm">(누적 {x.cumulative.toLocaleString("ko-KR")})</span></td></tr>
            ))}
          </tbody>
        </table>
        <div className="actions"><CopyButton text={text} label="계획 복사" /></div>
      </div>
    </div>
  );
}
