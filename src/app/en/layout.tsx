import type { Metadata } from "next";

// 영어 페이지는 한국어 도구를 옮긴 판이라, 애드센스 심사 동안 검색 결과에서 빼 둡니다(2026-11-23).
// 한국어 사이트가 승인된 뒤 이 robots 값을 지우고 사이트맵(src/app/sitemap.ts)에 다시 넣으면 됩니다.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
