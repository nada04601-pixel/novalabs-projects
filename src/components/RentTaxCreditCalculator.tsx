"use client";
import { useState } from "react";
import { calcRentTaxCredit, RENT_CREDIT } from "@/lib/calculators/rentTaxCredit";
import { calcNetSalary } from "@/lib/calculators/netSalary";
import { num, won } from "@/lib/format";

export default function RentTaxCreditCalculator() {
  const [salary, setSalary] = useState("40000000");
  const [rent, setRent] = useState("500000");
  const [months, setMonths] = useState("12");

  const total = num(salary);
  const r = calcRentTaxCredit(total, num(rent), Math.min(num(months), 12));
  // 연봉 실수령액 계산기와 같은 방식으로 1년 소득세를 대략 추정합니다(본인 1명, 다른 공제 없음).
  const estTax = calcNetSalary({ annualSalary: total, monthlyNonTaxable: 0, dependents: 1, children: 0 }).incomeTax * 12;

  return (
    <div className="calc">
      <div className="fields">
        <label>총급여 (연, 비과세 제외)
          <input inputMode="numeric" value={salary} onChange={(e) => setSalary(e.target.value)} />
        </label>
        <label>월세 (원)
          <input inputMode="numeric" value={rent} onChange={(e) => setRent(e.target.value)} />
        </label>
        <label>그해 낸 개월 수
          <input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>월세 세액공제 (소득세)</span>
          <strong>{won(r.credit)}</strong>
          <small>지방소득세 {won(r.localTaxCredit)} 추가 감소</small>
        </div>
        {!r.eligible && total > 0 && (
          <p className="warn">총급여가 {(RENT_CREDIT.incomeLimit / 10_000).toLocaleString("ko-KR")}만 원을 넘으면 월세 세액공제를 받을 수 없습니다.</p>
        )}
        {r.eligible && r.credit > estTax && (
          <p className="warn">
            추정한 1년 소득세(약 {won(estTax)})보다 공제액이 커서 전액을 돌려받지 못할 수 있습니다. 세액공제는 낼 세금이 있어야 적용됩니다.
          </p>
        )}
        <table>
          <tbody>
            <tr><th>낸 월세 합계</th><td>{won(r.paid)}</td></tr>
            <tr><th>공제 대상 월세 (연 1,000만 원 한도)</th><td>{won(r.base)}</td></tr>
            <tr><th>공제율</th><td>{r.eligible ? `${Math.round(r.rate * 100)}%` : "-"}</td></tr>
            <tr className="sum"><th>소득세 + 지방소득세 감소액</th><td>{won(r.credit + r.localTaxCredit)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
