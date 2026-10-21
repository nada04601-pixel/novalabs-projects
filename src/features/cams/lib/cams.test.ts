import { describe, expect, it } from "vitest";
import { cams, distanceKm, embedUrl, filterCams, getCam, relatedCams, thumbnailUrl, weatherLabel } from "./cams";

describe("실시간 CCTV 목록", () => {
  it("자료가 올바르다", () => {
    expect(new Set(cams.map((c) => c.id)).size).toBe(cams.length);
    for (const c of cams) {
      expect(c.id).toMatch(/^[a-z]{2}-[a-z0-9-]+$/);
      expect(c.lat).toBeGreaterThan(33);
      expect(c.lat).toBeLessThan(39);
      expect(c.lng).toBeGreaterThan(124);
      expect(c.lng).toBeLessThan(132);
    }
  });

  it("분류와 검색어로 거른다", () => {
    expect(filterCams(cams, "beaches").every((c) => c.category === "beaches")).toBe(true);
    expect(filterCams(cams, "all")).toHaveLength(cams.length);
    expect(filterCams(cams, "all", "해 운 대").map((c) => c.id)).toEqual(["kr-busan-haeundae", "kr-busan-haeundae-road"]);
    expect(filterCams(cams, "mountains", "해운대")).toEqual([]);
    expect(filterCams(cams, "all", "제주").length).toBeGreaterThanOrEqual(3);
  });

  it("거리를 계산한다", () => {
    const seoul = getCam("kr-seoul-gwanghwamun")!, busan = getCam("kr-busan-haeundae")!;
    expect(distanceKm(seoul, busan)).toBeGreaterThan(300);
    expect(distanceKm(seoul, busan)).toBeLessThan(340);
    expect(distanceKm(seoul, seoul)).toBe(0);
  });

  it("추천 목록은 자신을 빼고 겹치지 않는다", () => {
    for (const c of cams) {
      const r = relatedCams(c);
      expect(r).toHaveLength(4);
      expect(r).not.toContain(c);
      expect(new Set(r).size).toBe(4);
    }
    // 가장 가까운 곳이 먼저 오고, 같은 분류의 다른 지역도 들어간다
    const r = relatedCams(getCam("kr-busan-haeundae")!);
    expect(r[0].id).toBe("kr-busan-haeundae-road");
    expect(r.some((c) => c.category === "beaches" && c.region !== "부산/경남")).toBe(true);
  });

  it("영상이 연결된 장소는 플레이어 주소와 썸네일이 있다", () => {
    const c = getCam("kr-busan-songjeong")!;
    expect(c.isLive).toBe(true);
    expect(embedUrl(c)).toContain("/embed/NBZdNZYF1gI?");
    expect(thumbnailUrl(c)).toContain("/vi/NBZdNZYF1gI/");
  });

  it("영상 주소를 만든다", () => {
    const base = getCam("kr-busan-haeundae")!;
    expect(embedUrl({ ...base, youtubeId: undefined, youtubeChannelId: undefined })).toBeNull();
    expect(embedUrl({ ...base, youtubeId: "abc" })).toMatch(/youtube-nocookie\.com\/embed\/abc\?autoplay=1&mute=1/);
    expect(embedUrl({ ...base, youtubeChannelId: "UC123" })).toMatch(/embed\/live_stream\?channel=UC123/);
    expect(thumbnailUrl({ ...base, youtubeId: "abc" })).toBe("https://i.ytimg.com/vi/abc/hqdefault.jpg");
  });

  it("날씨 코드를 읽는다", () => {
    expect(weatherLabel(0)).toMatch(/맑음/);
    expect(weatherLabel(63)).toMatch(/비/);
    expect(weatherLabel(73)).toMatch(/눈/);
  });
});
