"use client";
import { useState } from "react";
import { calcYearEndTax, calcCardDeduction } from "@/lib/calculators/yearEndTax";
import { num, won } from "@/lib/format";
import { RATES } from "@/data/rates/2026";

// 금액 입력은 만 원 단위, 이미 낸 세금만 원천징수영수증 그대로 원 단위로 받습니다.
const man = (v: string) => Math.round(num(v) * 10_000);
const count = (v: string, max = 10) => Math.min(num(v), max);

const amountFields = {
  card: [
    ["credit", "신용카드"],
    ["debit", "체크카드·현금영수증"],
    ["market", "전통시장"],
    ["transit", "대중교통"],
    ["culture", "도서·공연·체육시설 등"],
  ],
  credit: [
    ["insurance", "보장성 보험료"],
    ["medicalSelf", "의료비: 본인·65세 이상·장애인"],
    ["medicalOther", "의료비: 그 밖의 가족"],
    ["education", "교육비 (공제 대상 금액)"],
    ["donation", "기부금"],
    ["pensionSavings", "연금저축 납입액"],
    ["irp", "IRP 납입액"],
    ["annualRent", "1년 동안 낸 월세"],
  ],
} as const;

type AmountKey = (typeof amountFields)["card" | "credit"][number][0];

export default function YearEndTaxCalculator() {
  const [salaryMan, setSalaryMan] = useState("5000");
  const [withheld, setWithheld] = useState("");
  const [dependents, setDependents] = useState("1");
  const [seniors, setSeniors] = useState("0");
  const [disabled, setDisabled] = useState("0");
  const [children, setChildren] = useState("0");
  const [childrenOver8, setChildrenOver8] = useState("0");
  const [birthOrder, setBirthOrder] = useState<0 | 1 | 2 | 3>(0);
  const [married, setMarried] = useState(false);
  const [amounts, setAmounts] = useState<Record<AmountKey, string>>({
    credit: "1500", debit: "500", market: "0", transit: "60", culture: "0",
    insurance: "0", medicalSelf: "0", medicalOther: "0", education: "0", donation: "0",
    pensionSavings: "0", irp: "0", annualRent: "0",
  });
  const set = (k: AmountKey, v: string) => setAmounts((a) => ({ ...a, [k]: v }));

  const gross = man(salaryMan);
  const card = {
    credit: man(amounts.credit), debit: man(amounts.debit), market: man(amounts.market),
    transit: man(amounts.transit), culture: man(amounts.culture),
  };
  const r = calcYearEndTax({
    totalSalary: gross,
    withheld: withheld.trim() === "" ? undefined : num(withheld),
    dependents: Math.max(count(dependents, 11), 1),
    seniors: count(seniors),
    disabled: count(disabled),
    children: count(children),
    childrenOver8: Math.min(count(childrenOver8), count(children)),
    birthOrder,
    married,
    card,
    insurance: man(amounts.insurance),
    medicalSelf: man(amounts.medicalSelf),
    medicalOther: man(amounts.medicalOther),
    education: man(amounts.education),
    donation: man(amounts.donation),
    pensionSavings: man(amounts.pensionSavings),
    irp: man(amounts.irp),
    annualRent: man(amounts.annualRent),
  });
  const cardInfo = calcCardDeduction(gross, count(children), card);
  const minSpend = gross * RATES.yearEnd.card.minSpendRate;
  const cardTotal = Object.values(card).reduce((s, v) => s + v, 0);

  return (
    <div className="calc">
      <h3>급여와 이미 낸 세금</h3>
      <div className="fields">
        <label>총급여 (만원, 비과세 제외)
          <input inputMode="numeric" value={salaryMan} onChange={(e) => setSalaryMan(e.target.value)} />
        </label>
        <label>이미 낸 소득세 (원, 비우면 추정)
          <input inputMode="numeric" value={withheld} placeholder="급여명세서 소득세 합계" onChange={(e) => setWithheld(e.target.value)} />
        </label>
      </div>

      <h3 className="sub">부양가족</h3>
      <div className="fields">
        <label>기본공제 인원 (본인 포함)
          <input inputMode="numeric" value={dependents} onChange={(e) => setDependents(e.target.value)} />
        </label>
        <label>그중 70세 이상
          <input inputMode="numeric" value={seniors} onChange={(e) => setSeniors(e.target.value)} />
        </label>
        <label>그중 장애인
          <input inputMode="numeric" value={disabled} onChange={(e) => setDisabled(e.target.value)} />
        </label>
        <label>자녀 수 (기본공제 대상)
          <input inputMode="numeric" value={children} onChange={(e) => setChildren(e.target.value)} />
        </label>
        <label>그중 8세 이상
          <input inputMode="numeric" value={childrenOver8} onChange={(e) => setChildrenOver8(e.target.value)} />
        </label>
        <label>올해 출산·입양
          <select value={birthOrder} onChange={(e) => setBirthOrder(Number(e.target.value) as 0 | 1 | 2 | 3)}>
            <option value={0}>없음</option>
            <option value={1}>첫째</option>
            <option value={2}>둘째</option>
            <option value={3}>셋째 이상</option>
          </select>
        </label>
        <label>올해 혼인신고 (생애 1회)
          <select value={married ? "y" : "n"} onChange={(e) => setMarried(e.target.value === "y")}>
            <option value="n">아니오</option>
            <option value="y">예</option>
          </select>
        </label>
      </div>

      <h3 className="sub">카드 사용액 (만원, 1년 합계)</h3>
      <div className="fields">
        {amountFields.card.map(([k, label]) => (
          <label key={k}>{label}
            <input inputMode="numeric" value={amounts[k]} onChange={(e) => set(k, e.target.value)} />
          </label>
        ))}
      </div>

      <h3 className="sub">세액공제 항목 (만원, 1년 합계)</h3>
      <div className="fields">
        {amountFields.credit.map(([k, label]) => (
          <label key={k}>{label}
            <input inputMode="numeric" value={amounts[k]} onChange={(e) => set(k, e.target.value)} />
          </label>
        ))}
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>{r.refund >= 0 ? "예상 환급액" : "예상 추가 납부액"}</span>
          <strong>{won(Math.abs(r.refund))}</strong>
          <small>소득세와 지방소득세 합계</small>
        </div>
        {r.withheldEstimated && (
          <p className="warn">
            이미 낸 소득세를 비워 두어 간이세액표 기준(100%)으로 약 {won(r.withheld)}을 냈다고 가정했습니다. 급여명세서의 소득세를 더하거나 홈택스 연말정산 간소화에서 확인한 금액을 넣으면 더 정확합니다.
          </p>
        )}
        {cardTotal > 0 && cardTotal <= minSpend && (
          <p className="warn">카드 사용액이 총급여의 25%({won(minSpend)})를 넘지 않아 신용카드 소득공제를 받을 수 없습니다.</p>
        )}
        {cardInfo.total > cardInfo.baseLimit && (
          <p className="warn">카드 공제가 기본한도({won(cardInfo.baseLimit)})를 넘었습니다. 전통시장·대중교통 사용분은 한도를 넘어도 추가로 공제됩니다.</p>
        )}
        {r.usedStandard && (
          <p className="warn">보험료·의료비·교육비·기부금·월세 공제를 받는 것보다 표준세액공제 13만 원이 유리해서 표준세액공제로 계산했습니다.</p>
        )}
        <table>
          <tbody>
            <tr><th>총급여</th><td>{won(gross)}</td></tr>
            <tr><th>근로소득금액 (근로소득공제 후)</th><td>{won(r.earnedIncome)}</td></tr>
            <tr><th>인적공제</th><td>- {won(r.personalDeduction)}</td></tr>
            <tr><th>국민연금 (추정)</th><td>- {won(r.pensionInsurance)}</td></tr>
            {!r.usedStandard && <tr><th>건강·고용보험 (추정)</th><td>- {won(r.socialInsurance)}</td></tr>}
            <tr><th>신용카드 등 소득공제</th><td>- {won(r.cardDeduction)}</td></tr>
            <tr className="sum"><th>과세표준</th><td>{won(r.taxBase)}</td></tr>
            <tr><th>산출세액</th><td>{won(r.calculatedTax)}</td></tr>
            {r.credits.map((c) => (
              <tr key={c.label}><th>{c.label}</th><td>- {won(c.amount)}</td></tr>
            ))}
            <tr className="sum"><th>결정세액 (소득세)</th><td>{won(r.determinedTax)}</td></tr>
            <tr><th>이미 낸 소득세{r.withheldEstimated ? " (추정)" : ""}</th><td>{won(r.withheld)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
