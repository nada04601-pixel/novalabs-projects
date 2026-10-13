// 가이드 글 목록을 RSS 2.0 피드(XML)로 만듭니다. 네이버 서치어드바이저 등에 제출해 새 글이 빨리 수집되게 합니다.

export type RssItem = { title: string; url: string; description: string; date: string }; // date: YYYY-MM-DD(한국 시간)
export type RssChannel = { title: string; url: string; feedUrl: string; description: string };

export const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 2026-10-12 → "Mon, 12 Oct 2026 00:00:00 +0900" (RSS가 요구하는 RFC 822 형식, 공개일 0시 한국 시간)
export function rfc822(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[day]}, ${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y} 00:00:00 +0900`;
}

export function buildRss(channel: RssChannel, items: RssItem[]): string {
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const entries = sorted.map((i) => [
    "    <item>",
    `      <title>${escapeXml(i.title)}</title>`,
    `      <link>${escapeXml(i.url)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(i.url)}</guid>`,
    `      <description>${escapeXml(i.description)}</description>`,
    `      <pubDate>${rfc822(i.date)}</pubDate>`,
    "    </item>",
  ].join("\n"));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.url)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    "    <language>ko</language>",
    `    <atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml" />`,
    ...(sorted.length ? [`    <lastBuildDate>${rfc822(sorted[0].date)}</lastBuildDate>`] : []),
    ...entries,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
