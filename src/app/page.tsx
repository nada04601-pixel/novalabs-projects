import Link from "next/link";
import type { Metadata } from "next";
import { guides } from "@/data/guides";
import { site } from "@/data/site";
import { RATES } from "@/data/rates/2026";
import ToolBrowser from "@/components/ToolBrowser";
import HeroArt from "@/components/HeroArt";

// 영어 페이지가 심사 동안 noindex라 언어별 주소(hreflang)는 알리지 않습니다.
export const metadata: Metadata = { alternates: { canonical: "/" } };

// 첫 화면 위쪽에 고정해 보여 줄 돈 계산 가이드(계산 표와 근거를 보강한 글)
const FEATURED = [
  "salary-vs-take-home",
  "severance-pay-guide",
  "weekly-holiday-pay-guide",
  "loan-repayment-methods",
  "brokerage-fee-guide",
  "year-end-tax-settlement-basics",
];

export default function Home() {
  const featured = FEATURED.map((slug) => guides.find((g) => g.slug === slug)).filter((g) => g !== undefined);
  return (
    <>
      <section className="hero-band">
        <div className="w wide hero-grid">
          <div className="hero">
            <span className="eyebrow">{site.name}</span>
            <h1>계산부터 문서까지,<br />자주 쓰는 도구를 한곳에</h1>
            <p className="lead">계산 결과와 함께 어떤 기준으로 계산했는지도 설명합니다. 회원가입 없이 바로 쓰고, 입력한 값은 서버로 보내지 않습니다.</p>
            <div className="hero-cta">
              <a className="btn" href="#tools">도구 찾기</a>
              <Link className="btn ghost" href="/guides">가이드 읽기</Link>
            </div>
          </div>
          <HeroArt />
        </div>
      </section>

      <div className="w wide page home-body">
        <section className="home-intro">
          <h2>노바랩 공작소는 이런 곳입니다</h2>
          <p>
            월급 실수령액, 퇴직금, 주휴수당, 대출이자, 중개보수처럼 한 번쯤 직접 따져 봐야 하는 돈 계산을 쉽게 해 보도록 만든 사이트입니다.
            숫자만 보여 주지 않고, 어떤 법 조항과 요율로 그 숫자가 나왔는지 함께 적습니다. 지금 계산기에는 {RATES.year}년 기준값이 들어 있고,
            국민연금·건강보험·고용노동부·국세청 같은 관계 기관이 공개한 자료로 확인합니다(마지막 확인 {RATES.checkedAt}).
          </p>
          <p>
            가이드 글의 계산 예시와 표는 사이트의 계산기와 같은 계산 코드로 만들어, 글에서 본 숫자와 계산기에 넣어 본 숫자가 다르지 않게 했습니다.
            PDF 합치기·용량 줄이기 같은 문서 도구도 함께 두었는데, 파일은 서버로 올리지 않고 쓰는 사람의 브라우저 안에서만 처리합니다.
          </p>
          <p>
            {site.operator.bio} 계산이 틀렸거나 제도가 바뀐 것을 발견하면 <Link href="/contact">문의</Link>로 알려 주세요. <Link href="/about">사이트 소개 더 보기 →</Link>
          </p>
        </section>

        {featured.length > 0 && (
          <section>
            <h2>돈 계산, 이 글부터 읽어 보세요</h2>
            <ul className="featured">
              {featured.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}`}>{g.title}</Link>
                  <p>{g.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div id="tools">
          <ToolBrowser />
        </div>

        <h2>새로 올린 가이드</h2>
        <ul className="list">
          {guides.slice(0, 5).map((g) => (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}`}>{g.title}</Link>
              <p>{g.description}</p>
              <time dateTime={g.date}>{g.date.replaceAll("-", ".")}</time>
            </li>
          ))}
        </ul>
        <p><Link href="/guides">가이드 전체 보기 →</Link></p>
      </div>
    </>
  );
}
