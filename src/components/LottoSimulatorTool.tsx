import Link from "next/link";
import { draws, latestDraw } from "@/data/lotto";
import { simLite } from "@/lib/lotto";
import LottoLab from "@/components/LottoLab";

// 로또 시뮬레이터 페이지 본문(번호 생성 + 시뮬레이션). 회차별 당첨번호와 당첨금은 빌드 때 넣고 계산은 브라우저에서 합니다.
export default function LottoSimulatorTool() {
  return (
    <>
      <LottoLab draws={draws.map(simLite)} />
      <p className="note-sm">
        1회(2002년 12월)부터 {latestDraw.no}회({latestDraw.date})까지 기준입니다. 최신 당첨번호와 회차별 당첨금·1등 배출점은{" "}
        <Link href="/lotto">로또 당첨번호 조회</Link>에서 볼 수 있습니다.
      </p>
    </>
  );
}
