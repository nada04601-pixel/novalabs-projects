import type { Metadata } from "next";
import Link from "next/link";
import { draws, getStores, latestDraw } from "@/data/lotto";
import { formatDate, frequency, lite, nextDrawDate } from "@/lib/lotto";
import ToolSidebar from "@/components/ToolSidebar";
import Breadcrumbs from "@/components/Breadcrumbs";
import ShareButtons from "@/components/ShareButtons";
import LottoDrawResult from "@/components/LottoDrawResult";
import LottoStores from "@/components/LottoStores";
import LottoHistory from "@/components/LottoHistory";
import LottoFrequency from "@/components/LottoFrequency";

const title = "로또 당첨번호 조회";

export const metadata: Metadata = {
  title: `${title} (최신 ${latestDraw.no}회·1회부터 전체)`,
  description: `로또 6/45 최신 ${latestDraw.no}회(${latestDraw.date}) 당첨번호 ${latestDraw.nums.join(", ")} 보너스 ${latestDraw.bonus}와 1~5등 당첨금, 1등 배출점, 1회부터 전체 당첨번호 검색, 번호별 출현 횟수를 확인하세요.`,
  alternates: { canonical: "/lotto" },
};

const faq = [
  { q: "당첨번호는 언제 갱신되나요?", a: "토요일 추첨 결과를 일요일 아침에 자동으로 받아 반영합니다. 갱신 전에는 최신 회차가 한 주 전 결과로 보일 수 있으니, 당첨 여부와 당첨금은 동행복권 공식 발표로 최종 확인하세요." },
  { q: "많이 나온 번호를 고르면 당첨 확률이 올라가나요?", a: "아니요. 매 회차 추첨은 독립적이라 지난 출현 횟수와 관계없이 모든 조합의 1등 확률은 8,145,060분의 1로 같습니다. 출현 통계는 재미로만 보세요." },
  { q: "당첨금을 받으려면 세금을 얼마나 내나요?", a: "200만 원 이하는 비과세입니다. 200만 원을 넘으면 구입비 1,000원을 뺀 당첨금 3억 원까지는 22%(소득세 20%+지방소득세 2%), 3억 원 초과분은 33%가 원천징수됩니다. 당첨금 지급 기한은 지급 개시일로부터 1년입니다." },
];

// 최신 회차, 전체 회차 검색, 번호별 출현 횟수를 한 페이지에서 보여 줍니다. 회차별 상세는 /lotto/[회차]
export default function LottoResultsPage() {
  const ranges = [20, 100].map((n) => ({ label: `최근 ${n}회`, freq: frequency(draws.slice(-n)) }));
  ranges.push({ label: `전체 ${draws.length.toLocaleString("ko-KR")}회`, freq: frequency(draws) });

  return (
    <div className="w wide page with-side">
      <ToolSidebar current="/lotto" />
      <article>
        <Breadcrumbs items={[{ label: "도구함", href: "/tools" }, { label: "생활", href: "/tools" }, { label: title }]} />
        <span className="badge">생활</span>
        <h1>{title}</h1>
        <p className="lead">
          최신 {latestDraw.no}회 당첨번호와 등수별 당첨금, 1등 배출점, 2002년 12월 1회부터 지금까지 모든 회차의 당첨번호를 확인하세요. 당첨 결과는 매주 추첨 다음 날 자동으로 갱신됩니다.
        </p>

        <h2 style={{ marginTop: 0 }}>최신 회차 당첨번호</h2>
        <LottoDrawResult draw={latestDraw} />
        <p className="note-sm">
          다음 추첨: 제{latestDraw.no + 1}회 {formatDate(nextDrawDate(latestDraw.date))} 20:35경 ·{" "}
          <Link href={`/lotto/${latestDraw.no}`}>{latestDraw.no}회 상세 페이지</Link>
        </p>
        <LottoStores draw={latestDraw} stores={getStores(latestDraw.no)} />

        <h2>전체 회차 당첨번호</h2>
        <p className="note-sm">회차 번호로 찾거나, 특정 번호가 포함된 회차만 골라 볼 수 있습니다. 회차를 누르면 등수별 당첨금과 1등 배출점이 나옵니다.</p>
        <LottoHistory draws={draws.map(lite)} />

        <h2>번호별 출현 횟수</h2>
        <p className="note-sm">보너스 번호를 뺀 당첨번호 6개만 셉니다. 지난 출현 횟수는 다음 회차 당첨 확률에 영향을 주지 않습니다.</p>
        <LottoFrequency ranges={ranges} />

        <div className="actions">
          <Link className="btn sm" href="/tools/lotto-simulator">번호 만들고 매주 샀다면 얼마? 로또 시뮬레이터</Link>
        </div>

        <section>
          <h2>등수별 당첨 기준과 확률</h2>
          <p>
            1등은 6개 번호 일치(1/8,145,060), 2등은 5개와 보너스 번호 일치(1/1,357,510), 3등은 5개 일치(1/35,724), 4등은 4개 일치(1/733)로 고정 5만 원, 5등은 3개 일치(1/45)로 고정 5천 원입니다. 1~3등 당첨금은 그 회차 판매액과 당첨자 수에 따라 달라지며, 1등이 없으면 다음 회차로 이월됩니다.
          </p>
        </section>
        <section>
          <h2>추첨 일정과 구매</h2>
          <p>추첨은 매주 토요일 20:35경 진행되며, 판매는 토요일 20:00에 마감됩니다. 1게임은 1,000원이고 1인당 한 번에 10만 원까지 살 수 있습니다. 만 19세 미만은 복권을 살 수 없습니다.</p>
        </section>
        <section>
          <h2>자주 묻는 질문</h2>
          {faq.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        <ShareButtons title={title} path="/lotto" />
        <p className="note">출처: 동행복권 로또 6/45 추첨 결과. 당첨 여부와 당첨금은 동행복권 공식 발표를 최종 기준으로 확인하세요.</p>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            }),
          }}
        />
      </article>
    </div>
  );
}
