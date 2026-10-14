"use client";
import { useState } from "react";
import Link from "next/link";
import { checkHistory, parseNumbers, PICK, RANK_RULES, type DrawLite } from "@/lib/lotto";
import LottoBalls from "@/components/LottoBalls";

// 내 번호 6개로 1회부터 최신 회차까지 모두 맞춰 봅니다.
export default function LottoChecker({ draws }: { draws: DrawLite[] }) {
  const [text, setText] = useState("");
  const mine = parseNumbers(text).slice(0, PICK).sort((a, b) => a - b);
  const ready = mine.length === PICK;
  const res = ready ? checkHistory(mine, draws) : null;

  return (
    <div className="calc">
      <label>내 번호 6개 (쉼표나 띄어쓰기로 구분)
        <input inputMode="numeric" placeholder="예: 3, 11, 17, 25, 34, 42" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {mine.length > 0 && <div className="result-balls"><LottoBalls nums={mine} size="sm" /></div>}
      {!ready && mine.length > 0 && <p className="note-sm">1~45 사이 번호를 {PICK - mine.length}개 더 입력하세요.</p>}

      {res && (
        <div className="result" aria-live="polite">
          <table>
            <thead><tr><th>등수</th><th>기준</th><td>당첨 횟수</td></tr></thead>
            <tbody>
              {RANK_RULES.map((rule, i) => (
                <tr key={rule}><th>{i + 1}등</th><th>{rule}</th><td>{res.counts[i + 1]}회</td></tr>
              ))}
              <tr className="sum"><th>합계</th><th>전체 {draws.length.toLocaleString("ko-KR")}회 중</th><td>{res.counts.slice(1).reduce((a, b) => a + b, 0)}회</td></tr>
            </tbody>
          </table>
          {res.best.length > 0 && (
            <p className="note-sm">
              3등 이상:{" "}
              {res.best.slice(0, 10).map((b, i) => (
                <span key={b.no}>{i > 0 && ", "}<Link href={`/lotto/${b.no}`}>{b.no}회 {b.rank}등</Link></span>
              ))}
              {res.best.length > 10 && ` 외 ${res.best.length - 10}회`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
