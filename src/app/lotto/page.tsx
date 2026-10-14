import type { Metadata } from "next";
import Link from "next/link";
import { draws, latestDraw } from "@/data/lotto";
import { lite } from "@/lib/lotto";
import ToolSidebar from "@/components/ToolSidebar";
import Breadcrumbs from "@/components/Breadcrumbs";
import LottoHistory from "@/components/LottoHistory";

export const metadata: Metadata = {
  title: `로또 당첨번호 전체 조회 (1회~${latestDraw.no}회)`,
  description: `로또 6/45 1회부터 최신 ${latestDraw.no}회까지 전체 당첨번호와 보너스 번호, 홀짝 비율, 번호 합계를 회차나 번호로 찾아보세요.`,
  alternates: { canonical: "/lotto" },
};

export default function LottoHistoryPage() {
  return (
    <div className="w wide page with-side">
      <ToolSidebar current="/tools/lotto" />
      <article>
        <Breadcrumbs items={[{ label: "도구함", href: "/tools" }, { label: "로또 번호 생성기", href: "/tools/lotto" }, { label: "전체 당첨번호" }]} />
        <span className="badge">생활</span>
        <h1>로또 당첨번호 전체 조회</h1>
        <p className="lead">
          2002년 12월 1회부터 {latestDraw.date} 추첨한 {latestDraw.no}회까지 모든 회차의 당첨번호입니다. 회차 번호로 찾거나, 특정 번호가 포함된 회차만 골라 볼 수 있습니다. 회차를 누르면 등수별 당첨금과 당첨자 수가 나옵니다.
        </p>
        <LottoHistory draws={draws.map(lite)} />
        <div className="actions"><Link className="btn sm" href="/tools/lotto">번호 생성기로 돌아가기</Link></div>
        <p className="note">출처: 동행복권 로또 6/45 추첨 결과. 당첨 여부와 당첨금은 동행복권 공식 발표를 최종 기준으로 확인하세요.</p>
      </article>
    </div>
  );
}
