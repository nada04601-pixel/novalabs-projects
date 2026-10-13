import { describe, expect, it } from "vitest";
import { buildRss, escapeXml, rfc822 } from "./rss";

describe("RSS 피드", () => {
  it("날짜를 RFC 822 형식(한국 시간)으로 바꾼다", () => {
    expect(rfc822("2026-10-12")).toBe("Mon, 12 Oct 2026 00:00:00 +0900");
    expect(rfc822("2026-01-05")).toBe("Mon, 05 Jan 2026 00:00:00 +0900");
  });
  it("XML 특수문자를 이스케이프한다", () => {
    expect(escapeXml(`A&B <c> "d" 'e'`)).toBe("A&amp;B &lt;c&gt; &quot;d&quot; &apos;e&apos;");
  });
  it("최신 글부터 항목을 넣고 채널 정보를 채운다", () => {
    const xml = buildRss(
      { title: "노바랩 공작소", url: "https://x.kr", feedUrl: "https://x.kr/rss.xml", description: "설명" },
      [
        { title: "예전 글", url: "https://x.kr/guides/a", description: "a", date: "2026-10-01" },
        { title: "새 글 & 팁", url: "https://x.kr/guides/b", description: "b", date: "2026-10-12" },
      ],
    );
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.indexOf("새 글 &amp; 팁")).toBeLessThan(xml.indexOf("예전 글"));
    expect(xml).toContain("<lastBuildDate>Mon, 12 Oct 2026 00:00:00 +0900</lastBuildDate>");
    expect(xml).toContain('<guid isPermaLink="true">https://x.kr/guides/b</guid>');
    expect(xml.match(/<item>/g)).toHaveLength(2);
  });
});
