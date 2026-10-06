"use client";
import { useState } from "react";
import { calcUnemployment, type InsuredPeriod } from "@/lib/calculators/unemployment";
import { num, won } from "@/lib/format";

export default function UnemploymentCalculator() {
  const [wages, setWages] = useState("9000000");
  const [days, setDays] = useState("92");
  const [hours, setHours] = useState("8");
  const [period, setPeriod] = useState<InsuredPeriod>("1to3");
  const [age, setAge] = useState<"under50" | "over50">("under50");

  const r = calcUnemployment({
    wages3m: num(wages),
    days3m: Math.min(Math.max(num(days), 1), 92),
    dailyHours: num(hours),
    period,
    over50OrDisabled: age === "over50",
  });

  return (
    <div className="calc">
      <div className="fields">
        <label>퇴직 전 3개월 임금 총액 (세전)
          <input inputMode="numeric" value={wages} onChange={(e) => setWages(e.target.value)} />
        </label>
        <label>3개월 일수 (보통 89~92일)
          <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </label>
        <label>하루 소정근로시간
          <input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <label>고용보험 가입 기간
          <select value={period} onChange={(e) => setPeriod(e.target.value as InsuredPeriod)}>
            <option value="lt1">1년 미만</option>
            <option value="1to3">1년 이상 3년 미만</option>
            <option value="3to5">3년 이상 5년 미만</option>
            <option value="5to10">5년 이상 10년 미만</option>
            <option value="10plus">10년 이상</option>
          </select>
        </label>
        <label>퇴직 당시 나이
          <select value={age} onChange={(e) => setAge(e.target.value as "under50" | "over50")}>
            <option value="under50">50세 미만</option>
            <option value="over50">50세 이상 또는 장애인</option>
          </select>
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>예상 구직급여 총액</span>
          <strong>{won(r.total)}</strong>
          <small>하루 {won(r.daily)} × {r.days}일 · 한 달(30일) 약 {won(r.monthly)}</small>
        </div>
        {r.raw < r.lower && <p className="warn">평균임금의 60%가 하한액보다 적어 하한액이 적용됩니다.</p>}
        {r.raw > r.upper && <p className="warn">평균임금의 60%가 상한액보다 많아 상한액이 적용됩니다.</p>}
        <table>
          <tbody>
            <tr><th>1일 평균임금</th><td>{won(r.avgDaily)}</td></tr>
            <tr><th>평균임금의 60%</th><td>{won(r.raw)}</td></tr>
            <tr><th>1일 하한액 / 상한액</th><td>{won(r.lower)} / {won(r.upper)}</td></tr>
            <tr><th>소정급여일수</th><td>{r.days}일</td></tr>
            <tr className="sum"><th>구직급여 일액</th><td>{won(r.daily)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
