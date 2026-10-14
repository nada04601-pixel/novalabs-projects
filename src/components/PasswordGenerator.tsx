"use client";
import { useT } from "@/lib/useT";
import { useCallback, useEffect, useState } from "react";
import { entropyBits, generatePassword, strength, type CharsetKey } from "@/lib/tools/password";
import CopyButton from "@/components/CopyButton";

const SETS: { key: CharsetKey; label: string; en: string }[] = [
  { key: "lower", label: "영문 소문자 (a-z)", en: "Lowercase (a-z)" },
  { key: "upper", label: "영문 대문자 (A-Z)", en: "Uppercase (A-Z)" },
  { key: "digits", label: "숫자 (0-9)", en: "Numbers (0-9)" },
  { key: "symbols", label: "특수문자 (!@#$ 등)", en: "Symbols (!@#$ etc.)" },
];

export default function PasswordGenerator() {
  const t = useT();
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
  const s = strength(bits, t.lang);
  const toggle = (k: CharsetKey) => setSets((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  return (
    <div className="calc">
      <div className="fields">
        <label>{t(`길이: ${length}자`, `Length: ${length}`)}
          <input type="range" min={6} max={64} value={length} onChange={(e) => setLength(Number(e.target.value))} />
        </label>
        <label>{t("만들 개수", "How many")}
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="checks">
        {SETS.map((x) => (
          <label key={x.key} className="inline">
            <input type="checkbox" checked={sets.includes(x.key)} onChange={() => toggle(x.key)} />
            {t(x.label, x.en)}
          </label>
        ))}
        <label className="inline">
          <input type="checkbox" checked={excludeAmbiguous} onChange={(e) => setExcludeAmbiguous(e.target.checked)} />
          {t("헷갈리는 글자 빼기", "Exclude similar characters")} (I, l, 1, O, 0, o, |)
        </label>
      </div>

      <div className="result" aria-live="polite">
        {sets.length === 0 ? (
          <p className="warn">{t("글자 종류를 하나 이상 골라 주세요.", "Choose at least one character type.")}</p>
        ) : (
          <>
            <div className="big">
              <span>{t("비밀번호 강도", "Password strength")}</span>
              <strong>{s.label}</strong>
              <small>{t(`약 ${Math.round(bits)}비트 · 무작위 추측으로 맞히려면 평균 `, `About ${Math.round(bits)} bits · on average 2`)}{t("2", "")}<sup>{Math.max(Math.round(bits) - 1, 0)}</sup>{t("번 시도", " random guesses to crack")}</small>
              <div className={`meter l${s.level}`} aria-hidden="true"><i /><i /><i /><i /></div>
            </div>
            <ul className="pwlist">
              {list.map((pw, i) => (
                <li key={i}>
                  <code>{pw}</code>
                  <CopyButton text={() => pw} label={t("복사", "Copy")} />
                </li>
              ))}
            </ul>
            <div className="actions">
              <button type="button" className="btn sm" onClick={regenerate}>{t("다시 만들기", "Generate again")}</button>
            </div>
          </>
        )}
        <p className="note">{t("비밀번호는 이 브라우저 안에서 암호학적 난수(crypto.getRandomValues)로 만들며, 서버로 보내거나 저장하지 않습니다.", "Passwords are made in this browser with cryptographic randomness (crypto.getRandomValues) and are never sent or stored.")}</p>
      </div>
    </div>
  );
}
