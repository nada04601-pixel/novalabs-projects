import type { MetadataRoute } from "next";
import { listedTools } from "@/data/tools";
import { guides } from "@/data/guides";
import { site } from "@/data/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // /lotto는 애드센스 심사 동안 noindex라 넣지 않습니다(src/data/nav.ts HIDDEN_PAGES).
  const pages = ["", "/tools", "/moim", "/guides", "/about", "/contact", "/terms", "/privacy"].map((p) => ({
    url: `${site.url}${p}`,
    lastModified: now,
  }));
  // 숨긴 도구(HIDDEN_TOOLS)는 noindex라 넣지 않습니다.
  const toolPages = listedTools.map((t) => ({ url: `${site.url}/tools/${t.slug}`, lastModified: now }));
  const guidePages = guides.map((g) => ({ url: `${site.url}/guides/${g.slug}`, lastModified: new Date(g.updated ?? g.date) }));
  // 로또 회차 페이지(/lotto/[회차])는 noindex라 사이트맵에 넣지 않습니다.
  // 영어 페이지(/en)도 애드센스 심사 동안 noindex로 두어 넣지 않습니다(2026-11-23, src/app/en/layout.tsx).
  return [...pages, ...toolPages, ...guidePages];
}
