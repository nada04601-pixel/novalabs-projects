"use client";
import { useEffect, useState } from "react";
import { calcAge } from "@/lib/calculators/age";
import { formatDate, parseDate, todayKST } from "@/lib/calculators/date";

export default function AgeCalculator() {
  const [birth, setBirth] = useState("1995-05-15");
  const [ref, setRef] = useState("");

  // 정적 HTML에 빌드 날짜가 박히지 않도록 마운트 후 오늘 날짜를 채웁니다.
  useEffect(() => setRef(todayKST()), []);

  const b = parseDate(birth);
  const t = parseDate(ref);
  const r = b && t && t >= b ? calcAge(b, t) : null;

  return (
    <div className="calc">
      <div className="fields">
        <label>생년월일
          <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
        </label>
        <label>기준일
          <input type="date" value={ref} onChange={(e) => setRef(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        {r ? (
          <>
            <div className="big">
              <span>만 나이</span>
              <strong>{r.international}세</strong>
              <small>{r.isBirthday ? "오늘이 생일입니다" : `다음 생일까지 ${r.daysToNextBirthday}일 (${formatDate(r.nextBirthday)})`}</small>
            </div>
            <table>
              <tbody>
                <tr><th>연 나이 (기준연도 − 출생연도)</th><td>{r.yearAge}세</td></tr>
                <tr><th>세는 나이</th><td>{r.koreanAge}세</td></tr>
                <tr className="sum"><th>태어난 지</th><td>{r.livedDays.toLocaleString("ko-KR")}일</td></tr>
              </tbody>
            </table>
          </>
        ) : (
          <p className="warn">생년월일과 기준일을 확인해 주세요. 기준일은 생년월일 이후여야 합니다.</p>
        )}
      </div>
    </div>
  );
}
