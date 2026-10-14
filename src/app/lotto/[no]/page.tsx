import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { draws, getDraw, getStores, latestDraw } from "@/data/lotto";
import ToolSidebar from "@/components/ToolSidebar";
import Breadcrumbs from "@/components/Breadcrumbs";
import LottoDrawResult from "@/components/LottoDrawResult";
import LottoStores from "@/components/LottoStores";

type Props = { params: Promise<{ no: string }> };

export function generateStaticParams() {
  return draws.map((d) => ({ no: String(d.no) }));
}

const find = async (params: Props["params"]) => getDraw(Number((await params).no));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await find(params);
  if (!d) return {};
  return {
    title: `로또 ${d.no}회 당첨번호 (${d.date})`,
    description: `로또 6/45 제${d.no}회(${d.date}) 당첨번호 ${d.nums.join(", ")} 보너스 ${d.bonus}. 1등 ${d.prizes[0][1]}게임, 1~5등 당첨금과 당첨자 수, 1등 배출점(당첨 판매점)을 확인하세요.`,
    alternates: { canonical: `/lotto/${d.no}` },
  };
}

export default async function LottoDrawPage({ params }: Props) {
  const d = await find(params);
  if (!d) notFound();
  return (
    <div className="w wide page with-side">
      <ToolSidebar current="/tools/lotto" />
      <article>
        <Breadcrumbs items={[{ label: "도구함", href: "/tools" }, { label: "로또 번호 생성기", href: "/tools/lotto" }, { label: "전체 당첨번호", href: "/lotto" }, { label: `${d.no}회` }]} />
        <span className="badge">생활</span>
        <h1>로또 {d.no}회 당첨번호</h1>
        <p className="lead">{d.date} 추첨한 로또 6/45 제{d.no}회 당첨 결과와 등수별 당첨금, 1등 배출점입니다.</p>
        <LottoDrawResult draw={d} />
        <LottoStores draw={d} stores={getStores(d.no)} />
        <nav className="actions" aria-label="다른 회차">
          {d.no > 1 && <Link className="btn sm ghost" href={`/lotto/${d.no - 1}`}>← {d.no - 1}회</Link>}
          {d.no < latestDraw.no && <Link className="btn sm ghost" href={`/lotto/${d.no + 1}`}>{d.no + 1}회 →</Link>}
          <Link className="btn sm ghost" href="/lotto">전체 회차</Link>
          <Link className="btn sm" href="/tools/lotto">번호 생성기</Link>
        </nav>
        <p className="note">출처: 동행복권 로또 6/45 추첨 결과. 당첨 여부와 당첨금은 동행복권 공식 발표를 최종 기준으로 확인하세요.</p>
      </article>
    </div>
  );
}
