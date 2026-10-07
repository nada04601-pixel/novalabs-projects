"use client";
import { useCallback, useEffect, useState } from "react";
import { entropyBits, generatePassword, strength, type CharsetKey } from "@/lib/tools/password";
import CopyButton from "@/components/CopyButton";

const SETS: { key: CharsetKey; label: string }[] = [
  { key: "lower", label: "영문 소문자 (a-z)" },
  { key: "upper", label: "영문 대문자 (A-Z)" },
  { key: "digits", label: "숫자 (0-9)" },
  { key: "symbols", label: "특수문자 (!@#$ 등)" },
];

export default function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [sets, setSets] = useState<CharsetKey[]>(["lower", "upper", "digits", "symbols"]);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(true);
  const [count, setCount] = useState(5);
  const [list, setList] = useState<string[]>([]);

  const opts = { length, sets, excludeAmbiguous };
  const regenerate = useCallback(() => {
    setList(Array.from({ length: count }, () => generatePassword({ length, sets, excludeAmbiguous })));
  }, [length, sets, excludeAmbiguous, count]);

  // 난수는 브라우저에서만 만들도록 첫 화면이 그려진 뒤 생성합니다.
  useEffect(() => regenerate(), [regenerate]);

  const bits = entropyBits(opts);
  const s = strength(bits);
  const toggle = (k: CharsetKey) => setSets((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  return (
    <div className="calc">
      <div className="fields">
        <label>길이: {length}자
          <input type="range" min={6} max={64} value={length} onChange={(e) => setLength(Number(e.target.value))} />
        </label>
        <label>만들 개수
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n}개</option>)}
          </select>
        </label>
      </div>
      <div className="checks">
        {SETS.map((x) => (
          <label key={x.key} className="inline">
            <input type="checkbox" checked={sets.includes(x.key)} onChange={() => toggle(x.key)} />
            {x.label}
          </label>
        ))}
        <label className="inline">
          <input type="checkbox" checked={excludeAmbiguous} onChange={(e) => setExcludeAmbiguous(e.target.checked)} />
          헷갈리는 글자 빼기 (I, l, 1, O, 0, o, |)
        </label>
      </div>

      <div className="result" aria-live="polite">
        {sets.length === 0 ? (
          <p className="warn">글자 종류를 하나 이상 골라 주세요.</p>
        ) : (
          <>
            <div className="big">
              <span>비밀번호 강도</span>
              <strong>{s.label}</strong>
              <small>약 {Math.round(bits)}비트 · 무작위 추측으로 맞히려면 평균 2<sup>{Math.max(Math.round(bits) - 1, 0)}</sup>번 시도</small>
              <div className={`meter l${s.level}`} aria-hidden="true"><i /><i /><i /><i /></div>
            </div>
            <ul className="pwlist">
              {list.map((pw, i) => (
                <li key={i}>
                  <code>{pw}</code>
                  <CopyButton text={() => pw} label="복사" />
                </li>
              ))}
            </ul>
            <div className="actions">
              <button type="button" className="btn sm" onClick={regenerate}>다시 만들기</button>
            </div>
          </>
        )}
        <p className="note">비밀번호는 이 브라우저 안에서 암호학적 난수(crypto.getRandomValues)로 만들며, 서버로 보내거나 저장하지 않습니다.</p>
      </div>
    </div>
  );
}
