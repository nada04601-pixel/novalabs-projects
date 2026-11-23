"use client";
import { useMemo, useState } from "react";
import { calcSeverance } from "@/lib/calculators/severance";
import { num, won } from "@/lib/format";

export default function SeveranceCalculator() {
  const [start, setStart] = useState("2022-03-02");
  const [end, setEnd] = useState("2026-10-01");
  const [wage, setWage] = useState("10500000");
  const [bonus, setBonus] = useState("3000000");
  const [leave, setLeave] = useState("0");
  // 월 통상임금은 비워 두면 평균임금만으로 계산합니다.
  const [ordinary, setOrdinary] = useState("");

  const r = useMemo(
    () =>
      calcSeverance({
        startDate: start,
        endDate: end,
        last3MonthsWage: num(wage),
        annualBonus: num(bonus),
        annualLeavePay: num(leave),
        monthlyOrdinaryWage: num(ordinary),
      }),
    [start, end, wage, bonus, leave, ordinary]
  );

  return (
    <div className="calc">
      <div className="fields">
        <label>입사일
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>퇴직일 (마지막 근무일 다음 날)
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <label>퇴직 전 3개월 임금 총액 (원)
          <input inputMode="numeric" value={wage} onChange={(e) => setWage(e.target.value)} />
        </label>
        <label>직전 1년 상여금 총액 (원)
          <input inputMode="numeric" value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </label>
        <label>직전 1년 연차수당 (원)
          <input inputMode="numeric" value={leave} onChange={(e) => setLeave(e.target.value)} />
        </label>
        <label>월 통상임금 (선택: 기본급 + 매달 고정 수당)
          <input inputMode="numeric" placeholder="예: 3500000" value={ordinary} onChange={(e) => setOrdinary(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        {!r ? (
          <p className="warn">퇴직일은 입사일보다 뒤여야 합니다.</p>
        ) : (
          <>
            <div className="big">
              <span>예상 퇴직금 (세전)</span>
              <strong>{won(r.severancePay)}</strong>
              <small>재직 {r.serviceDays.toLocaleString("ko-KR")}일</small>
            </div>
            {!r.eligible && (
              <p className="warn">재직 기간이 1년 미만이면 법정 퇴직금 지급 대상이 아닙니다. 참고용으로만 보세요.</p>
            )}
            {r.usesOrdinary && (
              <p className="warn">1일 평균임금이 1일 통상임금보다 적어, 법에 따라 통상임금으로 계산했습니다.</p>
            )}
            {r.ordinaryDailyWage === 0 && (
              <p className="note-sm">월급이 대부분 기본급과 고정 수당이라면 월 통상임금 칸도 채워 보세요. 통상임금이 평균임금보다 크면 통상임금 기준으로 다시 계산합니다.</p>
            )}
            <table>
              <tbody>
                <tr><th>평균임금 산정 기간</th><td>{r.periodDays}일</td></tr>
                <tr><th>1일 평균임금</th><td>{won(r.averageDailyWage)}</td></tr>
                {r.ordinaryDailyWage > 0 && <tr><th>1일 통상임금 (월 통상임금 ÷ 209 × 8)</th><td>{won(r.ordinaryDailyWage)}</td></tr>}
                <tr className="sum"><th>퇴직금 = 1일 {r.usesOrdinary ? "통상임금" : "평균임금"} × 30 × 재직일수 ÷ 365</th><td>{won(r.severancePay)}</td></tr>
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
