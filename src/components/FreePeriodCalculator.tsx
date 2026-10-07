"use client";
import { useState } from "react";
import { analyzeTimetable, DAYS, fmt, toMinutes, type Day } from "@/lib/calculators/freePeriod";

type Row = { name: string; day: Day; start: string; end: string };
const hm = (mins: number) => (mins >= 60 ? `${Math.floor(mins / 60)}시간${mins % 60 ? ` ${mins % 60}분` : ""}` : `${mins}분`);

export default function FreePeriodCalculator() {
  const [rows, setRows] = useState<Row[]>([
    { name: "경영학원론", day: "월", start: "09:00", end: "10:15" },
    { name: "통계학", day: "월", start: "13:30", end: "14:45" },
    { name: "회계원리", day: "화", start: "10:30", end: "11:45" },
    { name: "교양 영어", day: "화", start: "15:00", end: "16:15" },
    { name: "경영학원론", day: "수", start: "09:00", end: "10:15" },
    { name: "통계학", day: "수", start: "13:30", end: "14:45" },
    { name: "회계원리", day: "목", start: "10:30", end: "11:45" },
  ]);
  const [minGap, setMinGap] = useState("60");

  const r = analyzeTimetable(
    rows.map((x) => ({ name: x.name, day: x.day, start: toMinutes(x.start), end: toMinutes(x.end) })),
    Number(minGap)
  );
  const set = (k: number, patch: Partial<Row>) => setRows((rs) => rs.map((x, i) => (i === k ? { ...x, ...patch } : x)));
  const bad = rows.filter((x) => !(toMinutes(x.end) > toMinutes(x.start))).length;

  return (
    <div className="calc">
      <p className="note-sm">시각은 24시간 형식으로 넣어 주세요. 예: 오후 1시 30분 → 13:30</p>
      <div className="rowlist cols4" role="table" aria-label="시간표">
        <div className="rowlist-head" role="row"><span>과목</span><span>요일</span><span>시작</span><span>끝</span><span /></div>
        {rows.map((x, k) => (
          <div className="rowlist-row" role="row" key={k}>
            <input aria-label="과목" value={x.name} maxLength={20} onChange={(e) => set(k, { name: e.target.value })} />
            <select aria-label="요일" value={x.day} onChange={(e) => set(k, { day: e.target.value as Day })}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <input aria-label="시작 시각 (24시간, 예: 13:30)" inputMode="numeric" placeholder="13:30" maxLength={5} value={x.start} onChange={(e) => set(k, { start: e.target.value.replace(/[^0-9:]/g, "") })} />
            <input aria-label="끝 시각 (24시간, 예: 13:30)" inputMode="numeric" placeholder="13:30" maxLength={5} value={x.end} onChange={(e) => set(k, { end: e.target.value.replace(/[^0-9:]/g, "") })} />
            <button type="button" className="link" aria-label={`${x.name || "수업"} 삭제`} onClick={() => setRows((rs) => rs.filter((_, i) => i !== k))}>삭제</button>
          </div>
        ))}
      </div>
      {rows.length < 40 && (
        <button type="button" className="btn sm" onClick={() => setRows((rs) => [...rs, { name: "", day: "월", start: "09:00", end: "10:15" }])}>+ 수업 추가</button>
      )}
      <div className="fields" style={{ marginTop: 16 }}>
        <label>공강으로 볼 최소 시간
          <select value={minGap} onChange={(e) => setMinGap(e.target.value)}>
            <option value="30">30분 이상</option>
            <option value="60">1시간 이상</option>
            <option value="90">1시간 30분 이상</option>
            <option value="120">2시간 이상</option>
          </select>
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>한 주 공강 시간 합계</span>
          <strong>{hm(r.weeklyGapMinutes)}</strong>
          <small>수업 {hm(r.weeklyClassMinutes)} · 수업 없는 날 {r.freeDays.length ? r.freeDays.join("·") : "없음"}</small>
        </div>
        {bad > 0 && <p className="warn">시각을 읽을 수 없거나 끝 시각이 시작 시각보다 빠른 수업 {bad}개는 계산에서 뺐습니다. 시각은 24시간 형식(예: 13:30)으로 넣어 주세요.</p>}
        <div className="scroll">
          <table>
            <thead><tr><th>요일</th><td>첫 수업</td><td>마지막 수업</td><td>학교에 있는 시간</td><td>공강</td></tr></thead>
            <tbody>
              {r.days.map((d) => (
                <tr key={d.day}>
                  <th>{d.day}{d.overlap ? " ⚠" : ""}</th>
                  <td>{d.first !== null ? fmt(d.first) : "-"}</td>
                  <td>{d.last !== null ? fmt(d.last) : "-"}</td>
                  <td>{d.stay ? hm(d.stay) : "-"}</td>
                  <td>{d.gaps.length ? d.gaps.map((g) => `${fmt(g.start)}~${fmt(g.end)} (${hm(g.minutes)})`).join(", ") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.days.some((d) => d.overlap) && <p className="note-sm">⚠ 표시는 시간이 겹치는 수업이 있는 요일입니다. 겹친 시간은 한 번만 셉니다.</p>}
      </div>
    </div>
  );
}
