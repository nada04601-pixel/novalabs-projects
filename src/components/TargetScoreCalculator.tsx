"use client";
import { useState } from "react";
import { calcTargetScore } from "@/lib/calculators/targetScore";
import { num } from "@/lib/format";

type Row = { name: string; weight: string; score: string };
const fmt = (v: number) => (Number.isFinite(v) ? (Math.round(v * 10) / 10).toLocaleString("ko-KR") : "-");

export default function TargetScoreCalculator() {
  const [rows, setRows] = useState<Row[]>([
    { name: "중간고사", weight: "30", score: "72" },
    { name: "과제", weight: "20", score: "90" },
    { name: "출석", weight: "10", score: "100" },
    { name: "기말고사", weight: "40", score: "" },
  ]);
  const [target, setTarget] = useState("85");

  const items = rows.map((r) => ({ name: r.name, weight: Math.min(num(r.weight), 100), score: r.score.trim() === "" ? null : Math.min(num(r.score), 100) }));
  const r = calcTargetScore(items, Math.min(num(target), 100));
  const set = (k: number, patch: Partial<Row>) => setRows((rs) => rs.map((x, i) => (i === k ? { ...x, ...patch } : x)));

  return (
    <div className="calc">
      <p className="note-sm">점수는 100점 만점 기준으로 넣고, 아직 보지 않은 평가는 점수 칸을 비워 두세요.</p>
      <div className="rowlist cols3" role="table" aria-label="평가 항목">
        <div className="rowlist-head" role="row"><span>평가 항목</span><span>반영 비율(%)</span><span>점수</span><span /></div>
        {rows.map((x, k) => (
          <div className="rowlist-row" role="row" key={k}>
            <input aria-label="평가 항목" value={x.name} maxLength={20} onChange={(e) => set(k, { name: e.target.value })} />
            <input aria-label="반영 비율" inputMode="decimal" value={x.weight} onChange={(e) => set(k, { weight: e.target.value })} />
            <input aria-label="점수" inputMode="decimal" placeholder="미응시" value={x.score} onChange={(e) => set(k, { score: e.target.value })} />
            <button type="button" className="link" aria-label={`${x.name || "항목"} 삭제`} onClick={() => setRows((rs) => rs.filter((_, i) => i !== k))}>삭제</button>
          </div>
        ))}
      </div>
      {rows.length < 12 && <button type="button" className="btn sm" onClick={() => setRows((rs) => [...rs, { name: "", weight: "", score: "" }])}>+ 항목 추가</button>}
      <div className="fields" style={{ marginTop: 16 }}>
        <label>목표 총점 (100점 만점)
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>남은 평가에서 받아야 할 점수</span>
          <strong>{r.remainingWeight > 0 ? (r.required <= 0 ? "0점" : `${fmt(r.required)}점`) : "-"}</strong>
          <small>남은 평가 비율 {fmt(r.remainingWeight)}%</small>
        </div>
        {Math.round(r.totalWeight) !== 100 && <p className="warn">반영 비율 합계가 {fmt(r.totalWeight)}%입니다. 강의계획서의 비율을 다시 확인해 주세요.</p>}
        {r.remainingWeight > 0 && r.required > 100 && <p className="warn">남은 평가를 모두 만점 받아도 최대 {fmt(r.maxPossible)}점이라 목표에 닿지 않습니다.</p>}
        {r.remainingWeight > 0 && r.required <= 0 && <p className="warn">지금까지 받은 점수만으로 이미 목표를 넘었습니다.</p>}
        <table>
          <tbody>
            <tr><th>지금까지 확보한 점수</th><td>{fmt(r.earned)}점</td></tr>
            <tr><th>남은 평가 모두 만점일 때</th><td>{fmt(r.maxPossible)}점</td></tr>
            <tr className="sum"><th>목표 총점</th><td>{fmt(Math.min(num(target), 100))}점</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
