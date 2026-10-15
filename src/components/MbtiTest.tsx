"use client";
import { useEffect, useRef, useState } from "react";
import ShareLinkButtons from "@/components/ShareLinkButtons";
import { QUESTIONS, SCALE, calcMbti, decodeMbtiLink, encodeMbtiLink, type Answer, type MbtiResult } from "@/lib/calculators/mbti";
import { LETTER_TEXT, TYPES, TYPE_TEXT } from "@/data/mbtiText";

const PER_PAGE = 8;
const PAGES = Math.ceil(QUESTIONS.length / PER_PAGE);
const empty = () => QUESTIONS.map((): Answer => null);

export default function MbtiTest() {
  const [answers, setAnswers] = useState<Answer[]>(empty);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<MbtiResult | null>(null);
  const [linked, setLinked] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  // 공유 링크(#r=INFP&p=…)로 들어오면 그 결과를 바로 보여 줍니다.
  useEffect(() => {
    const load = () => {
      const r = decodeMbtiLink(window.location.hash);
      if (!r) return;
      setResult(r);
      setLinked(true);
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  const scrollTop = () => top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const go = (p: number) => {
    setPage(p);
    scrollTop();
  };
  const restart = () => {
    setAnswers(empty());
    setPage(0);
    setResult(null);
    setLinked(false);
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
    scrollTop();
  };

  if (result) {
    return (
      <div className="calc" ref={top}>
        {linked && <p className="warn">공유받은 링크의 결과입니다. 아래 &lsquo;테스트 다시 하기&rsquo;로 나도 해 볼 수 있어요.</p>}
        <MbtiResultView r={result} />
        <ShareLinkButtons hash={() => encodeMbtiLink(result)} title={`내 성격 유형은 ${result.type}`} note="링크에는 유형과 지표별 비율만 담기고 답변 내용은 담기지 않습니다." />
        <div className="actions">
          <button type="button" className="btn sm ghost" onClick={restart}>테스트 다시 하기</button>
        </div>
      </div>
    );
  }

  const start = page * PER_PAGE;
  const onPage = QUESTIONS.slice(start, start + PER_PAGE);
  const answered = answers.filter((a) => a !== null).length;
  const pageDone = onPage.every((_, i) => answers[start + i] !== null);

  return (
    <div className="calc" ref={top}>
      <div className="mbti-progress">
        <span>{page + 1} / {PAGES} 페이지 · {answered} / {QUESTIONS.length} 문항</span>
        <span className="saju-bar"><i style={{ width: `${(answered / QUESTIONS.length) * 100}%` }} /></span>
      </div>

      <ol className="mbti-questions" start={start + 1}>
        {onPage.map((q, i) => {
          const n = start + i;
          return (
            <li key={n}>
              <p id={`mbti-q${n}`}>{q.text}</p>
              <div className="mbti-scale" role="radiogroup" aria-labelledby={`mbti-q${n}`}>
                {SCALE.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={answers[n] === s.value}
                    aria-label={s.label}
                    title={s.label}
                    className={`v${s.value + 2}`}
                    onClick={() => setAnswers((prev) => prev.map((a, j) => (j === n ? s.value : a)))}
                  />
                ))}
              </div>
              <div className="mbti-scale-ends" aria-hidden="true"><span>전혀 아니다</span><span>매우 그렇다</span></div>
            </li>
          );
        })}
      </ol>

      <div className="actions">
        {page > 0 && <button type="button" className="btn sm ghost" onClick={() => go(page - 1)}>이전</button>}
        {page < PAGES - 1 ? (
          <button type="button" className="btn sm" disabled={!pageDone} onClick={() => go(page + 1)}>다음</button>
        ) : (
          <button
            type="button"
            className="btn sm"
            disabled={answered < QUESTIONS.length}
            onClick={() => {
              setResult(calcMbti(answers));
              scrollTop();
            }}
          >
            결과 보기
          </button>
        )}
        {!pageDone && <span className="saju-muted saju-share-note">이 페이지의 문항에 모두 답하면 넘어갈 수 있어요.</span>}
      </div>
    </div>
  );
}

function MbtiResultView({ r }: { r: MbtiResult }) {
  const [shown, setShown] = useState(r.type);
  useEffect(() => setShown(r.type), [r.type]);
  const t = TYPE_TEXT[r.type];
  const s = TYPE_TEXT[shown];

  return (
    <div className="result" aria-live="polite">
      <div className="big">
        <span>나의 성격 유형</span>
        <strong>{r.type}</strong>
        <small>{t.nickname}</small>
      </div>

      <section className="saju-card">
        <h4>지표별 선호</h4>
        {r.axes.map((a) => (
          <div key={a.axis} className="mbti-axis">
            <span className={a.letter === a.first ? "on" : ""}>{a.first} {LETTER_TEXT[a.first].name} {a.firstPct}%</span>
            <span className="mbti-axis-bar"><i style={{ width: `${a.firstPct}%` }} /></span>
            <span className={a.letter === a.second ? "on" : ""}>{100 - a.firstPct}% {LETTER_TEXT[a.second].name} {a.second}</span>
          </div>
        ))}
        <ul className="mbti-letters">
          {r.axes.map((a) => <li key={a.axis}><b>{a.letter} {LETTER_TEXT[a.letter].name}</b> {LETTER_TEXT[a.letter].desc}</li>)}
        </ul>
        {r.axes.some((a) => a.pct <= 55) && (
          <p className="saju-muted">
            {r.axes.filter((a) => a.pct <= 55).map((a) => a.axis.split("").join("·")).join(", ")} 지표는 양쪽 비율이 비슷해 상황에 따라 반대 성향도 잘 쓰는 편입니다.
            다시 하면 이 글자가 바뀔 수 있어요.
          </p>
        )}
      </section>

      <div className="saju-reading">
        {shown !== r.type && (
          <p className="warn">
            {shown} 유형을 보고 있어요. <button type="button" className="linklike" onClick={() => setShown(r.type)}>내 유형({r.type})으로 돌아가기</button>
          </p>
        )}
        <section className="saju-card">
          <h4>{shown} · {s.nickname}</h4>
          <p>{s.summary}</p>
        </section>
        <section className="saju-card">
          <h4>강점</h4>
          <ul>{s.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
          <h4>약점</h4>
          <ul>{s.weaknesses.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>
        <section className="saju-card">
          <h4>일과 진로</h4>
          <p>{s.work}</p>
        </section>
        <section className="saju-card">
          <h4>연애와 관계</h4>
          <p>{s.love}</p>
          <p>
            <b>잘 통하는 유형</b>{" "}
            {s.good.map((g, i) => (
              <span key={g}>
                {i > 0 && ", "}
                <button type="button" className="linklike" onClick={() => setShown(g)}>{g} {TYPE_TEXT[g].nickname}</button>
              </span>
            ))}
          </p>
        </section>

        <section className="saju-card">
          <h4>16가지 유형 둘러보기</h4>
          <div className="mbti-types">
            {TYPES.map((x) => (
              <button key={x} type="button" aria-pressed={x === shown} className={x === r.type ? "mine" : ""} onClick={() => setShown(x)}>
                <b>{x}</b>
                <small>{TYPE_TEXT[x].nickname}</small>
              </button>
            ))}
          </div>
        </section>

        <p className="saju-muted">
          공식 MBTI® 검사가 아니라 16가지 성격 유형 이론을 바탕으로 만든 간이 테스트입니다. 성격을 판정하거나 사람을 평가하는 도구가 아니니 재미와 자기 이해를 위한 참고용으로 봐 주세요.
        </p>
      </div>
    </div>
  );
}
