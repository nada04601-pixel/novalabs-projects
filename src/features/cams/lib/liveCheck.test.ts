import { describe, expect, it } from "vitest";
import { judgeChannel, judgeVideo, parseVideos, report } from "./liveCheck";
import { getCam } from "./cams";

const item = (id: string, live: string, status: Record<string, unknown> = {}) => ({
  id,
  snippet: { title: `${id} 라이브`, channelTitle: "GiGAeyes CCTV", liveBroadcastContent: live },
  status: { embeddable: true, privacyStatus: "public", ...status },
});

describe("라이브 점검", () => {
  const cam = getCam("kr-busan-songjeong")!;

  it("API 응답을 읽는다", () => {
    const m = parseVideos({ items: [item("a", "live"), item("b", "none", { embeddable: false })] });
    expect(m.get("a")).toMatchObject({ live: "live", embeddable: true, title: "a 라이브" });
    expect(m.get("b")).toMatchObject({ live: "none", embeddable: false });
    expect(parseVideos({}).size).toBe(0);
  });

  it("영상 상태를 판단한다", () => {
    const v = (live: string, status = {}) => parseVideos({ items: [item("x", live, status)] }).get("x");
    expect(judgeVideo(cam, v("live")).ok).toBe(true);
    expect(judgeVideo(cam, v("none")).problem).toBe("방송 종료");
    expect(judgeVideo(cam, v("upcoming")).problem).toMatch(/예정/);
    expect(judgeVideo(cam, v("live", { embeddable: false })).problem).toMatch(/재생이 막힘/);
    expect(judgeVideo(cam, v("live", { privacyStatus: "private" })).problem).toMatch(/비공개/);
    expect(judgeVideo(cam, undefined).problem).toMatch(/찾을 수 없음/);
  });

  it("채널 라이브 여부를 판단한다", () => {
    expect(judgeChannel(cam, "지금 라이브").ok).toBe(true);
    expect(judgeChannel(cam, null).problem).toMatch(/라이브 없음/);
  });

  it("보고서를 만든다", () => {
    const ok = report([judgeVideo(cam, parseVideos({ items: [item(cam.youtubeId!, "live")] }).get(cam.youtubeId!))], "https://x.kr", "/cams");
    expect(ok).toMatch(/1곳 모두 방송 중/);
    const bad = report([judgeVideo(cam, undefined)], "https://x.kr", "/cams");
    expect(bad).toMatch(/\*\*1곳\*\*/);
    expect(bad).toContain("[송정 해수욕장](https://x.kr/cams/kr-busan-songjeong)");
    expect(bad).toContain(`https://www.youtube.com/watch?v=${cam.youtubeId}`);
    expect(bad).toContain("올라호텔");
  });
});
