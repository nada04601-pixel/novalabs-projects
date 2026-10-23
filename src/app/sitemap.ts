import type { MetadataRoute } from "next";
import { tools } from "@/data/tools";
import { guides } from "@/data/guides";
import { site } from "@/data/site";
import { toolsEn } from "@/data/tools.en";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = ["", "/tools", "/moim", "/lotto", "/guides", "/about", "/contact", "/terms", "/privacy"].map((p) => ({
    url: `${site.url}${p}`,
    lastModified: now,
  }));
  const toolPages = tools.map((t) => ({ url: `${site.url}/tools/${t.slug}`, lastModified: now }));
  const guidePages = guides.map((g) => ({ url: `${site.url}/guides/${g.slug}`, lastModified: new Date(g.date) }));
  // 로또 회차 페이지(/lotto/[회차])는 noindex라 사이트맵에 넣지 않습니다.
  // 영어 페이지와, 짝이 되는 한국어 페이지를 언어별 주소로 함께 알립니다.
  const enPages = [
    { url: `${site.url}/en`, lastModified: now, alternates: { languages: { ko: `${site.url}/`, en: `${site.url}/en` } } },
    ...["privacy", "terms"].map((p) => ({
      url: `${site.url}/en/${p}`,
      lastModified: now,
      alternates: { languages: { ko: `${site.url}/${p}`, en: `${site.url}/en/${p}` } },
    })),
    ...toolsEn.map((t) => ({
      url: `${site.url}/en/tools/${t.slug}`,
      lastModified: now,
      alternates: { languages: { ko: `${site.url}/tools/${t.slug}`, en: `${site.url}/en/tools/${t.slug}` } },
    })),
  ];
  return [...pages, ...toolPages, ...guidePages, ...enPages];
}
