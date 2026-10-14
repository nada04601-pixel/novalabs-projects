"use client";
import { useCallback, useEffect, useState } from "react";
import { checkHistory, generateGames, MAX, validateOptions, type DrawLite } from "@/lib/lotto";
import LottoBalls from "@/components/LottoBalls";
import CopyButton from "@/components/CopyButton";

type Mark = "fixed" | "excluded";
const NEXT: Record<string, Mark | undefined> = { none: "fixed", fixed: "excluded", excluded: undefined };
const ALL = Array.from({ length: MAX }, (_, i) => i + 1);

// 무작위 번호 생성기. 번호판을 누르면 일반 → 고정 → 제외 순서로 바뀝니다.
export default function LottoGenerator({ draws }: { draws: DrawLite[] }) {
  const [count, setCount] = useState(5);
  const [marks, setMarks] = useState<Record<number, Mark>>({});
  const [games, setGames] = useState<number[][]>([]);

  const fixed = ALL.filter((n) => marks[n] === "fixed");
  const excluded = ALL.filter((n) => marks[n] === "excluded");
  const error = validateOptions({ fixed, excluded });

  const regenerate = useCallback(() => {
    const opts = {
      fixed: ALL.filter((n) => marks[n] === "fixed"),
      excluded: ALL.filter((n) => marks[n] === "excluded"),
    };
    if (!validateOptions(opts)) setGames(generateGames(count, opts));
  }, [count, marks]);

  // 난수는 브라우저에서만 만들도록 첫 화면이 그려진 뒤 생성합니다.
  useEffect(() => regenerate(), [regenerate]);

  const toggle = (n: number) =>
    setMarks((prev) => {
      const next = { ...prev };
      const m = NEXT[prev[n] ?? "none"];
      if (m) next[n] = m;
      else delete next[n];
      return next;
    });

  const text = () => games.map((g, i) => `${String.fromCharCode(65 + i)}: ${g.join(", ")}`).join("\n");

  return (
    <div className="calc">
      <h3>게임 수</h3>
      <div className="seg" role="group" aria-label="게임 수">
        {[1, 5, 10].map((n) => (
          <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)}>{n}게임</button>
        ))}
      </div>

      <details className="lotto-opts">
        <summary>
          고정수·제외수 정하기
          {(fixed.length > 0 || excluded.length > 0) && (
            <span className="count">고정 {fixed.length}개 · 제외 {excluded.length}개</span>
          )}
        </summary>
        <p className="note-sm">번호를 한 번 누르면 <b className="mk fixed">고정</b>(모든 게임에 포함), 두 번 누르면 <b className="mk excluded">제외</b>, 세 번 누르면 원래대로 돌아갑니다.</p>
        <div className="numpad" role="group" aria-label="번호판">
          {ALL.map((n) => (
            <button
              key={n}
              type="button"
              className={marks[n] ?? ""}
              onClick={() => toggle(n)}
              aria-label={`${n}번${marks[n] === "fixed" ? " 고정" : marks[n] === "excluded" ? " 제외" : ""}`}
            >
              {n}
            </button>
          ))}
        </div>
        {(fixed.length > 0 || excluded.length > 0) && (
          <div className="actions"><button type="button" className="btn sm ghost" onClick={() => setMarks({})}>모두 지우기</button></div>
        )}
      </details>

      <div className="result" aria-live="polite">
        {error ? (
          <p className="warn">{error}</p>
        ) : (
          <>
            <ol className="games">
              {games.map((g, i) => {
                const { counts } = checkHistory(g, draws);
                const best = counts.findIndex((c, r) => r > 0 && c > 0);
                return (
                  <li key={g.join(",")}>
                    <b className="game-label">{String.fromCharCode(65 + i)}</b>
                    <LottoBalls nums={g} />
                    <span className="game-hist">{best > 0 ? `지난 회차 최고 ${best}등` : "지난 회차 5등 이상 없음"}</span>
                  </li>
                );
              })}
            </ol>
            {games.length < count && <p className="note-sm">고정수 조건으로 만들 수 있는 서로 다른 조합이 {games.length}개뿐입니다.</p>}
            <div className="actions">
              <button type="button" className="btn sm" onClick={regenerate}>다시 만들기</button>
              <CopyButton text={text} label="번호 복사" />
            </div>
          </>
        )}
        <p className="note">번호는 이 브라우저의 암호학적 난수(crypto.getRandomValues)로 1~45 중 중복 없이 고릅니다. 어떤 조합이든 1등 확률은 똑같이 8,145,060분의 1입니다.</p>
      </div>
    </div>
  );
}
