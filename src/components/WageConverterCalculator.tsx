"use client";
import { useState } from "react";
import { convertWage, type WageBasis } from "@/lib/calculators/wageConvert";
import { RATES } from "@/data/rates/2026";
import { num, won } from "@/lib/format";

const LABEL: Record<WageBasis, string> = { hourly: "시급", monthly: "월급", annual: "연봉" };

export default function WageConverterCalculator() {
  const [basis, setBasis] = useState<WageBasis>("hourly");
  const [amount, setAmount] = useState(String(RATES.minimumWage));
  const [weekly, setWeekly] = useState("40");

  const weeklyHours = Math.min(num(weekly), 40);
  const r = convertWage(basis, num(amount), weeklyHours);
  const belowMinimum = r.hourly > 0 && r.hourly < RATES.minimumWage;

  return (
    <div className="calc">
      <div className="fields">
        <label>입력할 기준
          <select value={basis} onChange={(e) => setBasis(e.target.value as WageBasis)}>
            <option value="hourly">시급</option>
            <option value="monthly">월급</option>
            <option value="annual">연봉</option>
          </select>
        </label>
        <label>{LABEL[basis]} (원, 세전)
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>주 소정근로시간 (최대 40)
          <input inputMode="decimal" value={weekly} onChange={(e) => setWeekly(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>{basis === "annual" ? "월급 (세전)" : "연봉 (세전)"}</span>
          <strong>{won(basis === "annual" ? r.monthly : r.annual)}</strong>
          <small>월 환산 {r.hours.toFixed(1)}시간 기준</small>
        </div>
        {belowMinimum && (
          <p className="warn">시급으로 환산하면 {RATES.year}년 최저시급 {won(RATES.minimumWage)}보다 낮습니다.</p>
        )}
        <table>
          <tbody>
            <tr><th>시급</th><td>{won(r.hourly)}</td></tr>
            <tr><th>일급 (하루 8시간)</th><td>{won(r.hourly * 8)}</td></tr>
            <tr><th>월급</th><td>{won(r.monthly)}</td></tr>
            <tr className="sum"><th>연봉</th><td>{won(r.annual)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
