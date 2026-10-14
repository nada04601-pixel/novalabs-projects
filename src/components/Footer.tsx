"use client";
import Link from "next/link";
import { site } from "@/data/site";
import InstallApp from "@/components/InstallApp";
import { useLang } from "@/lib/useT";

export default function Footer() {
  if (useLang() === "en") {
    // 영어 페이지: 소개·문의 페이지는 한국어뿐이라 문의는 메일로 연결합니다. 앱 설치 안내(한국어 이름)는 뺍니다.
    return (
      <footer>
        <div className="w">
          <nav>
            <Link href="/en">All tools</Link>
            <Link href="/">한국어 사이트</Link>
            <Link href="/en/privacy">Privacy policy</Link>
            <Link href="/en/terms">Terms of use</Link>
            <a href={`mailto:${site.email}`}>Contact</a>
          </nav>
          <p>Results are for reference only. Files you use with these tools are processed in your browser and are never uploaded.</p>
          <p>© {site.year} {site.nameEn} ({site.domain})</p>
        </div>
      </footer>
    );
  }
  return (
    <footer>
      <div className="w">
        <nav>
          <Link href="/about">소개</Link>
          <Link href="/contact">문의</Link>
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보처리방침</Link>
        </nav>
        <InstallApp />
        <p>계산 결과는 참고용이며 실제 금액과 다를 수 있습니다. 중요한 결정 전에는 공식 기관이나 전문가에게 확인하세요.</p>
        <p>© {site.year} {site.name} ({site.domain})</p>
      </div>
    </footer>
  );
}
