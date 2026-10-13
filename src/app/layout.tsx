import type { Metadata, Viewport } from "next";
// Pretendard(SIL OFL 1.1)를 사이트에 직접 포함합니다. 화면에 쓰인 글자 범위의 파일만 내려받는 분할 버전입니다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PwaSetup from "@/components/PwaSetup";
import { site } from "@/data/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | ${site.tagline}`, template: `%s | ${site.name}` },
  description: site.description,
  appleWebApp: { title: site.name, statusBarStyle: "default" },
  openGraph: { siteName: site.name, type: "website", locale: "ko_KR" },
  // 검색엔진 사이트 소유권 확인용 메타 태그(구글 Search Console, 네이버 서치어드바이저)
  verification: {
    ...(site.googleVerification && { google: site.googleVerification }),
    ...(site.naverVerification && { other: { "naver-site-verification": site.naverVerification } }),
  },
  // 애드센스 사이트 소유권 확인용 메타 태그
  ...(site.adsenseClient && { other: { "google-adsense-account": site.adsenseClient } }),
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 가이드 RSS 피드 위치를 알립니다. 페이지마다 alternates(canonical)를 따로 정해 메타데이터로 넣으면 덮어써지므로 직접 둡니다. */}
        <link rel="alternate" type="application/rss+xml" title={`${site.name} 가이드`} href="/rss.xml" />
        {/* 저장된 글자 크기·화면 설정을 첫 화면 그리기 전에 적용해 깜빡임을 막습니다.
            앱 설치 이벤트는 화면 준비 전에 올 수 있어 미리 받아 둡니다(InstallApp에서 사용). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var d=JSON.parse(localStorage.getItem("nl-display")||"{}"),e=document.documentElement;if(d.size==="lg"||d.size==="xl")e.setAttribute("data-fs",d.size);if(d.theme==="light"||d.theme==="dark")e.setAttribute("data-theme",d.theme)}catch(_){}addEventListener("beforeinstallprompt",function(v){v.preventDefault();window.__installPrompt=v});',
          }}
        />
        {/* next/script는 data-nscript 속성을 붙여 애드센스 경고가 나므로 일반 script 태그를 씁니다.
            ID가 비어 있을 때 빈 문자열이 <head>에 텍스트로 들어가지 않도록 null을 반환합니다. */}
        {site.adsenseClient ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${site.adsenseClient}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
        <PwaSetup />
      </body>
    </html>
  );
}
