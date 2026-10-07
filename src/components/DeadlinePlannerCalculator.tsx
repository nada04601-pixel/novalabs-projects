"use client";
import { useEffect, useState } from "react";
import { backwardPlan } from "@/lib/calculators/planner";
import { formatDate, parseDate, todayKST } from "@/lib/calculators/date";
import { addDays, WEEKDAYS } from "@/lib/calculators/dateDiff";
import { num } from "@/lib/format";
import CopyButton from "@/components/CopyButton";

type Row = { title: string; days: string };
const label = (s: string) => {
  const d = parseDate(s);
  return d ? `${s.slice(5).replace("-", "/")}(${WEEKDAYS[d.getUTCDay()]})` : s;
};

export default function DeadlinePlannerCalculator() {
  const [deadline, setDeadline] = useState("");
  const [today, setToday] = useState("");
  const [skip, setSkip] = useState(true);
  const [rows, setRows] = useState<Row[]>([
    { title: "자료 조사", days: "3" },
    { title: "초안 작성", days: "4" },
    { title: "검토·수정", days: "2" },
    { title: "최종 확인·제출", days: "1" },
  ]);

  // 기본 마감일은 방문한 날로부터 3주 뒤로 채웁니다(정적 HTML에 빌드 날짜가 박히지 않도록 마운트 후 설정).
  useEffect(() => {
    const t = todayKST();
    setToday(t);
    setDeadline(formatDate(addDays(parseDate(t)!, 21, false)));
  }, []);

  const d = parseDate(deadline);
  const r = d ? backwardPlan(d, rows.map((x) => ({ title: x.title || "단계", days: Math.min(num(x.days) || 1, 60) })), skip) : null;
  const late = r && today && r.startBy < today;
  const set = (k: number, patch: Partial<Row>) => setRows((rs) => rs.map((x, i) => (i === k ? { ...x, ...patch } : x)));
  const text = () => (r ? [`마감 ${label(deadline)} 역산 일정`, ...r.rows.map((x) => `□ ${label(x.start)}~${label(x.end)} ${x.title}`)].join("\n") : "");

  return (
    <div className="calc">
      <div className="fields">
        <label>마감일
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <label>주말
          <select value={skip ? "skip" : "keep"} onChange={(e) => setSkip(e.target.value === "skip")}>
            <option value="skip">주말 빼고 계산 (평일만 작업)</option>
            <option value="keep">주말 포함</option>
          </select>
        </label>
      </div>
      <h3 style={{ marginTop: 18 }}>단계 (먼저 할 일부터)</h3>
      <div className="rowlist cols2" role="table" aria-label="작업 단계">
        <div className="rowlist-head" role="row"><span>단계</span><span>필요 일수</span><span /></div>
        {rows.map((x, k) => (
          <div className="rowlist-row" role="row" key={k}>
            <input aria-label="단계" value={x.title} maxLength={40} onChange={(e) => set(k, { title: e.target.value })} />
            <input aria-label="필요 일수" inputMode="numeric" value={x.days} onChange={(e) => set(k, { days: e.target.value })} />
            <button type="button" className="link" aria-label={`${x.title || "단계"} 삭제`} onClick={() => setRows((rs) => rs.filter((_, i) => i !== k))}>삭제</button>
          </div>
        ))}
      </div>
      {rows.length < 15 && <button type="button" className="btn sm" onClick={() => setRows((rs) => [...rs, { title: "", days: "1" }])}>+ 단계 추가</button>}

      <div className="result" aria-live="polite">
        {r ? (
          <>
            <div className="big">
              <span>늦어도 이날 시작</span>
              <strong>{label(r.startBy)}</strong>
              <small>마감 {label(deadline)}{skip ? " · 평일 기준" : ""}</small>
            </div>
            {late && <p className="warn">시작해야 할 날이 이미 지났습니다. 단계별 일수를 줄이거나 마감일을 다시 협의해 보세요.</p>}
            <table>
              <tbody>
                {r.rows.map((x, i) => (
                  <tr key={i}><th>{x.title}</th><td>{label(x.start)}{x.start !== x.end ? ` ~ ${label(x.end)}` : ""} ({x.days}일)</td></tr>
                ))}
              </tbody>
            </table>
            <div className="actions"><CopyButton text={text} label="체크리스트 복사" /></div>
          </>
        ) : (
          <p className="warn">마감일을 선택해 주세요.</p>
        )}
      </div>
    </div>
  );
}
