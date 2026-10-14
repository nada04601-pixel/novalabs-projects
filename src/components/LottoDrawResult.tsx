import { formatDate, oddEven, RANK_RULES, sum, type Draw } from "@/lib/lotto";
import LottoBalls from "@/components/LottoBalls";

const won = (v: number) => `${v.toLocaleString("ko-KR")}원`;

// 한 회차의 당첨번호와 등위별 당첨금. 최신 회차 카드와 회차별 상세 페이지에서 함께 씁니다.
export default function LottoDrawResult({ draw, compact }: { draw: Draw; compact?: boolean }) {
  const [first] = draw.prizes;
  const by = draw.firstBy;
  const byText = [by.auto && `자동 ${by.auto}`, by.manual && `수동 ${by.manual}`, by.semi && `반자동 ${by.semi}`].filter(Boolean).join(" · ");
  return (
    <div className="calc lotto-draw">
      <p className="draw-head"><strong>제{draw.no}회</strong> <span>{formatDate(draw.date)} 추첨</span></p>
      <LottoBalls nums={draw.nums} bonus={draw.bonus} />
      <div className="big">
        <span>1등 1게임당 당첨금</span>
        <strong>{first[1] > 0 ? won(first[0]) : "1등 없음 (이월)"}</strong>
        <small>
          1등 {first[1].toLocaleString("ko-KR")}게임{byText && ` (${byText})`} · 2등 {draw.prizes[1][1].toLocaleString("ko-KR")}게임 · 3등 {draw.prizes[2][1].toLocaleString("ko-KR")}게임
        </small>
      </div>
      {!compact && (
        <table>
          <thead><tr><th>등수</th><th>당첨 기준</th><td>당첨 게임 수</td><td>1게임당 당첨금</td></tr></thead>
          <tbody>
            {draw.prizes.map(([prize, winners], i) => (
              <tr key={i}>
                <th>{i + 1}등</th>
                <th>{RANK_RULES[i]}</th>
                <td>{winners.toLocaleString("ko-KR")}</td>
                <td>{winners > 0 ? won(prize) : "-"}</td>
              </tr>
            ))}
            <tr className="sum"><th>총 판매액</th><th>홀:짝 {oddEven(draw.nums)} · 합계 {sum(draw.nums)}</th><td colSpan={2}>{won(draw.sales)}</td></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
