"use client";
import { useState } from "react";
import { calcSavingsGoal } from "@/lib/calculators/savingsGoal";
import type { InterestType } from "@/lib/calculators/savings";
import { RATES } from "@/data/rates/2026";
import { num, won } from "@/lib/format";

export default function SavingsGoalCalculator() {
  const [target, setTarget] = useState("10000000");
  const [months, setMonths] = useState("24");
  const [rate, setRate] = useState("3.5");
  const [interestType, setInterestType] = useState<InterestType>("simple");
  const [taxed, setTaxed] = useState<"normal" | "exempt">("normal");

  const r = calcSavingsGoal(
    num(target),
    Math.min(Math.max(num(months), 1), 600),
    Math.min(num(rate), 100) / 100,
    interestType,
    RATES.interestTax[taxed]
  );

  return (
    <div className="calc">
      <div className="fields">
        <label>목표 금액 (원)
          <input inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label>기간 (개월)
          <input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
        </label>
        <label>적금 금리 (연 %)
          <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label>이자 방식
          <select value={interestType} onChange={(e) => setInterestType(e.target.value as InterestType)}>
            <option value="simple">단리</option>
            <option value="monthlyCompound">월복리</option>
          </select>
        </label>
        <label>과세
          <select value={taxed} onChange={(e) => setTaxed(e.target.value as "normal" | "exempt")}>
            <option value="normal">일반과세 (15.4%)</option>
            <option value="exempt">비과세</option>
          </select>
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>매달 모아야 할 금액</span>
          <strong>{won(r.monthly)}</strong>
          <small>이자 없이 모으면 매달 {won(r.withoutInterest)}</small>
        </div>
        <table>
          <tbody>
            <tr><th>납입 원금 합계</th><td>{won(r.principal)}</td></tr>
            <tr><th>세전 이자</th><td>{won(r.interest)}</td></tr>
            <tr><th>이자소득세</th><td>{won(r.tax)}</td></tr>
            <tr className="sum"><th>만기 세후 수령액</th><td>{won(r.afterTax)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
