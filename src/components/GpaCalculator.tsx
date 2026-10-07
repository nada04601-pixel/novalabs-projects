"use client";
import { useState } from "react";
import { calcGpa, floor2, GRADES, requiredGpa, type Course, type Scale } from "@/lib/calculators/gpa";
import { num } from "@/lib/format";

const blank = (): Course => ({ name: "", credits: 3, grade: "A0", major: false });
const show = (v: number) => (Number.isFinite(v) ? floor2(v).toFixed(2) : "-");

export default function GpaCalculator() {
  const [scale, setScale] = useState<Scale>("4.5");
  const [courses, setCourses] = useState<Course[]>([
    { name: "전공 과목 1", credits: 3, grade: "A+", major: true },
    { name: "전공 과목 2", credits: 3, grade: "B+", major: true },
    { name: "교양 과목", credits: 2, grade: "A0", major: false },
  ]);
  const [done, setDone] = useState("60");
  const [doneGpa, setDoneGpa] = useState("3.5");
  const [target, setTarget] = useState("3.8");
  const [remain, setRemain] = useState("70");

  const r = calcGpa(courses, scale);
  const grades = [...GRADES[scale].map((g) => g.grade), "P", "NP"];
  const set = (k: number, patch: Partial<Course>) => setCourses((cs) => cs.map((c, i) => (i === k ? { ...c, ...patch } : c)));
  const need = requiredGpa(Math.min(num(doneGpa), r.max), num(done), Math.min(num(target), r.max), num(remain));

  return (
    <div className="calc">
      <h3>이번 학기 평점</h3>
      <div className="fields">
        <label>만점 기준
          <select
            value={scale}
            onChange={(e) => {
              const s = e.target.value as Scale;
              const ok = new Set([...GRADES[s].map((g) => g.grade), "P", "NP"]);
              setScale(s);
              setCourses((cs) => cs.map((c) => (ok.has(c.grade) ? c : { ...c, grade: "A0" })));
            }}
          >
            <option value="4.5">4.5 만점 (A+ 4.5)</option>
            <option value="4.3">4.3 만점 (A+ 4.3, A- 3.7)</option>
          </select>
        </label>
      </div>
      <div className="rowlist" role="table" aria-label="과목 목록">
        <div className="rowlist-head" role="row"><span>과목명</span><span>학점</span><span>성적</span><span>전공</span><span /></div>
        {courses.map((c, k) => (
          <div className="rowlist-row" role="row" key={k}>
            <input aria-label="과목명" value={c.name} maxLength={30} onChange={(e) => set(k, { name: e.target.value })} />
            <input aria-label="학점" inputMode="decimal" value={c.credits || ""} onChange={(e) => set(k, { credits: Math.min(num(e.target.value), 30) })} />
            <select aria-label="성적" value={c.grade} onChange={(e) => set(k, { grade: e.target.value })}>
              {grades.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <input type="checkbox" aria-label="전공 과목" checked={c.major} onChange={(e) => set(k, { major: e.target.checked })} />
            <button type="button" className="link" aria-label={`${c.name || `${k + 1}번째 과목`} 삭제`} onClick={() => setCourses((cs) => cs.filter((_, i) => i !== k))}>삭제</button>
          </div>
        ))}
      </div>
      {courses.length < 20 && <button type="button" className="btn sm" onClick={() => setCourses((cs) => [...cs, blank()])}>+ 과목 추가</button>}

      <div className="result" aria-live="polite">
        <div className="big">
          <span>평균 평점 ({scale} 만점)</span>
          <strong>{r.gradedCredits ? show(r.gpa) : "-"}</strong>
          <small>전공 평점 {r.majorGpa ? show(r.majorGpa) : "-"}</small>
        </div>
        <table>
          <tbody>
            <tr><th>평점에 들어간 학점</th><td>{r.gradedCredits}학점</td></tr>
            <tr className="sum"><th>취득 학점 (F·NP 제외, P 포함)</th><td>{r.earnedCredits}학점</td></tr>
          </tbody>
        </table>
      </div>

      <h3>목표 평점까지</h3>
      <div className="fields">
        <label>지금까지 이수 학점
          <input inputMode="decimal" value={done} onChange={(e) => setDone(e.target.value)} />
        </label>
        <label>지금까지 누적 평점
          <input inputMode="decimal" value={doneGpa} onChange={(e) => setDoneGpa(e.target.value)} />
        </label>
        <label>목표 누적 평점
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label>앞으로 들을 학점
          <input inputMode="decimal" value={remain} onChange={(e) => setRemain(e.target.value)} />
        </label>
      </div>
      <div className="result" aria-live="polite">
        <table>
          <tbody>
            <tr className="sum"><th>남은 학점에서 필요한 평균 평점</th><td>{show(need)}</td></tr>
          </tbody>
        </table>
        {Number.isFinite(need) && need > r.max && <p className="warn">남은 학점을 모두 A+로 받아도 목표 평점에 닿지 않습니다. 목표를 조정하거나 학점을 더 들어야 합니다.</p>}
        {Number.isFinite(need) && need <= 0 && <p className="warn">지금 평점만으로도 목표를 이미 넘었습니다.</p>}
      </div>
    </div>
  );
}
