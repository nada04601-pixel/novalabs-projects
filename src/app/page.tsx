import Link from "next/link";
import type { Metadata } from "next";
import { guides } from "@/data/guides";
import { site } from "@/data/site";
import ToolBrowser from "@/components/ToolBrowser";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <div className="w wide page">
      <section className="hero">
        <span className="eyebrow">{site.name}</span>
        <h1>월급부터 대출까지,<br />헷갈리는 계산을 쉽게</h1>
        <p className="lead">계산 결과와 함께 어떤 기준으로 계산했는지도 설명합니다. 회원가입 없이 바로 쓰고, 입력한 값은 서버로 보내지 않습니다.</p>
      </section>
      <ToolBrowser />

      <h2>생활 계산 가이드</h2>
      <ul className="list">
        {guides.slice(0, 5).map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`}>{g.title}</Link>
            <p>{g.description}</p>
          </li>
        ))}
      </ul>
      <p><Link href="/guides">가이드 전체 보기 →</Link></p>
    </div>
  );
}
