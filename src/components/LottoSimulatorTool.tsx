import Link from "next/link";
import { draws, latestDraw } from "@/data/lotto";
import { simLite } from "@/lib/lotto";
import LottoSimulator from "@/components/LottoSimulator";

// 로또 시뮬레이터 페이지 본문. 회차별 당첨번호와 당첨금은 빌드 때 넣고 계산은 브라우저에서 합니다.
export default function LottoSimulatorTool() {
  return (
    <>
      <LottoSimulator draws={draws.map(simLite)} />
      <p className="note-sm">
        1회(2002년 12월)부터 {latestDraw.no}회({latestDraw.date})까지 기준입니다. 번호를 고르기 어렵다면{" "}
        <Link href="/tools/lotto">로또 번호 생성기</Link>에서 만들어 보세요.
      </p>
    </>
  );
}
