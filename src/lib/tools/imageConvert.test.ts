import { describe, expect, it } from "vitest";
import { convertedName, findQuality, isHeic, outputSize, parseTargetSize } from "./imageConvert";

describe("이미지 용량 줄이기·변환", () => {
  it("결과 크기: 비율·긴 변으로 줄이고 원본보다 키우지 않는다", () => {
    expect(outputSize(4000, 3000, { mode: "none", value: 0 })).toEqual({ w: 4000, h: 3000 });
    expect(outputSize(4000, 3000, { mode: "percent", value: 50 })).toEqual({ w: 2000, h: 1500 });
    expect(outputSize(3000, 4000, { mode: "long", value: 1920 })).toEqual({ w: 1440, h: 1920 });
    expect(outputSize(800, 600, { mode: "long", value: 1920 })).toEqual({ w: 800, h: 600 });
  });
  it("결과 크기: 캔버스 한도를 넘으면 비율을 지켜 줄인다", () => {
    const s = outputSize(8000, 6000, { mode: "none", value: 0 });
    expect(s.w * s.h).toBeLessThanOrEqual(16_777_216 + 8000);
    expect(s.w / s.h).toBeCloseTo(4 / 3, 2);
  });
  it("목표 용량 이하가 되는 가장 높은 화질을 찾는다", async () => {
    const size = async (q: number) => Math.round(q * 1000); // 화질에 비례하는 가짜 인코더
    const r = await findQuality(size, 500);
    expect(r.fits).toBe(true);
    expect(r.size).toBeLessThanOrEqual(500);
    expect(r.quality).toBeGreaterThan(0.48);
    expect(await findQuality(size, 2000)).toEqual({ quality: 0.95, size: 950, fits: true });
    expect((await findQuality(size, 10)).fits).toBe(false);
  });
  it("목표 용량 입력을 바이트로 바꾼다", () => {
    expect(parseTargetSize("200KB")).toBe(204800);
    expect(parseTargetSize("1.5 mb")).toBe(1572864);
    expect(parseTargetSize("300")).toBe(307200);
    expect(parseTargetSize("1,024k")).toBe(1048576);
    expect(parseTargetSize("0.5")).toBeNull();
    expect(parseTargetSize("abc")).toBeNull();
  });
  it("파일 이름: 형식이 같으면 -압축을 붙인다", () => {
    expect(convertedName("사진.png", "jpg")).toBe("사진.jpg");
    expect(convertedName("사진.JPEG", "jpg")).toBe("사진-압축.jpg");
    expect(convertedName("a.webp", "webp", "en")).toBe("a-compressed.webp");
    expect(convertedName("", "png", "en")).toBe("image.png");
  });
  it("HEIC 파일을 알아본다", () => {
    const box = (brand: string) => new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, ...[...brand].map((c) => c.charCodeAt(0))]);
    expect(isHeic(box("heic"))).toBe(true);
    expect(isHeic(box("isom"))).toBe(false);
    expect(isHeic(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);
  });
});
