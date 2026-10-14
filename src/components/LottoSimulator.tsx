"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  drawsSince, generateGame, parseNumbers, parseSimHash, PICK, RANK_RULES, savingsValue, SIM_YEARS, simHash, simulate, TICKET,
  type SimDraw,
} from "@/lib/lotto";
import { site } from "@/data/site";
import LottoBalls from "@/components/LottoBalls";

const won = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${won(Math.abs(v))}`;
const pct = (v: number) => v.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
const yearLabel = (y: number) => (y ? `최근 ${y}년` : "1회부터 전체");

// "지난 N년간 매주 이 번호로 샀다면?" 회차별 실제 당첨금으로 계산하고, 결과를 링크로 공유합니다.
export default function LottoSimulator({ draws }: { draws: SimDraw[] }) {
  const [text, setText] = useState("");
  const [years, setYears] = useState(10);
  const [tickets, setTickets] = useState(1);
  const [shared, setShared] = useState<"" | "link" | "text">("");

  // 공유 링크(#n=...&y=...&t=...)로 들어오면 그 조건을 그대로 채웁니다.
  useEffect(() => {
    const s = parseSimHash(window.location.hash);
    if (!s) return;
    setText(s.nums.join(", "));
    setYears(s.years);
    setTickets(s.tickets);
  }, []);

  const mine = parseNumbers(text).slice(0, PICK).sort((a, b) => a - b);
  const ready = mine.length === PICK;
  const range = drawsSince(draws, years);
  const r = ready ? simulate(mine, range, tickets) : null;
  const hash = ready ? simHash(mine, years, tickets) : "";

  // 조건이 바뀌면 주소창의 해시도 바꿔, 그대로 복사해도 같은 결과가 나오게 합니다.
  useEffect(() => {
    if (hash) window.history.replaceState(null, "", hash);
  }, [hash]);

  const net = r ? r.won - r.spent : 0;
  const afterTax = r ? r.won - r.tax - r.spent : 0;
  const roi = r && r.spent ? (net / r.spent) * 100 : 0;
  const savings = r ? savingsValue(TICKET * tickets, r.weeks) : 0;
  const shareUrl = `${site.url}/tools/lotto-simulator${hash}`;
  const shareText = r
    ? `로또 ${mine.join(", ")} 번호로 ${yearLabel(years)}(${r.weeks.toLocaleString("ko-KR")}주) 매주 ${tickets}장 샀다면\n` +
      `${won(r.spent)} 쓰고 ${won(r.won)} 당첨 → ${signed(net)} (수익률 ${pct(roi)}%)` +
      (r.best ? `\n최고 당첨: ${r.best.no}회 ${r.best.rank}등 ${won(r.best.prize)}` : "")
    : "";

  const copy = async (what: "link" | "text") => {
    const t = what === "link" ? shareUrl : `${shareText}\n${shareUrl}`;
    try {
      await navigator.clipboard.writeText(t);
      setShared(what);
      window.setTimeout(() => setShared(""), 1500);
    } catch {
      window.prompt("아래 내용을 복사하세요", t);
    }
  };
  const nativeShare = () => navigator.share?.({ title: "로또 시뮬레이터", text: shareText, url: shareUrl }).catch(() => {});

  return (
    <div className="calc">
      <label>내 번호 6개 (쉼표나 띄어쓰기로 구분)
        <div className="row">
          <input inputMode="numeric" placeholder="예: 3, 11, 17, 25, 34, 42" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="button" className="btn sm ghost" onClick={() => setText(generateGame().join(", "))}>자동</button>
        </div>
      </label>
      {mine.length > 0 && <div className="result-balls"><LottoBalls nums={mine} size="sm" /></div>}
      {!ready && mine.length > 0 && <p className="note-sm">1~45 사이 번호를 {PICK - mine.length}개 더 입력하세요.</p>}

      <h3 style={{ marginTop: 16 }}>기간</h3>
      <div className="seg" role="group" aria-label="기간">
        {SIM_YEARS.map((y) => (
          <button key={y} type="button" aria-pressed={years === y} onClick={() => setYears(y)}>{y ? `${y}년` : "전체"}</button>
        ))}
      </div>
      <label>매주 같은 번호로 산 장 수
        <select value={tickets} onChange={(e) => setTickets(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}장 ({won(TICKET * n)})</option>)}
        </select>
      </label>

      {r && (
        <div className="result" aria-live="polite">
          <div className="big">
            <span>{yearLabel(years)} · {r.firstDate} ~ {r.lastDate} · {r.weeks.toLocaleString("ko-KR")}주</span>
            <strong className={net >= 0 ? "gain" : "loss"}>{signed(net)}</strong>
            <small>{won(r.spent)} 쓰고 {won(r.won)} 당첨 · 수익률 {pct(roi)}%</small>
          </div>
          <table>
            <tbody>
              <tr><th>쓴 돈</th><th>{r.weeks.toLocaleString("ko-KR")}주 × {won(TICKET * tickets)}</th><td>{won(r.spent)}</td></tr>
              <tr><th>당첨금 (세전)</th><th /><td>{won(r.won)}</td></tr>
              <tr><th>세금</th><th>200만 원 넘는 당첨금 22~33%</th><td>{r.tax ? `-${won(r.tax)}` : "0원"}</td></tr>
              <tr className="sum"><th>세후 손익</th><th /><td>{signed(afterTax)}</td></tr>
            </tbody>
          </table>

          <h3 style={{ marginTop: 20 }}>등수별 당첨</h3>
          <table>
            <tbody>
              {RANK_RULES.map((rule, i) => (
                <tr key={rule}><th>{i + 1}등</th><th>{rule}</th><td>{r.counts[i + 1].toLocaleString("ko-KR")}번</td></tr>
              ))}
            </tbody>
          </table>
          <p className="note-sm">
            {r.best ? (
              <>가장 컸던 당첨: <Link href={`/lotto/${r.best.no}`}>{r.best.no}회({r.best.date}) {r.best.rank}등</Link> {won(r.best.prize)}{tickets > 1 && ` × ${tickets}장`}</>
            ) : (
              "이 기간에는 5등 이상 당첨이 한 번도 없었습니다."
            )}
          </p>
          <p className="note-sm">
            같은 돈을 매주 연 3% 적금에 넣었다면(세전) <b>{won(savings)}</b>이 되었을 거예요.{" "}
            {savings > r.won - r.tax ? `세후 당첨금보다 ${won(savings - (r.won - r.tax))} 많습니다.` : `세후 당첨금이 ${won(r.won - r.tax - savings)} 더 많습니다.`}
          </p>

          <div className="actions">
            <button type="button" className="btn sm" onClick={() => copy("text")}>{shared === "text" ? "복사했어요" : "결과 복사"}</button>
            <button type="button" className="btn sm ghost" onClick={() => copy("link")}>{shared === "link" ? "복사했어요" : "결과 링크 복사"}</button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button type="button" className="btn sm ghost" onClick={nativeShare}>공유하기</button>
            )}
          </div>
        </div>
      )}
      <p className="note">회차별로 실제 발표된 등수별 1게임당 당첨금으로 계산합니다. 1등·2등은 그 회차 당첨자 수에 따라 금액이 달랐고, 초기 회차의 4·5등 당첨금도 지금과 다릅니다.</p>
    </div>
  );
}
