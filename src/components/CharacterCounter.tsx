"use client";
import { useState } from "react";
import { manuscriptPages, readingMinutes, textStats } from "@/lib/tools/textCount";
import { num } from "@/lib/format";
import CopyButton from "@/components/CopyButton";

type Basis = "chars" | "charsNoSpace" | "neis";
const BASIS: { v: Basis; label: string; unit: string }[] = [
  { v: "chars", label: "공백 포함", unit: "자" },
  { v: "charsNoSpace", label: "공백 제외", unit: "자" },
  { v: "neis", label: "나이스 바이트", unit: "바이트" },
];

const n = (v: number) => v.toLocaleString("ko-KR");

export default function CharacterCounter() {
  const [text, setText] = useState("");
  const [limit, setLimit] = useState("");
  const [basis, setBasis] = useState<Basis>("chars");

  const s = textStats(text);
  const max = num(limit);
  const b = BASIS.find((x) => x.v === basis)!;
  const used = s[basis];
  const ratio = max ? used / max : 0;
  const mins = readingMinutes(s.charsNoSpace);

  const summary = () =>
    [
      `공백 포함 ${n(s.chars)}자 / 공백 제외 ${n(s.charsNoSpace)}자`,
      `단어 ${n(s.words)}개 · 줄 ${n(s.lines)}줄 · 문단 ${n(s.paragraphs)}개`,
      `나이스 ${n(s.neis)}바이트 · UTF-8 ${n(s.utf8)}바이트`,
    ].join("\n");

  return (
    <div className="calc">
      <label>글을 입력하거나 붙여 넣으세요
        <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="자기소개서, 과제, 블로그 글 등을 붙여 넣으면 바로 글자수를 셉니다." />
      </label>

      <div className="fields limit">
        <label>제한 {basis === "neis" ? "바이트" : "글자수"} (선택)
          <input inputMode="numeric" value={limit} placeholder="예: 1000" onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, "").slice(0, 7))} />
        </label>
        <label>세는 기준
          <select value={basis} onChange={(e) => setBasis(e.target.value as Basis)}>
            {BASIS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
          </select>
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>{b.label}</span>
          <strong>{n(used)}{b.unit}{max ? <small className="of"> / {n(max)}{b.unit}</small> : null}</strong>
          {max ? (
            <>
              <div className={`fillbar${ratio > 1 ? " over" : ""}`} aria-hidden="true"><i style={{ width: `${Math.min(ratio, 1) * 100}%` }} /></div>
              <small>{used > max ? `${n(used - max)}${b.unit} 넘었습니다` : `${n(max - used)}${b.unit} 남았습니다 · ${Math.round(ratio * 100)}%`}</small>
            </>
          ) : (
            <small>제한 글자수를 넣으면 남은 글자수를 알려드립니다</small>
          )}
        </div>
        {max > 0 && used > max && <p className="warn">제한을 {n(used - max)}{b.unit} 넘었습니다. 제출 전에 줄여 주세요.</p>}

        <dl className="stats">
          <div><dt>공백 포함</dt><dd>{n(s.chars)}자</dd></div>
          <div><dt>공백 제외</dt><dd>{n(s.charsNoSpace)}자</dd></div>
          <div><dt>단어</dt><dd>{n(s.words)}개</dd></div>
          <div><dt>줄 / 문단</dt><dd>{n(s.lines)} / {n(s.paragraphs)}</dd></div>
          <div><dt>나이스 바이트</dt><dd>{n(s.neis)}</dd></div>
          <div><dt>UTF-8 바이트</dt><dd>{n(s.utf8)}</dd></div>
          <div><dt>2바이트 기준</dt><dd>{n(s.legacy)}</dd></div>
          <div><dt>원고지(200자)</dt><dd>약 {n(manuscriptPages(s.chars))}매</dd></div>
          <div><dt>읽는 시간</dt><dd>{s.charsNoSpace ? (mins < 1 ? "1분 미만" : `약 ${Math.round(mins)}분`) : "0분"}</dd></div>
        </dl>

        <div className="actions">
          <CopyButton text={summary} label="결과 복사" />
          <button type="button" className="btn sm" disabled={!text} onClick={() => setText((t) => t.replace(/[ \t]+$/gm, "").replace(/[ \t]{2,}/g, " "))}>
            겹친 공백 정리
          </button>
          <button type="button" className="btn sm" disabled={!text} onClick={() => setText("")}>지우기</button>
        </div>
        <p className="note">입력한 글은 이 브라우저 안에서만 세며 서버로 보내거나 저장하지 않습니다. 새로고침하면 사라지니 긴 글은 따로 저장해 두세요.</p>
      </div>
    </div>
  );
}
