import { describe, expect, it } from "vitest";
import { boxFilter, cleanArea, defaultArea, fitLongSide, isTextColor, subtitleMask, subtitleRemovedName } from "./subtitleRemove";

// w×h 이미지를 (x, y) → [r, g, b] 함수로 채웁니다.
function image(w: number, h: number, f: (x: number, y: number) => [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set([...f(x, y), 255], (y * w + x) * 4);
  return d;
}

// 회색(100) 배경에 검은 테두리를 두른 흰 가로 획(x 20~59, y 18~21)
const W = 80, H = 40;
const stroke = (x: number, y: number): [number, number, number] => {
  if (x >= 20 && x < 60 && y >= 18 && y < 22) return [255, 255, 255];
  if (x >= 18 && x < 62 && y >= 16 && y < 24) return [0, 0, 0];
  return [100, 100, 100];
};
const opts = { color: "white" as const, sensitivity: "normal" as const, frameH: 360, pad: 0 };
const all = [{ x: 0, y: 0, w: W, h: H }];

describe("자막 지우기 계산", () => {
  it("글자색 판단", () => {
    expect(isTextColor(240, 240, 235, "white")).toBe(true);
    expect(isTextColor(240, 200, 60, "white")).toBe(false);
    expect(isTextColor(240, 220, 40, "yellow")).toBe(true);
    expect(isTextColor(240, 240, 240, "yellow")).toBe(false);
    expect(isTextColor(90, 220, 240, "bright")).toBe(true);
  });
  it("최솟값·최댓값 필터", () => {
    const src = new Uint8Array([5, 1, 5, 5, 5, 5, 5, 5, 9]);
    expect([...boxFilter(src, 3, 3, 1, false)]).toEqual([1, 1, 1, 1, 1, 1, 5, 5, 5]);
    expect([...boxFilter(src, 3, 3, 1, true)]).toEqual([5, 5, 5, 5, 9, 9, 5, 9, 9]);
  });
  it("테두리가 있는 흰 글자를 찾고 주변까지 넓힌다", () => {
    const { mask, count } = subtitleMask(image(W, H, stroke), W, H, all, opts);
    expect(count).toBe(40 * 4);
    expect(mask[19 * W + 40]).toBe(1);
    expect(mask[17 * W + 40]).toBe(1); // 넓힌 테두리
    expect(mask[5 * W + 40]).toBe(0);
  });
  it("주변까지 밝은 넓은 곳(하늘·흰 벽)은 글자로 보지 않는다", () => {
    const { count } = subtitleMask(image(W, H, () => [250, 250, 250]), W, H, all, opts);
    expect(count).toBe(0);
  });
  it("고른 영역 밖은 건드리지 않는다", () => {
    const { mask, count } = subtitleMask(image(W, H, stroke), W, H, [{ x: 0, y: 0, w: 40, h: H }], opts);
    expect(count).toBe(20 * 4);
    expect(mask[19 * W + 50]).toBe(0);
  });
  it("글자를 주변 색으로 메운다", () => {
    const img = { data: image(W, H, stroke), width: W, height: H };
    expect(cleanArea(img, all[0], all, opts)).toBe(true);
    const p = (19 * W + 40) * 4;
    expect(img.data[p]).toBeLessThan(140);
  });
  it("자막이 없는 장면은 그대로 둔다", () => {
    const img = { data: image(W, H, () => [100, 100, 100]), width: W, height: H };
    expect(cleanArea(img, all[0], all, opts)).toBe(false);
  });
  it("기본 영역·크기·파일 이름", () => {
    expect(defaultArea(1000, 500)).toEqual({ x: 50, y: 360, w: 900, h: 120 });
    expect(fitLongSide(3840, 2160)).toEqual({ w: 1920, h: 1080 });
    expect(fitLongSide(1279, 719)).toEqual({ w: 1280, h: 720 });
    expect(subtitleRemovedName("여행.mkv", "mkv")).toBe("여행-자막제거.mkv");
    expect(subtitleRemovedName("", "mp4", "en")).toBe("video-no-subtitles.mp4");
  });
});
