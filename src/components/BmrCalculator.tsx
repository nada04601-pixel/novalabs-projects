"use client";
import { useState } from "react";
import { ACTIVITY, calcBmr, validInput, type Activity, type Sex } from "@/lib/calculators/bmr";
import { num } from "@/lib/format";

const kcal = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}kcal`;

export default function BmrCalculator() {
  const [sex, setSex] = useState<Sex>("male");
  const [age, setAge] = useState("30");
  const [height, setHeight] = useState("175");
  const [weight, setWeight] = useState("70");
  const [bodyFat, setBodyFat] = useState("");
  const [activity, setActivity] = useState<Activity>("light");

  const input = {
    sex,
    age: num(age),
    heightCm: num(height),
    weightKg: num(weight),
    bodyFatPct: bodyFat.trim() ? num(bodyFat) : undefined,
  };
  const ok = validInput(input);
  const r = calcBmr(input, activity);

  return (
    <div className="calc">
      <div className="fields">
        <label>성별
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="male">남성</option>
            <option value="female">여성</option>
          </select>
        </label>
        <label>나이 (만 나이)
          <input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
        </label>
        <label>키 (cm)
          <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
        <label>몸무게 (kg)
          <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label>활동량
          <select value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
            {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
              <option key={a} value={a}>{ACTIVITY[a].label} ({ACTIVITY[a].desc})</option>
            ))}
          </select>
        </label>
        <label>체지방률 (%, 선택)
          <input inputMode="decimal" placeholder="모르면 비워 두세요" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        {!ok ? (
          <p className="warn">나이 15~100세, 키 100~250cm, 몸무게 20~300kg, 체지방률 1~69% 범위로 입력하세요.</p>
        ) : (
          <>
            <div className="big">
              <span>기초대사량 (Mifflin-St Jeor)</span>
              <strong>{kcal(r.bmr)}</strong>
              <small>하루 소비 칼로리 {kcal(r.tdee)} · {ACTIVITY[activity].label} × {ACTIVITY[activity].factor}</small>
            </div>
            <table>
              <thead><tr><th>목표</th><td>하루 섭취 칼로리</td></tr></thead>
              <tbody>
                <tr><th>체중 감량 (주 약 0.5kg)</th><td>{kcal(r.lose)}</td></tr>
                <tr className="sum"><th>체중 유지</th><td>{kcal(r.tdee)}</td></tr>
                <tr><th>체중 증가 (주 약 0.5kg)</th><td>{kcal(r.gain)}</td></tr>
              </tbody>
            </table>
            {r.lose < r.bmr && (
              <p className="warn">감량 목표 칼로리가 기초대사량보다 낮습니다. 기초대사량 아래로 먹으면 근손실과 요요가 오기 쉬우니 활동량을 늘리는 쪽을 함께 고려하세요.</p>
            )}

            <h3>공식별 기초대사량</h3>
            <table>
              <tbody>
                <tr><th>Mifflin-St Jeor</th><td>{kcal(r.bmr)}</td></tr>
                <tr><th>Harris-Benedict (개정)</th><td>{kcal(r.harrisBenedict)}</td></tr>
                {r.katchMcArdle !== undefined && <tr><th>Katch-McArdle (체지방률)</th><td>{kcal(r.katchMcArdle)}</td></tr>}
              </tbody>
            </table>

            <h3>활동량별 하루 소비 칼로리</h3>
            <table>
              <tbody>
                {r.byActivity.map((b) => (
                  <tr key={b.activity} className={b.activity === activity ? "sum" : undefined}>
                    <th>{ACTIVITY[b.activity].label} (× {ACTIVITY[b.activity].factor})</th>
                    <td>{kcal(b.tdee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
