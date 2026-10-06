"use client";
import { useState } from "react";
import { pyeongToSqm, sqmToPyeong } from "@/lib/calculators/area";

const parse = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;
const fmt = (n: number) => n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const COMMON = [33, 49, 59, 74, 84, 102, 114, 135];

export default function AreaConverterCalculator() {
  const [pyeong, setPyeong] = useState("25");
  const [sqm, setSqm] = useState(fmt(pyeongToSqm(25)));

  return (
    <div className="calc">
      <div className="fields">
        <label>평
          <input
            inputMode="decimal"
            value={pyeong}
            onChange={(e) => {
              setPyeong(e.target.value);
              setSqm(fmt(pyeongToSqm(parse(e.target.value))));
            }}
          />
        </label>
        <label>제곱미터 (㎡)
          <input
            inputMode="decimal"
            value={sqm}
            onChange={(e) => {
              setSqm(e.target.value);
              setPyeong(fmt(sqmToPyeong(parse(e.target.value))));
            }}
          />
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>{fmt(parse(pyeong))}평은</span>
          <strong>{fmt(pyeongToSqm(parse(pyeong)))}㎡</strong>
          <small>1평 ≒ 3.3058㎡ · 1㎡ ≒ 0.3025평</small>
        </div>
        <table>
          <thead><tr><th>자주 보는 면적</th><td>평 환산</td></tr></thead>
          <tbody>
            {COMMON.map((m) => (
              <tr key={m}><th>{m}㎡</th><td>{fmt(sqmToPyeong(m))}평</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
