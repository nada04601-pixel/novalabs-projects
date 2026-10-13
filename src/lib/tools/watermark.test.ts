import { describe, expect, it } from "vitest";
import { buildMask, cleanedName, expandRect, inpaint, normalizeRect, pickVideoType, smoothItersFor, workArea } from "./watermark";

// w×h 이미지를 (x, y) → [r, g, b] 함수로 채웁니다.
function image(w: number, h: number, f: (x: number, y: number) => [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set([...f(x, y), 255], (y * w + x) * 4);
  return d;
}

describe("워터마크 영역 계산", () => {
  it("드래그 방향과 상관없이 이미지 안쪽 정수 사각형을 만든다", () => {
    expect(normalizeRect(50.6, 40.2, 10.3, 5.9, 100, 100)).toEqual({ x: 10, y: 5, w: 41, h: 36 });
    expect(normalizeRect(-20, -5, 300, 30, 100, 50)).toEqual({ x: 0, y: 0, w: 100, h: 30 });
  });
  it("너무 작은 드래그는 무시한다", () => {
    expect(normalizeRect(10, 10, 11, 40, 100, 100)).toBeNull();
  });
  it("넓힌 사각형은 이미지 밖으로 나가지 않는다", () => {
    expect(expandRect({ x: 2, y: 90, w: 10, h: 8 }, 5, 100, 100)).toEqual({ x: 0, y: 85, w: 17, h: 15 });
  });
  it("작업 범위는 모든 영역과 여백을 감싼다", () => {
    expect(workArea([{ x: 10, y: 10, w: 5, h: 5 }, { x: 40, y: 30, w: 10, h: 4 }], 100, 100, 3)).toEqual({ x: 7, y: 7, w: 46, h: 30 });
    expect(workArea([], 100, 100)).toBeNull();
  });
  it("마스크는 작업 범위 기준 좌표로 영역만 표시한다", () => {
    const m = buildMask({ x: 5, y: 5, w: 6, h: 4 }, [{ x: 7, y: 6, w: 2, h: 2 }]);
    const rows = Array.from({ length: 4 }, (_, y) => [...m.slice(y * 6, y * 6 + 6)].join(""));
    expect(rows).toEqual(["000000", "001100", "001100", "000000"]);
  });
});

describe("인페인팅", () => {
  it("단색 배경의 워터마크는 배경색으로 완전히 지워진다", () => {
    const w = 30, h = 20;
    const d = image(w, h, (x, y) => (x >= 10 && x < 20 && y >= 6 && y < 14 ? [255, 255, 255] : [40, 120, 200]));
    const area = { x: 0, y: 0, w, h };
    expect(inpaint(d, w, h, buildMask(area, [{ x: 10, y: 6, w: 10, h: 8 }]))).toBe(true);
    for (let i = 0; i < w * h; i++) expect([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]).toEqual([40, 120, 200]);
  });
  it("그라데이션 배경은 양쪽 색 사이 값으로 자연스럽게 이어진다", () => {
    const w = 40, h = 10;
    const d = image(w, h, (x) => [x * 5, 0, 0]);
    const rect = { x: 15, y: 0, w: 10, h: 10 };
    for (let y = 0; y < h; y++) for (let x = 15; x < 25; x++) d[(y * w + x) * 4] = 255; // 워터마크
    inpaint(d, w, h, buildMask({ x: 0, y: 0, w, h }, [rect]), 200);
    for (let x = 15; x < 25; x++) expect(Math.abs(d[(5 * w + x) * 4] - x * 5)).toBeLessThanOrEqual(3);
  });
  it("영역 바깥 픽셀은 바꾸지 않는다", () => {
    const w = 12, h = 12;
    const d = image(w, h, (x, y) => [(x * 13 + y * 7) % 256, (x * y) % 256, 9]);
    const before = d.slice();
    const m = buildMask({ x: 0, y: 0, w, h }, [{ x: 4, y: 4, w: 3, h: 3 }]);
    inpaint(d, w, h, m);
    for (let i = 0; i < w * h; i++) if (!m[i]) expect(d.slice(i * 4, i * 4 + 4)).toEqual(before.slice(i * 4, i * 4 + 4));
  });
  it("전체가 영역이면 참고할 색이 없어 그대로 둔다", () => {
    const d = image(4, 4, () => [1, 2, 3]);
    expect(inpaint(d, 4, 4, new Uint8Array(16).fill(1))).toBe(false);
    expect([...d.slice(0, 4)]).toEqual([1, 2, 3, 255]);
  });
  it("평활화 횟수는 영역 크기에 따라 정해진 범위 안에 있다", () => {
    expect(smoothItersFor([{ x: 0, y: 0, w: 4, h: 4 }])).toBe(20);
    expect(smoothItersFor([{ x: 0, y: 0, w: 400, h: 60 }])).toBe(90);
    expect(smoothItersFor([{ x: 0, y: 0, w: 900, h: 900 }])).toBe(120);
  });
});

describe("파일 이름과 동영상 형식", () => {
  it("확장자를 바꿔 결과 이름을 만든다", () => {
    expect(cleanedName("여행.영상.mov", "webm")).toBe("여행.영상-워터마크제거.webm");
    expect(cleanedName(".png", "png")).toBe("파일-워터마크제거.png");
  });
  it("지원하는 첫 번째 형식을 고른다", () => {
    expect(pickVideoType((m) => m.startsWith("video/webm"))?.ext).toBe("webm");
    expect(pickVideoType((m) => m === "video/mp4")?.mime).toBe("video/mp4");
    expect(pickVideoType(() => false)).toBeNull();
  });
});
