"use client";
import { useState } from "react";
import { calcGraduation } from "@/lib/calculators/graduation";
import { num } from "@/lib/format";

type Row = { name: string; required: string; earned: string };

export default function GraduationCalculator() {
  const [total, setTotal] = useState("130");
  const [rows, setRows] = useState<Row[]>([
    { name: "전공필수", required: "24", earned: "18" },
    { name: "전공선택", required: "42", earned: "27" },
    { name: "교양필수", required: "15", earned: "15" },
    { name: "교양선택", required: "15", earned: "12" },
  ]);
  const [extra, setExtra] = useState("8");
  const [left, setLeft] = useState("3");

  const r = calcGraduation(
    num(total),
    rows.map((x) => ({ name: x.name || "영역", required: num(x.required), earned: num(x.earned) })),
    num(extra),
    Math.min(num(left), 20)
  );
  const set = (k: number, patch: Partial<Row>) => setRows((rs) => rs.map((x, i) => (i === k ? { ...x, ...patch } : x)));

  return (
    <div className="calc">
      <div className="fields">
        <label>졸업 기준 학점
          <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
        <label>영역 외 이수 학점 (일반선택 등)
          <input inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </label>
        <label>남은 학기 수
          <input inputMode="numeric" value={left} onChange={(e) => setLeft(e.target.value)} />
        </label>
      </div>
      <h3 style={{ marginTop: 18 }}>영역별 기준</h3>
      <div className="rowlist cols3" role="table" aria-label="이수 영역">
        <div className="rowlist-head" role="row"><span>영역</span><span>기준 학점</span><span>이수 학점</span><span /></div>
        {rows.map((x, k) => (
          <div className="rowlist-row" role="row" key={k}>
            <input aria-label="영역" value={x.name} maxLength={20} onChange={(e) => set(k, { name: e.target.value })} />
            <input aria-label="기준 학점" inputMode="decimal" value={x.required} onChange={(e) => set(k, { required: e.target.value })} />
            <input aria-label="이수 학점" inputMode="decimal" value={x.earned} onChange={(e) => set(k, { earned: e.target.value })} />
            <button type="button" className="link" aria-label={`${x.name || "영역"} 삭제`} onClick={() => setRows((rs) => rs.filter((_, i) => i !== k))}>삭제</button>
          </div>
        ))}
      </div>
      {rows.length < 10 && <button type="button" className="btn sm" onClick={() => setRows((rs) => [...rs, { name: "", required: "", earned: "" }])}>+ 영역 추가</button>}

      <div className="result" aria-live="polite">
        <div className="big">
          <span>졸업까지 남은 학점</span>
          <strong>{r.remaining}학점</strong>
          <small>진행도 {Math.round(r.progress * 100)}% · 학기당 약 {Number.isFinite(r.perSemester) ? Math.ceil(r.perSemester) : "-"}학점</small>
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.progress * 100)}>
          <span style={{ width: `${Math.round(r.progress * 100)}%` }} />
        </div>
        <table>
          <tbody>
            {r.areas.map((a, i) => (
              <tr key={i}><th>{a.name}</th><td>{a.short > 0 ? `${a.short}학점 부족` : "충족"}</td></tr>
            ))}
            <tr className="sum"><th>총 이수 학점</th><td>{r.earnedTotal} / {num(total)}학점</td></tr>
          </tbody>
        </table>
        {Number.isFinite(r.perSemester) && r.perSemester > 21 && <p className="warn">학기당 필요한 학점이 많습니다. 계절학기나 학기 추가를 함께 계획해 보세요.</p>}
      </div>
    </div>
  );
}
