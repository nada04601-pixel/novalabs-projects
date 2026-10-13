import { guides } from "@/data/guides";
import { site } from "@/data/site";
import { buildRss } from "@/lib/rss";

export const dynamic = "force-static";

// 공개된 가이드 글의 RSS 피드(/rss.xml). 예약 글은 공개일 이후 다시 배포할 때 들어갑니다.
export function GET() {
  const xml = buildRss(
    { title: `${site.name} 가이드`, url: `${site.url}/guides`, feedUrl: `${site.url}/rss.xml`, description: site.description },
    guides.map((g) => ({ title: g.title, url: `${site.url}/guides/${g.slug}`, description: g.description, date: g.date })),
  );
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
