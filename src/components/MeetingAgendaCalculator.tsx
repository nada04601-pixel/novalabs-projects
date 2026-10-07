"use client";
import { useState } from "react";
import { planAgenda } from "@/lib/calculators/planner";
import { fmt, toMinutes } from "@/lib/calculators/freePeriod";
import { num } from "@/lib/format";
import CopyButton from "@/components/CopyButton";

type Row = { title: string; weight: string; fixed: string };

export default function MeetingAgendaCalculator() {
  const [start, setStart] = useState("14:00");
  const [total, setTotal] = useState("60");
  const [buffer, setBuffer] = useState("5");
  const [rows, setRows] = useState<Row[]>([
    { title: "지난 회의 확인", weight: "", fixed: "5" },
    { title: "신규 기능 우선순위 결정", weight: "3", fixed: "" },
    { title: "일정 공유", weight: "1", fixed: "" },
    { title: "결정 사항·담당자 정리", weight: "", fixed: "5" },
  ]);

  const s = toMinutes(start);
  const r = planAgenda(
    Number.isFinite(s) ? s : 0,
    Math.min(num(total), 600),
    Math.min(num(buffer), 120),
    rows.map((x) => ({ title: x.title || "안건", weight: Math.min(num(x.weight) || 1, 10), fixed: x.fixed.trim() === "" ? null : Math.min(num(x.fixed), 600) }))
  );
  const set = (k: number, patch: Partial<Row>) => setRows((rs) => rs.map((x, i) => (i === k ? { ...x, ...patch } : x)));
  const text = () =>
    [`회의 진행표 (${fmt(r.rows[0]?.start ?? 0)}~${fmt(r.end)})`, ...r.rows.map((x) => `${fmt(x.start)}~${fmt(x.end)} ${x.title} (${x.minutes}분)`), r.buffer > 0 ? `여유 ${r.buffer}분` : ""]
      .filter(Boolean)
      .join("\n");

  return (
    <div className="calc">
      <div className="fields">
        <label>시작 시각 (24시간)
          <input inputMode="numeric" maxLength={5} placeholder="14:00" value={start} onChange={(e) => setStart(e.target.value.replace(/[^0-9:]/g, ""))} />
        </label>
        <label>전체 회의 시간 (분)
          <input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
        <label>여유 시간 (분)
          <input inputMode="numeric" value={buffer} onChange={(e) => setBuffer(e.target.value)} />
        </label>
      </div>
      <h3 style={{ marginTop: 18 }}>안건</h3>
      <p className="note-sm">시간이 정해진 안건은 '고정(분)'에, 나머지는 중요도(1~10)를 넣으면 남은 시간을 비율대로 나눕니다.</p>
      <div className="rowlist cols3" role="table" aria-label="안건 목록">
        <div className="rowlist-head" role="row"><span>안건</span><span>중요도</span><span>고정(분)</span><span /></div>
        {rows.map((x, k) => (
          <div className="rowlist-row" role="row" key={k}>
            <input aria-label="안건" value={x.title} maxLength={40} onChange={(e) => set(k, { title: e.target.value })} />
            <input aria-label="중요도" inputMode="numeric" placeholder="1" disabled={x.fixed.trim() !== ""} value={x.weight} onChange={(e) => set(k, { weight: e.target.value })} />
            <input aria-label="고정 시간(분)" inputMode="numeric" placeholder="-" value={x.fixed} onChange={(e) => set(k, { fixed: e.target.value })} />
            <button type="button" className="link" aria-label={`${x.title || "안건"} 삭제`} onClick={() => setRows((rs) => rs.filter((_, i) => i !== k))}>삭제</button>
          </div>
        ))}
      </div>
      {rows.length < 15 && <button type="button" className="btn sm" onClick={() => setRows((rs) => [...rs, { title: "", weight: "1", fixed: "" }])}>+ 안건 추가</button>}

      <div className="result" aria-live="polite">
        <div className="big">
          <span>회의 종료</span>
          <strong>{fmt(r.end)}</strong>
          <small>안건 {r.used}분 · 여유 {Math.max(0, r.buffer)}분</small>
        </div>
        {r.overflow && <p className="warn">고정 시간 안건의 합계가 회의 시간보다 깁니다. 회의 시간을 늘리거나 안건을 줄여 주세요.</p>}
        <table>
          <tbody>
            {r.rows.map((x, i) => (
              <tr key={i}><th>{fmt(x.start)}~{fmt(x.end)} {x.title}</th><td>{x.minutes}분</td></tr>
            ))}
          </tbody>
        </table>
        <div className="actions"><CopyButton text={text} label="진행표 복사" /></div>
      </div>
    </div>
  );
}
