"use client";
import { useState } from "react";
import { calcSocialInsurance, INDUSTRIAL_RATES, STABILITY_RATES, type StabilityKey } from "@/lib/calculators/socialInsurance";
import { num, won } from "@/lib/format";
import { RATES } from "@/data/rates/2026";

const CUSTOM = "custom";

export default function SocialInsuranceCalculator() {
  const [pay, setPay] = useState("3200000");
  const [nonTax, setNonTax] = useState("200000");
  const [stability, setStability] = useState<StabilityKey>("under150");
  const [industry, setIndustry] = useState(INDUSTRIAL_RATES[0].code);
  const [customPermille, setCustomPermille] = useState("8.6");
  const [over60, setOver60] = useState(false);
  const [after65, setAfter65] = useState(false);

  const permille = industry === CUSTOM ? num(customPermille) : INDUSTRIAL_RATES.find((x) => x.code === industry)?.permille ?? 0;
  const r = calcSocialInsurance({
    monthlyPay: num(pay),
    monthlyNonTaxable: num(nonTax),
    stability,
    industrialPermille: Math.min(permille, 200),
    over60,
    hiredAfter65: after65,
  });

  return (
    <div className="calc">
      <div className="fields">
        <label>월 급여 (세전)
          <input inputMode="numeric" value={pay} onChange={(e) => setPay(e.target.value)} />
        </label>
        <label>월 비과세액 (식대 등)
          <input inputMode="numeric" value={nonTax} onChange={(e) => setNonTax(e.target.value)} />
        </label>
        <label>회사 규모 (고용보험 사업주 요율)
          <select value={stability} onChange={(e) => setStability(e.target.value as StabilityKey)}>
            {STABILITY_RATES.map((s) => <option key={s.key} value={s.key}>{s.label} ({(s.rate * 100).toFixed(2)}%)</option>)}
          </select>
        </label>
        <label>업종 (산재보험료율)
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
            {INDUSTRIAL_RATES.map((x) => <option key={x.code} value={x.code}>{x.label} ({x.permille}/1,000)</option>)}
            <option value={CUSTOM}>직접 입력</option>
          </select>
        </label>
        {industry === CUSTOM && (
          <label>산재보험료율 (천분율, 예: 8.6)
            <input inputMode="decimal" value={customPermille} onChange={(e) => setCustomPermille(e.target.value)} />
          </label>
        )}
      </div>
      <div className="checks">
        <label className="check">
          <input type="checkbox" checked={over60} onChange={(e) => setOver60(e.target.checked)} />
          만 60세 이상 (국민연금 제외)
        </label>
        <label className="check">
          <input type="checkbox" checked={after65} onChange={(e) => setAfter65(e.target.checked)} />
          만 65세 이후 새로 입사 (실업급여 보험료 제외)
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>한 달 4대보험료 합계 (근로자 + 회사)</span>
          <strong>{won(r.total)}</strong>
          <small>근로자 {won(r.employeeTotal)} · 회사 {won(r.employerTotal)}</small>
        </div>
        {r.base > 0 && r.base < RATES.pension.minBase && !over60 && (
          <p className="note-sm">국민연금은 기준소득월액 하한 {won(r.pensionBase)}을 기준으로 계산했습니다.</p>
        )}
        {r.base > r.pensionBase && !over60 && (
          <p className="note-sm">국민연금은 기준소득월액 상한 {won(r.pensionBase)}까지만 보험료를 매깁니다.</p>
        )}
        <div className="scroll">
          <table>
            <thead>
              <tr><th>항목</th><td>근로자 부담</td><td>회사 부담</td></tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.key}>
                  <th>{row.label}</th>
                  <td>{row.employee > 0 ? won(row.employee) : "-"}</td>
                  <td>{row.employer > 0 ? won(row.employer) : "-"}</td>
                </tr>
              ))}
              <tr className="sum"><th>합계</th><td>{won(r.employeeTotal)}</td><td>{won(r.employerTotal)}</td></tr>
            </tbody>
          </table>
        </div>
        <table>
          <tbody>
            <tr><th>보험료 기준 월 보수 (세전 − 비과세)</th><td>{won(r.base)}</td></tr>
            <tr><th>월 급여 − 근로자 4대보험 (세금 빼기 전)</th><td>{won(r.takeHomeBeforeTax)}</td></tr>
            <tr className="sum"><th>회사가 쓰는 한 달 인건비 (월 급여 + 회사 부담)</th><td>{won(r.companyCost)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
