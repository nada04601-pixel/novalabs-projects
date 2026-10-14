import { describe, expect, it } from "vitest";
import { checkUpscale, fastUpscale, upscaledName } from "./upscale";

const solid = (w: number, h: number, rgba: number[]) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return { data, width: w, height: h };
};

describe("이미지 업스케일", () => {
  it("배율만큼 크기가 커진다", () => {
    const out = fastUpscale(solid(5, 3, [10, 20, 30, 255]), 4);
    expect([out.width, out.height]).toEqual([20, 12]);
    expect(out.data).toHaveLength(20 * 12 * 4);
  });
  it("단색 이미지는 늘리고 선명하게 해도 같은 색이다", () => {
    const out = fastUpscale(solid(4, 4, [200, 100, 50, 255]), 2);
    for (let i = 0; i < out.data.length; i += 4) {
      expect([...out.data.slice(i, i + 4)]).toEqual([200, 100, 50, 255]);
    }
  });
  it("가운데 흰 점이 있으면 늘린 뒤에도 가운데가 가장 밝다", () => {
    const img = solid(5, 5, [0, 0, 0, 255]);
    img.data.set([255, 255, 255, 255], (2 * 5 + 2) * 4);
    const out = fastUpscale(img, 2, 0);
    const at = (x: number, y: number) => out.data[(y * 10 + x) * 4];
    expect(at(4, 4)).toBeGreaterThan(at(0, 0));
    expect(at(5, 5)).toBeGreaterThan(at(9, 9));
  });
  it("크기 한도를 알려 준다", () => {
    expect(checkUpscale(800, 600, 2, "ai")).toBeNull();
    expect(checkUpscale(1000, 600, 4, "ai")).toMatch(/AI 모드 4배/);
    expect(checkUpscale(800, 600, 4, "fast")).toBeNull();
    expect(checkUpscale(3000, 2000, 4, "fast")).toMatch(/너무 큽니다/);
  });
  it("결과 파일 이름", () => {
    expect(upscaledName("사진.jpg", 4, "png")).toBe("사진-4x.png");
    expect(upscaledName("a.b.webp", 2, "jpg")).toBe("a.b-2x.jpg");
  });
});
