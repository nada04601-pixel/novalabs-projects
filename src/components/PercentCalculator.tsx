"use client";
import { useState } from "react";
import { changePercent, percentOf, ratioPercent } from "@/lib/calculators/percent";

// 음수와 소수를 받기 위해 숫자 변환을 따로 둡니다.
const toNum = (v: string) => {
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() === "" || Number.isNaN(n) ? NaN : n;
};
const show = (n: number, digits = 2) =>
  Number.isFinite(n) ? n.toLocaleString("ko-KR", { maximumFractionDigits: digits }) : "-";

export default function PercentCalculator() {
  const [a1, setA1] = useState("50000");
  const [b1, setB1] = useState("15");
  const [a2, setA2] = useState("30");
  const [b2, setB2] = useState("120");
  const [a3, setA3] = useState("2500000");
  const [b3, setB3] = useState("2750000");

  const change = changePercent(toNum(a3), toNum(b3));

  return (
    <div className="calc">
      <h3>A의 B%는 얼마일까</h3>
      <div className="fields">
        <label>A (전체 값)
          <input inputMode="decimal" value={a1} onChange={(e) => setA1(e.target.value)} />
        </label>
        <label>B (%)
          <input inputMode="decimal" value={b1} onChange={(e) => setB1(e.target.value)} />
        </label>
      </div>
      <div className="result" aria-live="polite">
        <table>
          <tbody>
            <tr className="sum"><th>{show(toNum(a1))}의 {show(toNum(b1))}%</th><td>{show(percentOf(toNum(a1), toNum(b1)))}</td></tr>
            <tr><th>{show(toNum(b1))}% 할인한 값</th><td>{show(toNum(a1) - percentOf(toNum(a1), toNum(b1)))}</td></tr>
            <tr><th>{show(toNum(b1))}% 더한 값</th><td>{show(toNum(a1) + percentOf(toNum(a1), toNum(b1)))}</td></tr>
          </tbody>
        </table>
      </div>

      <h3>A는 B의 몇 %일까</h3>
      <div className="fields">
        <label>A (부분 값)
          <input inputMode="decimal" value={a2} onChange={(e) => setA2(e.target.value)} />
        </label>
        <label>B (전체 값)
          <input inputMode="decimal" value={b2} onChange={(e) => setB2(e.target.value)} />
        </label>
      </div>
      <div className="result" aria-live="polite">
        <table>
          <tbody>
            <tr className="sum"><th>{show(toNum(a2))}은(는) {show(toNum(b2))}의</th><td>{show(ratioPercent(toNum(a2), toNum(b2)))}%</td></tr>
          </tbody>
        </table>
      </div>

      <h3>A에서 B로 몇 % 바뀌었을까</h3>
      <div className="fields">
        <label>A (이전 값)
          <input inputMode="decimal" value={a3} onChange={(e) => setA3(e.target.value)} />
        </label>
        <label>B (이후 값)
          <input inputMode="decimal" value={b3} onChange={(e) => setB3(e.target.value)} />
        </label>
      </div>
      <div className="result" aria-live="polite">
        <table>
          <tbody>
            <tr className="sum">
              <th>증감률</th>
              <td>{Number.isFinite(change) ? `${change > 0 ? "+" : ""}${show(change)}% ${change > 0 ? "증가" : change < 0 ? "감소" : ""}` : "-"}</td>
            </tr>
            <tr><th>차이</th><td>{show(toNum(b3) - toNum(a3))}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
