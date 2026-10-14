"use client";
import { useState } from "react";
import { ballTone } from "@/lib/lotto";

type Range = { label: string; freq: number[] };

// 구간별 번호 출현 횟수. 많이 나온 번호부터 보여 줍니다.
export default function LottoFrequency({ ranges }: { ranges: Range[] }) {
  const [i, setI] = useState(0);
  const f = ranges[i].freq;
  const order = f.map((c, n) => [n, c]).slice(1).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const top = order[0][1] || 1;
  return (
    <div className="calc">
      <div className="seg" role="group" aria-label="집계 구간">
        {ranges.map((r, k) => (
          <button key={r.label} type="button" aria-pressed={i === k} onClick={() => setI(k)}>{r.label}</button>
        ))}
      </div>
      <ol className="freq">
        {order.map(([n, c]) => (
          <li key={n}>
            <span className={`ball sm t${ballTone(n)}`}>{n}</span>
            <span className="bar" aria-hidden="true"><i style={{ width: `${(c / top) * 100}%` }} /></span>
            <span className="cnt">{c}회</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
