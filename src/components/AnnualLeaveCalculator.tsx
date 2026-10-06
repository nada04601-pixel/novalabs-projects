"use client";
import { useEffect, useState } from "react";
import { calcAnnualLeave, calcLeaveAllowance } from "@/lib/calculators/annualLeave";
import { formatDate, parseDate, todayKST } from "@/lib/calculators/date";
import { num, won } from "@/lib/format";

export default function AnnualLeaveCalculator() {
  const [join, setJoin] = useState("2024-03-02");
  const [ref, setRef] = useState("");
  const [wage, setWage] = useState("3000000");
  const [dailyHours, setDailyHours] = useState("8");
  const [unused, setUnused] = useState("5");

  // 기준일은 방문한 날(한국 시간)로 채웁니다. 정적 HTML에 빌드 날짜가 박히지 않도록 마운트 후 설정합니다.
  useEffect(() => setRef(todayKST()), []);

  const joinDate = parseDate(join);
  const refDate = parseDate(ref);
  const r = joinDate && refDate ? calcAnnualLeave(joinDate, refDate) : null;
  const hours = Math.min(num(dailyHours), 8);
  const a = calcLeaveAllowance(num(wage), 209, hours, Math.min(num(unused), 25));

  return (
    <div className="calc">
      <div className="fields">
        <label>입사일
          <input type="date" value={join} onChange={(e) => setJoin(e.target.value)} />
        </label>
        <label>기준일
          <input type="date" value={ref} onChange={(e) => setRef(e.target.value)} />
        </label>
        <label>월 통상임금 (원)
          <input inputMode="numeric" value={wage} onChange={(e) => setWage(e.target.value)} />
        </label>
        <label>하루 소정근로시간
          <input inputMode="decimal" value={dailyHours} onChange={(e) => setDailyHours(e.target.value)} />
        </label>
        <label>남은 연차 일수
          <input inputMode="decimal" value={unused} onChange={(e) => setUnused(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        {r && refDate && joinDate && refDate >= joinDate ? (
          <>
            <div className="big">
              <span>{r.years < 1 ? "입사 첫해 지금까지 생긴 연차" : `근속 ${r.years}년을 채운 뒤 생긴 연차`}</span>
              <strong>{r.currentLeave}일</strong>
              <small>
                다음 연차: {r.nextGrantDate ? formatDate(r.nextGrantDate) : "-"}에 {r.nextGrantDays}일
              </small>
            </div>
            <table>
              <tbody>
                <tr><th>재직 기간</th><td>{r.years}년 {r.months % 12}개월 ({r.serviceDays.toLocaleString("ko-KR")}일)</td></tr>
                <tr><th>입사 첫해 월 단위 연차</th><td>{r.firstYearLeave}일 (최대 11일)</td></tr>
                <tr><th>1일 통상임금</th><td>{won(a.daily)}</td></tr>
                <tr className="sum"><th>미사용 연차수당 (세전)</th><td>{won(a.allowance)}</td></tr>
              </tbody>
            </table>
          </>
        ) : (
          <p className="warn">입사일과 기준일을 확인해 주세요. 기준일은 입사일 이후여야 합니다.</p>
        )}
      </div>
    </div>
  );
}
