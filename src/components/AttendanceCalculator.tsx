"use client";
import { useState } from "react";
import { calcAttendance } from "@/lib/calculators/attendance";
import { num } from "@/lib/format";

export default function AttendanceCalculator() {
  const [perWeek, setPerWeek] = useState("2");
  const [weeks, setWeeks] = useState("15");
  const [ratio, setRatio] = useState("0.25");
  const [absences, setAbsences] = useState("2");
  const [lates, setLates] = useState("2");
  const [latePer, setLatePer] = useState("3");
  const [max, setMax] = useState("10");
  const [deduct, setDeduct] = useState("1");

  const r = calcAttendance({
    classesPerWeek: Math.min(num(perWeek), 14),
    weeks: Math.min(num(weeks), 30),
    failRatio: Number(ratio),
    absences: num(absences),
    lates: num(lates),
    latesPerAbsence: num(latePer),
    maxScore: num(max),
    deductPerAbsence: num(deduct),
  });

  return (
    <div className="calc">
      <div className="fields">
        <label>주당 수업 횟수
          <input inputMode="numeric" value={perWeek} onChange={(e) => setPerWeek(e.target.value)} />
        </label>
        <label>학기 주 수
          <input inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
        </label>
        <label>F 기준 (결석 비율 이상)
          <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
            <option value="0.25">1/4 (25%)</option>
            <option value="0.333333">1/3 (33%)</option>
            <option value="0.2">1/5 (20%)</option>
          </select>
        </label>
        <label>지금까지 결석
          <input inputMode="numeric" value={absences} onChange={(e) => setAbsences(e.target.value)} />
        </label>
        <label>지금까지 지각
          <input inputMode="numeric" value={lates} onChange={(e) => setLates(e.target.value)} />
        </label>
        <label>지각 몇 번이 결석 1회 (0이면 환산 안 함)
          <input inputMode="numeric" value={latePer} onChange={(e) => setLatePer(e.target.value)} />
        </label>
        <label>출석 점수 만점
          <input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
        </label>
        <label>결석 1회당 감점
          <input inputMode="decimal" value={deduct} onChange={(e) => setDeduct(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>F 전까지 더 결석할 수 있는 횟수</span>
          <strong>{r.failed ? "0회" : `${r.allowedMore}회`}</strong>
          <small>전체 {r.total}회 중 {r.failAt}회 결석부터 F</small>
        </div>
        {r.failed && <p className="warn">결석이 F 기준에 이르렀습니다. 공결 처리 가능 여부를 학과나 교수님께 바로 확인하세요.</p>}
        <table>
          <tbody>
            <tr><th>지각 환산 결석</th><td>{r.fromLates}회</td></tr>
            <tr><th>반영된 결석 합계</th><td>{r.counted}회</td></tr>
            <tr><th>출석률</th><td>{Math.round(r.rate * 1000) / 10}%</td></tr>
            <tr className="sum"><th>예상 출석 점수</th><td>{r.score} / {num(max)}점</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
