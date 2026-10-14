"use client";
import { useState } from "react";
import Link from "next/link";
import { oddEven, parseNumbers, sum, type DrawLite } from "@/lib/lotto";
import LottoBalls from "@/components/LottoBalls";

const PER_PAGE = 20;

// 전체 회차 목록. 최신 회차부터 보여 주고, 회차 번호나 포함 번호로 찾을 수 있습니다.
export default function LottoHistory({ draws }: { draws: DrawLite[] }) {
  const [mode, setMode] = useState<"no" | "nums">("no");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const desc = [...draws].reverse();
  const nums = mode === "nums" ? parseNumbers(q).slice(0, 6) : [];
  const no = mode === "no" ? Number(q.replace(/\D/g, "")) : 0;
  const list = nums.length
    ? desc.filter(([, , ns]) => nums.every((n) => ns.includes(n)))
    : no
      ? desc.filter(([d]) => String(d).startsWith(String(no)))
      : desc;
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(page, pages - 1);
  const rows = list.slice(cur * PER_PAGE, (cur + 1) * PER_PAGE);

  return (
    <div className="calc">
      <div className="seg" role="group" aria-label="찾는 방법">
        <button type="button" aria-pressed={mode === "no"} onClick={() => { setMode("no"); setQ(""); setPage(0); }}>회차로 찾기</button>
        <button type="button" aria-pressed={mode === "nums"} onClick={() => { setMode("nums"); setQ(""); setPage(0); }}>번호로 찾기</button>
      </div>
      <label>
        {mode === "no" ? "회차 번호" : "포함된 번호 (여러 개면 모두 포함된 회차)"}
        <input
          inputMode="numeric"
          placeholder={mode === "no" ? `예: ${draws[draws.length - 1][0]}` : "예: 7, 27"}
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
        />
      </label>

      <p className="note-sm">{list.length.toLocaleString("ko-KR")}개 회차</p>
      <div className="scroll">
        <table className="draws">
          <thead><tr><th>회차</th><th>추첨일</th><th>당첨번호 + 보너스</th><td>홀:짝</td><td>합계</td></tr></thead>
          <tbody>
            {rows.map(([d, date, ns, b]) => (
              <tr key={d}>
                <th><Link href={`/lotto/${d}`}>{d}회</Link></th>
                <th>{date}</th>
                <th><LottoBalls nums={ns} bonus={b} size="sm" /></th>
                <td>{oddEven(ns)}</td>
                <td>{sum(ns)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="pager">
          <button type="button" className="btn sm ghost" disabled={cur === 0} onClick={() => setPage(cur - 1)}>이전</button>
          <span>{cur + 1} / {pages}</span>
          <button type="button" className="btn sm ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>다음</button>
        </div>
      )}
    </div>
  );
}
