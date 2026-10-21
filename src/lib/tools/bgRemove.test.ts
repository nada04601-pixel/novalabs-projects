import { describe, expect, it } from "vitest";
import { cropBox, cutoutName, maskBounds, maskCoverage } from "./bgRemove";

// w×h 마스크에서 [x0,x1)×[y0,y1) 사각형만 255로 채웁니다.
const rect = (w: number, h: number, x0: number, y0: number, x1: number, y1: number) => {
  const m = new Uint8Array(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * w + x] = 255;
  return m;
};

describe("배경 제거", () => {
  it("피사체를 감싸는 사각형을 찾는다", () => {
    expect(maskBounds(rect(10, 8, 2, 3, 6, 7), 10, 8)).toEqual({ x: 2, y: 3, w: 4, h: 4 });
    expect(maskBounds(new Uint8Array(20), 5, 4)).toBeNull();
  });
  it("흐린 가장자리(기준값 이하)는 빼고 찾는다", () => {
    const m = rect(10, 10, 4, 4, 6, 6);
    m[0] = 100;
    expect(maskBounds(m, 10, 10)).toEqual({ x: 4, y: 4, w: 2, h: 2 });
  });
  it("자를 영역을 원본 크기로 옮기고 여백을 두되 이미지 밖으로 나가지 않는다", () => {
    expect(cropBox({ x: 10, y: 10, w: 20, h: 40 }, 100, 100, 1000, 1000, 0)).toEqual({ x: 100, y: 100, w: 200, h: 400 });
    expect(cropBox({ x: 10, y: 10, w: 20, h: 40 }, 100, 100, 1000, 1000, 0.05)).toEqual({ x: 80, y: 80, w: 240, h: 440 });
    expect(cropBox({ x: 0, y: 0, w: 100, h: 100 }, 100, 100, 400, 300)).toEqual({ x: 0, y: 0, w: 400, h: 300 });
  });
  it("피사체 비율과 파일 이름", () => {
    expect(maskCoverage(rect(10, 10, 0, 0, 5, 10))).toBe(0.5);
    expect(cutoutName("사진.jpg", "png")).toBe("사진-배경제거.png");
    expect(cutoutName("photo.webp", "jpg", "en")).toBe("photo-no-bg.jpg");
  });
});
