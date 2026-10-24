import { describe, expect, it } from "vitest";
import { findCredits, parseDuration, pickOutliers, shortenText, toCsv, toMarkdown } from "./youtube-outliers.mjs";

const opts = { maxSubs: 100000, minViews: 50000, minRatio: 10 };

function video(id, { channelId = "c1", views = 500000, duration = "PT45S", description = "" } = {}) {
  return {
    id,
    query: "해외반응",
    snippet: { channelId, channelTitle: `채널 ${channelId}`, title: `영상 ${id}`, publishedAt: "2026-10-20T09:00:00Z", description },
    statistics: { viewCount: String(views) },
    contentDetails: { duration },
  };
}

function channel(id, subs, hidden = false) {
  return [id, { id, statistics: { subscriberCount: String(subs), hiddenSubscriberCount: hidden } }];
}

describe("parseDuration", () => {
  it("ISO 8601 길이를 초로 바꾼다", () => {
    expect(parseDuration("PT45S")).toBe(45);
    expect(parseDuration("PT2M5S")).toBe(125);
    expect(parseDuration("PT1H")).toBe(3600);
    expect(parseDuration("P0D")).toBe(0);
  });

  it("읽을 수 없으면 null", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration(undefined)).toBeNull();
    expect(parseDuration("45")).toBeNull();
  });
});

describe("findCredits", () => {
  it("SNS 링크와 @아이디를 찾고 이메일은 뺀다", () => {
    const text = "원본: @scot.crew_ (틱톡)\nhttps://www.tiktok.com/@scot.crew_/video/123).\n문의 ask@mail.com\nhttps://example.com/x";
    expect(findCredits(text)).toBe("https://www.tiktok.com/@scot.crew_/video/123 @scot.crew_");
  });

  it("같은 표시는 한 번만, 없으면 빈 문자열", () => {
    expect(findCredits("@abc @abc")).toBe("@abc");
    expect(findCredits("")).toBe("");
    expect(findCredits(undefined)).toBe("");
  });
});

describe("shortenText", () => {
  it("줄바꿈을 한 칸으로 줄이고 길면 자른다", () => {
    expect(shortenText("가\n\n나   다")).toBe("가 나 다");
    expect(shortenText("abcdef", 3)).toBe("abc…");
    expect(shortenText(undefined)).toBe("");
  });
});

describe("pickOutliers", () => {
  it("설명란과 원본 표시를 함께 담는다", () => {
    const channels = new Map([channel("c1", 10000)]);
    const [row] = pickOutliers([video("a", { description: "출처 @origin\n재밌게 보세요" })], channels, opts);
    expect(row.credits).toBe("@origin");
    expect(row.description).toBe("출처 @origin 재밌게 보세요");
  });

  it("기준에 맞는 쇼츠만 배수가 큰 순서로 고른다", () => {
    const channels = new Map([channel("c1", 20000), channel("c2", 5000)]);
    const rows = pickOutliers([video("a", { channelId: "c1" }), video("b", { channelId: "c2", views: 100000 })], channels, opts);
    expect(rows.map((r) => [r.url, r.ratio])).toEqual([
      ["https://www.youtube.com/shorts/a", 25],
      ["https://www.youtube.com/shorts/b", 20],
    ]);
  });

  it("기본은 조회수 높은 순, sort: ratio면 배수 큰 순", () => {
    // a: 30만 회 / 구독 1만 = 30배, b: 20만 회 / 구독 2천 = 100배
    const channels = new Map([channel("c1", 10000), channel("c2", 2000)]);
    const videos = [video("a", { channelId: "c1", views: 300000 }), video("b", { channelId: "c2", views: 200000 })];
    expect(pickOutliers(videos, channels, opts).map((r) => r.url.slice(-1))).toEqual(["a", "b"]);
    expect(pickOutliers(videos, channels, { ...opts, sort: "ratio" }).map((r) => r.url.slice(-1))).toEqual(["b", "a"]);
  });

  it("구독자가 많거나, 조회수·배수가 모자라거나, 3분이 넘으면 뺀다", () => {
    const channels = new Map([channel("big", 200000), channel("small", 20000)]);
    const rows = pickOutliers(
      [
        video("big", { channelId: "big", views: 5000000 }),
        video("lowViews", { channelId: "small", views: 40000 }),
        video("lowRatio", { channelId: "small", views: 150000 }),
        video("long", { channelId: "small", duration: "PT3M1S" }),
        video("ok", { channelId: "small", duration: "PT3M" }),
      ],
      channels,
      opts,
    );
    expect(rows.map((r) => r.url)).toEqual(["https://www.youtube.com/shorts/ok"]);
  });

  it("구독자 수를 숨긴 채널과 정보가 없는 채널은 뺀다", () => {
    const channels = new Map([channel("hidden", 0, true)]);
    const rows = pickOutliers([video("a", { channelId: "hidden" }), video("b", { channelId: "missing" })], channels, opts);
    expect(rows).toEqual([]);
  });
});

describe("toCsv", () => {
  it("BOM을 붙이고 쉼표·따옴표가 든 값을 감싼다", () => {
    const csv = toCsv(
      [{ title: '그 "반응", 진짜', channel: "채널", subs: 1000, views: 50000, ratio: 50, published: "2026-10-20", seconds: 30, url: "u", query: "q", credits: "@a", description: "설명" }],
      "2026-10-23",
    );
    expect(csv.startsWith("﻿찾은 날짜,영상 제목,")).toBe(true);
    expect(csv).toContain(",검색어,원본 표시,설명란\n");
    expect(csv).toContain('2026-10-23,"그 ""반응"", 진짜",채널,1000,50000,50,2026-10-20,30,u,q,@a,설명\n');
  });
});

describe("toMarkdown", () => {
  it("표로 만들고 제목의 | 를 이스케이프한다", () => {
    const md = toMarkdown([{ title: "A|B", channel: "채널", subs: 1000, views: 50000, ratio: 50, published: "2026-10-20", url: "u" }]);
    expect(md).toContain("| 50배 | 50,000 | 1,000 | [A\\|B](u) | 채널 | 2026-10-20 |");
  });
});
