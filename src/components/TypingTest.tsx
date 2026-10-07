"use client";
import { useEffect, useRef, useState } from "react";
import { EN_SENTENCES, KO_SENTENCES, markChars, scoreTyping, type TypingResult } from "@/lib/tools/typing";

type Lang = "ko" | "en";
type Record = TypingResult & { lang: Lang; seconds: number };

const pick = (list: string[], not = -1) => {
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === not) i = (i + 1) % list.length;
  return i;
};

export default function TypingTest() {
  const [lang, setLang] = useState<Lang>("ko");
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [done, setDone] = useState<Record | null>(null);
  const [history, setHistory] = useState<Record[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const list = lang === "ko" ? KO_SENTENCES : EN_SENTENCES;
  const target = list[idx % list.length];

  // 문장은 브라우저에서 무작위로 고릅니다(서버 렌더링과 어긋나지 않게 첫 화면 뒤에).
  useEffect(() => setIdx(pick(KO_SENTENCES)), []);

  useEffect(() => {
    if (startedAt === null || done) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [startedAt, done]);

  const reset = (nextLang = lang, nextIdx = pick(nextLang === "ko" ? KO_SENTENCES : EN_SENTENCES, idx)) => {
    setLang(nextLang);
    setIdx(nextIdx);
    setTyped("");
    setStartedAt(null);
    setDone(null);
    input.current?.focus();
  };

  const finish = (value: string) => {
    if (startedAt === null) return;
    const ms = Math.max(Date.now() - startedAt, 1);
    const r: Record = { ...scoreTyping(target, value, ms), lang, seconds: ms / 1000 };
    setDone(r);
    setHistory((h) => [r, ...h].slice(0, 5));
  };

  const onChange = (value: string) => {
    if (done) return;
    if (startedAt === null && value) {
      setStartedAt(Date.now());
      setNow(Date.now());
    }
    setTyped(value);
    // 문장 길이만큼 치면 자동으로 끝납니다. 문장이 마침표로 끝나 한글 조합 중에 끝나는 일이 없습니다.
    if ([...value].length >= [...target].length) finish(value);
  };

  const live = startedAt !== null && !done ? scoreTyping(target, typed, Math.max(now - startedAt, 1)) : null;
  const unit = (r: { cpm: number; wpm: number }, l: Lang) => (l === "ko" ? `${r.cpm.toLocaleString("ko-KR")}타` : `${r.wpm} WPM`);

  return (
    <div className="calc">
      <div className="seg" role="group" aria-label="언어">
        <button type="button" aria-pressed={lang === "ko"} onClick={() => reset("ko")}>한글</button>
        <button type="button" aria-pressed={lang === "en"} onClick={() => reset("en")}>영어</button>
      </div>

      <p className="typing-target" aria-label={`따라 칠 문장: ${target}`}>
        {markChars(target, typed).map((m, i) => (
          <span key={i} className={m.state}>{m.ch}</span>
        ))}
      </p>
      <label>위 문장을 그대로 입력하세요
        <input
          ref={input}
          value={typed}
          disabled={!!done}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          lang={lang}
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && typed && finish(typed)}
          placeholder={startedAt === null ? "첫 글자를 치는 순간 시간이 시작됩니다" : ""}
        />
      </label>

      <div className="result" aria-live="polite">
        {done ? (
          <div className="big">
            <span>{lang === "ko" ? "분당 타수" : "분당 단어 수"}</span>
            <strong>{unit(done, done.lang)}</strong>
            <small>
              정확도 {Math.round(done.accuracy * 100)}% · {done.seconds.toFixed(1)}초
              {done.lang === "en" && ` · 분당 ${done.cpm}타`}
            </small>
          </div>
        ) : (
          <div className="big">
            <span>{live ? "현재 속도" : "준비"}</span>
            <strong>{live ? unit(live, lang) : "—"}</strong>
            <small>{live ? `${((now - (startedAt ?? now)) / 1000).toFixed(1)}초 · 정확도 ${Math.round(live.accuracy * 100)}%` : "입력을 시작하면 속도가 표시됩니다"}</small>
          </div>
        )}
        {done && done.accuracy < 0.9 && <p className="warn">정확도가 90%보다 낮습니다. 속도보다 정확하게 치는 데 먼저 집중해 보세요.</p>}
        <div className="actions">
          <button type="button" className="btn sm" onClick={() => reset()}>{done ? "다음 문장" : "다른 문장"}</button>
          {done && (
            <button type="button" className="btn sm" onClick={() => reset(lang, idx)}>같은 문장 다시</button>
          )}
        </div>

        {history.length > 0 && (
          <>
            <h3>최근 기록</h3>
            <table>
              <thead><tr><th>회차</th><td>속도</td><td>정확도</td><td>시간</td></tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <th>{history.length - i}회</th>
                    <td>{unit(h, h.lang)}</td>
                    <td>{Math.round(h.accuracy * 100)}%</td>
                    <td>{h.seconds.toFixed(1)}초</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <p className="note">한글은 자음·모음을 누른 횟수(타수)를 정확히 친 글자만으로 셉니다. 겹모음(ㅘ 등)과 겹받침(ㄳ 등)은 2타, 쌍자음은 1타입니다. 기록은 저장되지 않으며 새로고침하면 사라집니다.</p>
      </div>
    </div>
  );
}
