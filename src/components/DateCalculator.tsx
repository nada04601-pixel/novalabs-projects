"use client";
import { useEffect, useState } from "react";
import { formatDate, parseDate, todayKST } from "@/lib/calculators/date";
import { addDays, diffDays, WEEKDAYS } from "@/lib/calculators/dateDiff";

const show = (d: Date) => `${formatDate(d).replaceAll("-", ".")} (${WEEKDAYS[d.getUTCDay()]})`;

export default function DateCalculator() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("2026-12-25");
  const [includeStart, setIncludeStart] = useState(false);
  const [base, setBase] = useState("");
  const [n, setN] = useState("100");
  const [dir, setDir] = useState<"after" | "before">("after");
  const [day1, setDay1] = useState(true);

  // 정적 HTML에 빌드 날짜가 박히지 않도록 마운트 후 오늘 날짜를 채웁니다.
  useEffect(() => {
    const t = todayKST();
    setStart(t);
    setBase(t);
  }, []);

  const s = parseDate(start);
  const e = parseDate(end);
  const diff = s && e ? diffDays(s, e, includeStart) : null;
  const b = parseDate(base);
  const count = Math.min(Math.floor(Number(n.replace(/[^0-9]/g, "")) || 0), 100_000);
  const target = b ? addDays(b, dir === "after" ? count : -count, day1) : null;

  return (
    <div className="calc">
      <h3>두 날짜 사이 (D-day)</h3>
      <div className="fields">
        <label>시작일
          <input type="date" value={start} onChange={(ev) => setStart(ev.target.value)} />
        </label>
        <label>종료일
          <input type="date" value={end} onChange={(ev) => setEnd(ev.target.value)} />
        </label>
        <label>시작일 포함
          <select value={includeStart ? "y" : "n"} onChange={(ev) => setIncludeStart(ev.target.value === "y")}>
            <option value="n">포함하지 않음 (D-day 방식)</option>
            <option value="y">포함 (기간·근무일수 방식)</option>
          </select>
        </label>
      </div>
      <div className="result" aria-live="polite">
        <div className="big">
          <span>{diff === null ? "날짜를 입력하세요" : includeStart ? "기간 (시작일 포함)" : diff >= 0 ? "종료일까지 남은 날" : "종료일로부터 지난 날"}</span>
          <strong>
            {diff === null ? "-" : includeStart ? `${Math.abs(diff).toLocaleString("ko-KR")}일` : diff === 0 ? "D-day" : diff > 0 ? `D-${diff.toLocaleString("ko-KR")}` : `D+${(-diff).toLocaleString("ko-KR")}`}
          </strong>
          {diff !== null && <small>약 {(Math.abs(diff) / 7).toFixed(1)}주 · {(Math.abs(diff) / 30.44).toFixed(1)}개월</small>}
        </div>
      </div>

      <h3>기준일로부터 며칠 뒤·전</h3>
      <div className="fields">
        <label>기준일
          <input type="date" value={base} onChange={(ev) => setBase(ev.target.value)} />
        </label>
        <label>일수
          <input inputMode="numeric" value={n} onChange={(ev) => setN(ev.target.value)} />
        </label>
        <label>방향
          <select value={dir} onChange={(ev) => setDir(ev.target.value as "after" | "before")}>
            <option value="after">뒤</option>
            <option value="before">전</option>
          </select>
        </label>
        <label>세는 방법
          <select value={day1 ? "y" : "n"} onChange={(ev) => setDay1(ev.target.value === "y")}>
            <option value="y">기준일을 1일째로 (기념일 방식)</option>
            <option value="n">기준일 다음 날부터 (날짜 더하기)</option>
          </select>
        </label>
      </div>
      <div className="result" aria-live="polite">
        <table>
          <tbody>
            <tr className="sum"><th>{count.toLocaleString("ko-KR")}일 {dir === "after" ? "뒤" : "전"}</th><td>{target ? show(target) : "-"}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
