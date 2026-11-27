"use client";
import { useState } from "react";
import { calcCarTax, type CarKind } from "@/lib/calculators/carTax";
import { num, won } from "@/lib/format";

const PREPAY_LABEL: Record<number, string> = {
  1: "1월 (16~31일 신청)",
  3: "3월 (16~31일 신청)",
  6: "6월 (16~30일 신청)",
  9: "9월 (16~30일 신청)",
};

export default function CarTaxCalculator() {
  const [kind, setKind] = useState<CarKind>("cc");
  const [cc, setCc] = useState("1998");
  const [regYear, setRegYear] = useState("2022");
  const [regMonth, setRegMonth] = useState("5");
  const [madeYear, setMadeYear] = useState("");
  const [taxYear, setTaxYear] = useState("2026");

  const ty = num(taxYear) || 2026;
  const ry = Math.min(num(regYear) || ty, ty);
  const r = calcCarTax({
    kind,
    cc: Math.min(num(cc), 20_000),
    taxYear: ty,
    regYear: ry,
    regMonth: num(regMonth) || 1,
    madeYear: num(madeYear) || undefined,
  });
  const pctLabel = (v: number) => (v > 0 ? `${Math.round(v * 100)}%` : "없음");

  return (
    <div className="calc">
      <div className="fields">
        <label>차 종류 (자가용 승용차)
          <select value={kind} onChange={(e) => setKind(e.target.value as CarKind)}>
            <option value="cc">휘발유·경유·LPG·하이브리드 (배기량 기준)</option>
            <option value="electric">전기차 (연 10만 원 정액)</option>
          </select>
        </label>
        {kind === "cc" && (
          <label>배기량 (cc)
            <input inputMode="numeric" value={cc} onChange={(e) => setCc(e.target.value)} />
          </label>
        )}
        <label>최초 등록 연도
          <input inputMode="numeric" value={regYear} onChange={(e) => setRegYear(e.target.value)} />
        </label>
        <label>최초 등록 월
          <select value={regMonth} onChange={(e) => setRegMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}월</option>)}
          </select>
        </label>
        <label>제작 연도 (선택: 등록한 해보다 먼저 만든 차)
          <input inputMode="numeric" placeholder="비워 두면 등록 연도" value={madeYear} onChange={(e) => setMadeYear(e.target.value)} />
        </label>
        <label>계산할 연도
          <select value={taxYear} onChange={(e) => setTaxYear(e.target.value)}>
            <option value="2026">2026년</option>
            <option value="2027">2027년</option>
          </select>
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>{ty}년 자동차세 (지방교육세 포함)</span>
          <strong>{won(r.annualTotal)}</strong>
          <small>6월 {won(r.first.total)} · 12월 {won(r.second.total)}</small>
        </div>
        {r.firstYear && (
          <p className="warn">{ty}년에 처음 등록한 차는 등록한 날부터 날짜 수만큼만 부과하므로 실제 세액이 이보다 적습니다. 아래는 1년을 모두 가졌을 때의 금액입니다.</p>
        )}
        {r.lumpSumInJune && (
          <p className="note-sm">연세액이 10만 원 이하라 지자체가 6월에 1년치를 한꺼번에 부과할 수 있습니다(이때 12월분 일부를 공제).</p>
        )}
        <div className="scroll">
          <table>
            <thead>
              <tr><th>구분</th><td>차령</td><td>경감</td><td>자동차세</td><td>지방교육세</td><td>합계</td></tr>
            </thead>
            <tbody>
              <tr><th>1기분 (1~6월분, 6월 납부)</th><td>{r.first.age > 0 ? `${r.first.age}년` : "-"}</td><td>{pctLabel(r.first.reduction)}</td><td>{won(r.first.carTax)}</td><td>{won(r.first.eduTax)}</td><td>{won(r.first.total)}</td></tr>
              <tr><th>2기분 (7~12월분, 12월 납부)</th><td>{`${r.second.age}년`}</td><td>{pctLabel(r.second.reduction)}</td><td>{won(r.second.carTax)}</td><td>{won(r.second.eduTax)}</td><td>{won(r.second.total)}</td></tr>
              <tr className="sum"><th>1년 합계</th><td></td><td></td><td>{won(r.annualCarTax)}</td><td>{won(r.annualEduTax)}</td><td>{won(r.annualTotal)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="note-sm">
          {kind === "cc"
            ? `경감 전 연세액: ${Math.round(num(cc)).toLocaleString("ko-KR")}cc × ${r.perCc}원 = ${won(r.baseAnnual)} · 차령 기산: ${r.baseYear}년 ${r.baseMonth}월`
            : "전기차는 배기량과 관계없이 연 10만 원이고 차령 경감이 없습니다."}
        </p>

        <h3 className="sub">{ty}년 연납(한꺼번에 미리 내기) 하면</h3>
        <div className="scroll">
          <table>
            <thead>
              <tr><th>신청 시기</th><td>공제 기준</td><td>공제액</td><td>그때 낼 금액 (교육세 포함)</td></tr>
            </thead>
            <tbody>
              {r.prepay.map((p) => (
                <tr key={p.month} className={p.month === 1 ? "sum" : undefined}>
                  <th>{PREPAY_LABEL[p.month]}</th>
                  <td>{p.month <= 3 ? "1년 세액" : "12월분 세액"}</td>
                  <td>{won((p.month <= 3 ? r.annualTotal : r.second.total) - p.total)}</td>
                  <td>{won(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note-sm">공제액은 위 표의 합계(1·3월은 1년 합계, 6·9월은 12월분)에서 연납 때 낼 금액을 뺀 것으로, 지방교육세가 함께 줄어드는 몫을 포함합니다. 지자체 고지서의 끝수 처리에 따라 10원 안팎 다를 수 있습니다. 6월·9월 연납은 1~6월분을 6월 정기분으로 따로 내고, 표의 금액은 7~12월분만 미리 내는 금액입니다.</p>
      </div>
    </div>
  );
}
