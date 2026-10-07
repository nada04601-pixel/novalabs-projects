"use client";
import { useState } from "react";
import { scheduleTasks } from "@/lib/calculators/planner";
import { fmt, toMinutes } from "@/lib/calculators/freePeriod";
import { num } from "@/lib/format";
import CopyButton from "@/components/CopyButton";

type Row = { title: string; minutes: string; priority: string };
const PRI = [{ v: "1", l: "높음" }, { v: "2", l: "보통" }, { v: "3", l: "낮음" }];
const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}` : `${m}분`);

export default function TaskTimeCalculator() {
  const [start, setStart] = useState("09:30");
  const [end, setEnd] = useState("12:00");
  const [gap, setGap] = useState("10");
  const [rows, setRows] = useState<Row[]>([
    { title: "주간 보고서 작성", minutes: "60", priority: "1" },
    { title: "메일 회신", minutes: "30", priority: "2" },
    { title: "기획안 초안", minutes: "50", priority: "1" },
    { title: "자료 정리", minutes: "40", priority: "3" },
  ]);

  const s = toMinutes(start), e = toMinutes(end);
  const valid = Number.isFinite(s) && Number.isFinite(e) && e > s;
  const r = scheduleTasks(valid ? s : 0, valid ? e : 0, Math.min(num(gap), 120), rows.map((x) => ({ title: x.title || "할 일", minutes: Math.min(num(x.minutes), 1440), priority: Number(x.priority) })));
  const set = (k: number, patch: Partial<Row>) => setRows((rs) => rs.map((x, i) => (i === k ? { ...x, ...patch } : x)));
  const text = () =>
    [`오늘 할 일 (${start}~${end})`, ...r.placed.map((x) => `${fmt(x.start)}~${fmt(x.end)} ${x.title}`), ...(r.left.length ? ["", "남은 일: " + r.left.map((x) => x.title).join(", ")] : [])].join("\n");

  return (
    <div className="calc">
      <div className="fields">
        <label>시작 시각 (24시간)
          <input inputMode="numeric" maxLength={5} value={start} onChange={(ev) => setStart(ev.target.value.replace(/[^0-9:]/g, ""))} />
        </label>
        <label>끝 시각 (24시간)
          <input inputMode="numeric" maxLength={5} value={end} onChange={(ev) => setEnd(ev.target.value.replace(/[^0-9:]/g, ""))} />
        </label>
        <label>일 사이 쉬는 시간 (분)
          <input inputMode="numeric" value={gap} onChange={(ev) => setGap(ev.target.value)} />
        </label>
      </div>
      <h3 style={{ marginTop: 18 }}>할 일</h3>
      <div className="rowlist cols3" role="table" aria-label="할 일 목록">
        <div className="rowlist-head" role="row"><span>할 일</span><span>예상(분)</span><span>우선순위</span><span /></div>
        {rows.map((x, k) => (
          <div className="rowlist-row" role="row" key={k}>
            <input aria-label="할 일" value={x.title} maxLength={40} onChange={(ev) => set(k, { title: ev.target.value })} />
            <input aria-label="예상 시간(분)" inputMode="numeric" value={x.minutes} onChange={(ev) => set(k, { minutes: ev.target.value })} />
            <select aria-label="우선순위" value={x.priority} onChange={(ev) => set(k, { priority: ev.target.value })}>
              {PRI.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
            <button type="button" className="link" aria-label={`${x.title || "할 일"} 삭제`} onClick={() => setRows((rs) => rs.filter((_, i) => i !== k))}>삭제</button>
          </div>
        ))}
      </div>
      {rows.length < 20 && <button type="button" className="btn sm" onClick={() => setRows((rs) => [...rs, { title: "", minutes: "30", priority: "2" }])}>+ 할 일 추가</button>}

      <div className="result" aria-live="polite">
        <div className="big">
          <span>배치한 할 일</span>
          <strong>{r.placed.length} / {r.placed.length + r.left.length}개</strong>
          <small>쓸 수 있는 시간 {hm(r.available)} · 필요한 시간 {hm(r.need)}</small>
        </div>
        {!valid && <p className="warn">시각을 24시간 형식(예: 09:30, 13:00)으로, 끝 시각을 시작 시각보다 늦게 넣어 주세요.</p>}
        {r.left.length > 0 && <p className="warn">시간이 모자라 {r.left.map((x) => x.title).join(", ")}은(는) 넣지 못했습니다. 우선순위를 다시 보거나 다른 시간대로 옮기세요.</p>}
        <table>
          <tbody>
            {r.placed.map((x, i) => (
              <tr key={i}><th>{fmt(x.start)}~{fmt(x.end)} {x.title}</th><td>{PRI.find((p) => Number(p.v) === x.priority)?.l}</td></tr>
            ))}
            {r.placed.length > 0 && <tr className="sum"><th>남는 시간</th><td>{hm(r.freeAfter)}</td></tr>}
          </tbody>
        </table>
        <div className="actions"><CopyButton text={text} label="계획 복사" /></div>
      </div>
    </div>
  );
}
