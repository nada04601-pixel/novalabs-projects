"use client";
import { useCallback, useEffect, useState } from "react";
import { CHO, MAX_LENGTH, SURNAMES, parseChoseong, randomByChoseong, randomByLength, withSurname } from "@/lib/tools/hangulName";
import CopyButton from "@/components/CopyButton";

type Mode = "choseong" | "length";

export default function NameGenerator() {
  const [mode, setMode] = useState<Mode>("length");
  const [chos, setChos] = useState<string[]>([]);
  const [length, setLength] = useState(3);
  const [mainConsonants, setMainConsonants] = useState(true);
  const [mainVowels, setMainVowels] = useState(true);
  const [noFinal, setNoFinal] = useState(true);
  const [surname, setSurname] = useState(""); // "" 없음, "random" 무작위, 그 밖에는 고른 성씨
  const [name, setName] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  const empty = mode === "choseong" && chos.length === 0;
  const generate = useCallback(() => {
    if (empty) return;
    const opts = { mainConsonants, mainVowels, noFinal };
    const given = mode === "choseong" ? randomByChoseong(chos, opts) : randomByLength(length, opts);
    const s = withSurname(given, surname);
    setName(s);
    setHistory((h) => [s, ...h].slice(0, 20));
  }, [empty, mode, chos, length, mainConsonants, mainVowels, noFinal, surname]);

  // 난수는 브라우저에서만 만들도록 첫 화면이 그려진 뒤 생성합니다.
  useEffect(() => generate(), []);

  const addCho = (c: string) => {
    setMode("choseong");
    setChos((prev) => (prev.length < MAX_LENGTH ? [...prev, c] : prev));
  };

  return (
    <div className="calc">
      <label className="inline">
        <input type="radio" name="name-mode" checked={mode === "choseong"} onChange={() => setMode("choseong")} />
        <strong>초성 선택</strong>
      </label>
      <div className="fields">
        <label>고른 초성 (직접 입력해도 됩니다, 최대 {MAX_LENGTH}자)
          <input
            value={chos.join("")}
            placeholder="예: ㄱㅈㄷ"
            onFocus={() => setMode("choseong")}
            onChange={(e) => setChos(parseChoseong(e.target.value))}
          />
        </label>
      </div>
      <div className="seg keypad">
        {CHO.map((c) => (
          <button key={c} type="button" onClick={() => addCho(c)} aria-label={`${c} 추가`}>{c}</button>
        ))}
        <button type="button" onClick={() => setChos((p) => p.slice(0, -1))} disabled={chos.length === 0} aria-label="마지막 초성 지우기">⌫</button>
        <button type="button" onClick={() => setChos([])} disabled={chos.length === 0}>비우기</button>
      </div>

      <label className="inline">
        <input type="radio" name="name-mode" checked={mode === "length"} onChange={() => setMode("length")} />
        <strong>길이 선택</strong>
      </label>
      <div className="seg keypad">
        {Array.from({ length: MAX_LENGTH }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={mode === "length" && length === n}
            onClick={() => { setMode("length"); setLength(n); }}
          >{n}</button>
        ))}
      </div>

      <div className="fields">
        <label>성씨 붙이기
          <select value={surname} onChange={(e) => setSurname(e.target.value)}>
            <option value="">붙이지 않음</option>
            <option value="random">무작위 (흔한 성씨 {SURNAMES.length}개 중)</option>
            {SURNAMES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>

      <div className="checks">
        <label className="inline">
          <input type="checkbox" checked={mainConsonants} onChange={(e) => setMainConsonants(e.target.checked)} />
          주요 자음만 사용 (쌍자음 빼기)
        </label>
        <label className="inline">
          <input type="checkbox" checked={mainVowels} onChange={(e) => setMainVowels(e.target.checked)} />
          주요 모음만 사용 (ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ)
        </label>
        <label className="inline">
          <input type="checkbox" checked={noFinal} onChange={(e) => setNoFinal(e.target.checked)} />
          종성(받침) 제외
        </label>
      </div>

      <div className="result" aria-live="polite">
        {empty ? (
          <p className="warn">초성을 하나 이상 골라 주세요.</p>
        ) : (
          <div className="big namebox">
            <span>{mode === "choseong" ? `초성 ${chos.join("")}` : `${length}글자`}{surname && " + 성씨"}</span>
            <strong>{name || " "}</strong>
          </div>
        )}
        <div className="actions">
          <button type="button" className="btn sm" onClick={generate} disabled={empty}>랜덤 생성하기</button>
          {name && <CopyButton text={() => name} label="복사" />}
        </div>
        {history.length > 1 && (
          <>
            <h3 className="sub">최근 만든 이름</h3>
            <div className="chips">
              {history.slice(1).map((h, i) => <span key={i} className="chip namechip">{h}</span>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
