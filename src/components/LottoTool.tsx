import Link from "next/link";
import { draws, latestDraw } from "@/data/lotto";
import { formatDate, frequency, lite, nextDrawDate, oddEven, sum } from "@/lib/lotto";
import LottoBalls from "@/components/LottoBalls";
import LottoDrawResult from "@/components/LottoDrawResult";
import LottoGenerator from "@/components/LottoGenerator";
import LottoChecker from "@/components/LottoChecker";
import LottoFrequency from "@/components/LottoFrequency";

// 로또 번호 생성기 페이지 본문. 당첨 결과는 빌드할 때 정적 HTML로 들어가고, 생성·맞춰보기만 브라우저에서 돌아갑니다.
export default function LottoTool() {
  const all = draws.map(lite);
  const recent = [...draws].reverse().slice(0, 10);
  const ranges = [20, 100].map((n) => ({ label: `최근 ${n}회`, freq: frequency(draws.slice(-n)) }));
  ranges.push({ label: `전체 ${draws.length.toLocaleString("ko-KR")}회`, freq: frequency(draws) });

  return (
    <>
      <LottoGenerator draws={all} />

      <h2 id="latest">최신 회차 당첨번호</h2>
      <LottoDrawResult draw={latestDraw} compact />
      <p className="note-sm">
        다음 추첨: 제{latestDraw.no + 1}회 {formatDate(nextDrawDate(latestDraw.date))} 20:35경 ·{" "}
        <Link href={`/lotto/${latestDraw.no}`}>{latestDraw.no}회 등수별 당첨금·1등 배출점 보기</Link>
      </p>

      <h2>최근 당첨번호</h2>
      <div className="scroll">
        <table className="draws">
          <thead><tr><th>회차</th><th>추첨일</th><th>당첨번호 + 보너스</th><td>홀:짝</td><td>합계</td></tr></thead>
          <tbody>
            {recent.map((d) => (
              <tr key={d.no}>
                <th><Link href={`/lotto/${d.no}`}>{d.no}회</Link></th>
                <th>{d.date}</th>
                <th><LottoBalls nums={d.nums} bonus={d.bonus} size="sm" /></th>
                <td>{oddEven(d.nums)}</td>
                <td>{sum(d.nums)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions"><Link className="btn sm" href="/lotto">1회부터 전체 당첨번호 보기</Link></div>

      <h2>번호별 출현 횟수</h2>
      <p className="note-sm">보너스 번호를 뺀 당첨번호 6개만 셉니다. 지난 출현 횟수는 다음 회차 당첨 확률에 영향을 주지 않습니다.</p>
      <LottoFrequency ranges={ranges} />

      <h2>내 번호로 지난 회차 맞춰보기</h2>
      <p className="note-sm">늘 사는 번호가 있다면 1회부터 {latestDraw.no}회까지 몇 등에 몇 번 당첨됐을지 확인해 보세요.</p>
      <LottoChecker draws={all} />
      <div className="actions"><Link className="btn sm" href="/tools/lotto-simulator">매주 샀다면 얼마? 로또 시뮬레이터</Link></div>
    </>
  );
}
