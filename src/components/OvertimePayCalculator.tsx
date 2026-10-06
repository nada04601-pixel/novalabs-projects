"use client";
import { useMemo, useState } from "react";
import { calcOvertime } from "@/lib/calculators/overtime";
import { RATES } from "@/data/rates/2026";
import { num, won } from "@/lib/format";

export default function OvertimePayCalculator() {
  const [wage, setWage] = useState(String(RATES.minimumWage));
  const [overtime, setOvertime] = useState("4");
  const [night, setNight] = useState("1");
  const [holiday, setHoliday] = useState("0");
  const [holidayOver, setHolidayOver] = useState("0");
  const [size, setSize] = useState<"5+" | "under5">("5+");

  const r = useMemo(
    () =>
      calcOvertime({
        hourlyWage: num(wage),
        overtimeHours: Math.min(num(overtime), 744),
        nightHours: Math.min(num(night), 744),
        holidayHours: Math.min(num(holiday), 744),
        holidayOverHours: Math.min(num(holidayOver), 744),
        fiveOrMore: size === "5+",
      }),
    [wage, overtime, night, holiday, holidayOver, size]
  );

  return (
    <div className="calc">
      <div className="fields">
        <label>통상시급 (원)
          <input inputMode="numeric" value={wage} onChange={(e) => setWage(e.target.value)} />
        </label>
        <label>사업장 규모
          <select value={size} onChange={(e) => setSize(e.target.value as "5+" | "under5")}>
            <option value="5+">상시 5인 이상</option>
            <option value="under5">5인 미만</option>
          </select>
        </label>
        <label>연장근로 시간
          <input inputMode="decimal" value={overtime} onChange={(e) => setOvertime(e.target.value)} />
        </label>
        <label>야간근로 시간 (22시~06시)
          <input inputMode="decimal" value={night} onChange={(e) => setNight(e.target.value)} />
        </label>
        <label>휴일근로 시간 (8시간 이내분)
          <input inputMode="decimal" value={holiday} onChange={(e) => setHoliday(e.target.value)} />
        </label>
        <label>휴일근로 시간 (8시간 초과분)
          <input inputMode="decimal" value={holidayOver} onChange={(e) => setHolidayOver(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>추가로 받을 수당 합계 (세전)</span>
          <strong>{won(r.total)}</strong>
          <small>가산분 {won(r.overtimePremium + r.holidayPremium + r.nightPremium)} 포함</small>
        </div>
        {size === "under5" && (
          <p className="warn">5인 미만 사업장은 가산수당 의무가 없어 일한 시간분만 계산합니다.</p>
        )}
        <table>
          <tbody>
            <tr><th>연장근로 시간분</th><td>{won(r.overtimeBase)}</td></tr>
            <tr><th>연장근로 가산 (50%)</th><td>{won(r.overtimePremium)}</td></tr>
            <tr><th>휴일근로 시간분</th><td>{won(r.holidayBase)}</td></tr>
            <tr><th>휴일근로 가산 (50%, 8시간 초과 100%)</th><td>{won(r.holidayPremium)}</td></tr>
            <tr><th>야간근로 가산 (50%)</th><td>{won(r.nightPremium)}</td></tr>
            <tr className="sum"><th>합계</th><td>{won(r.total)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
