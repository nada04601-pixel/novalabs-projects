import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { imagesToPdf } from "./pdfPages";
import { imagesPdfName, jpegOrientation, pageImageName, pagesZipName, placeImage, sniffImage } from "./imagePdf";
import { crc32, zipStore } from "./zip";

// 4×2px 빨간 JPEG(Pillow로 만든 실제 파일)
const JPEG = Uint8Array.from(Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAACAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDHooorhPqD/9k=",
  "base64",
));

// SOI 바로 뒤에 회전 값이 든 EXIF(APP1) 구간을 끼워 넣습니다.
function withOrientation(jpeg: Uint8Array, o: number, littleEndian: boolean) {
  const tiff = new Uint8Array(26);
  const v = new DataView(tiff.buffer);
  tiff.set(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d], 0);
  v.setUint16(2, 42, littleEndian);
  v.setUint32(4, 8, littleEndian);
  v.setUint16(8, 1, littleEndian); // 항목 1개
  v.setUint16(10, 0x0112, littleEndian);
  v.setUint16(12, 3, littleEndian); // SHORT
  v.setUint32(14, 1, littleEndian);
  v.setUint16(18, o, littleEndian);
  const body = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]);
  const seg = new Uint8Array([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body]);
  return new Uint8Array([...jpeg.slice(0, 2), ...seg, ...jpeg.slice(2)]);
}

// w×h 회색 PNG를 직접 만듭니다.
function makePng(w: number, h: number) {
  const chunk = (type: string, data: Uint8Array) => {
    const td = new Uint8Array([...Buffer.from(type, "ascii"), ...data]);
    const out = new Uint8Array(12 + data.length);
    const v = new DataView(out.buffer);
    v.setUint32(0, data.length);
    out.set(td, 4);
    v.setUint32(8 + data.length, crc32(td));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  ihdr.set([8, 0, 0, 0, 0], 8); // 8비트 회색조
  const raw = new Uint8Array(h * (w + 1)).fill(128);
  for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0; // 줄마다 필터 0
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk("IHDR", ihdr), ...chunk("IDAT", deflateSync(raw)), ...chunk("IEND", new Uint8Array()),
  ]);
}

describe("이미지 판별과 회전 정보", () => {
  it("JPG·PNG를 첫 바이트로 알아본다", () => {
    expect(sniffImage(JPEG)).toBe("jpg");
    expect(sniffImage(makePng(2, 2))).toBe("png");
    expect(sniffImage(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBe("other");
  });
  it("EXIF 회전 값을 엔디언과 상관없이 읽고, 없으면 1로 본다", () => {
    expect(jpegOrientation(JPEG)).toBe(1);
    expect(jpegOrientation(withOrientation(JPEG, 6, true))).toBe(6);
    expect(jpegOrientation(withOrientation(JPEG, 8, false))).toBe(8);
    expect(jpegOrientation(makePng(1, 1))).toBe(1);
    expect(jpegOrientation(JPEG.slice(0, 40))).toBe(1); // 잘린 파일도 오류 없이
  });
});

describe("쪽 배치", () => {
  it("A4: 이미지 방향에 맞춰 세로·가로를 고르고 여백 안 가운데에 비율을 지켜 놓는다", () => {
    const p = placeImage(3000, 4000, "a4", 20);
    expect([p.pageW, p.pageH]).toEqual([595.28, 841.89]);
    expect(p.w / p.h).toBeCloseTo(0.75);
    expect(p.w).toBeLessThanOrEqual(595.28 - 40 + 1e-9);
    expect(p.h).toBeLessThanOrEqual(841.89 - 40 + 1e-9);
    expect(p.x).toBeCloseTo((p.pageW - p.w) / 2);
    const l = placeImage(4000, 3000, "a4");
    expect([l.pageW, l.pageH]).toEqual([841.89, 595.28]);
  });
  it("A4: 작은 이미지는 키우지 않고 96dpi 기준 원래 크기로 둔다", () => {
    const p = placeImage(200, 100, "a4");
    expect([p.w, p.h]).toEqual([150, 75]);
  });
  it("이미지 비율: 쪽을 이미지 비율대로 만들어 꽉 채운다", () => {
    const p = placeImage(1000, 500, "image");
    expect(p.pageW).toBeCloseTo(841.89);
    expect(p.pageH).toBeCloseTo(420.945);
    expect([p.x, p.y, p.w, p.h]).toEqual([0, 0, p.pageW, p.pageH]);
  });
});

describe("파일 이름", () => {
  it("변환 결과 이름을 만든다", () => {
    expect(imagesPdfName(["사진.JPG"])).toBe("사진.pdf");
    expect(imagesPdfName(["a.png", "b.png"])).toBe("a-합본.pdf");
    expect(pageImageName("보고서.pdf", 3, 12, "jpg")).toBe("보고서-03.jpg");
    expect(pageImageName("a.pdf", 7, 7, "png")).toBe("a-7.png");
    expect(pagesZipName("보고서.pdf")).toBe("보고서-이미지.zip");
  });
});

describe("이미지 → PDF", () => {
  it("JPG와 PNG를 한 장에 한 쪽씩 순서대로 담는다", async () => {
    const bytes = await imagesToPdf([{ bytes: JPEG, kind: "jpg" }, { bytes: makePng(300, 600), kind: "png" }], "image", 0);
    const doc = await PDFDocument.load(bytes);
    const sizes = doc.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())]);
    expect(sizes).toEqual([[842, 421], [421, 842]]);
  });
  it("A4 모드는 모든 쪽이 A4 크기다", async () => {
    const doc = await PDFDocument.load(await imagesToPdf([{ bytes: makePng(800, 400), kind: "png" }], "a4", 20));
    expect([Math.round(doc.getPage(0).getWidth()), Math.round(doc.getPage(0).getHeight())]).toEqual([842, 595]);
  });
});

describe("ZIP 묶기", () => {
  it("CRC32를 표준대로 계산한다", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
  });
  it("파일 수·위치·한글 이름이 맞는 ZIP 구조를 만든다", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([9]);
    const zip = zipStore([{ name: "가.jpg", data: a }, { name: "b.jpg", data: b }], new Date(2026, 9, 12, 10, 30, 0));
    const v = new DataView(zip.buffer);
    const end = zip.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    const cdOffset = v.getUint32(end + 16, true);
    expect(v.getUint32(cdOffset, true)).toBe(0x02014b50);
    const nameLen = v.getUint16(30 - 4, true);
    expect(new TextDecoder().decode(zip.slice(30, 30 + nameLen))).toBe("가.jpg");
    expect(v.getUint16(6, true) & 0x0800).toBe(0x0800);
    expect(Array.from(zip.slice(30 + nameLen, 30 + nameLen + 3))).toEqual([1, 2, 3]);
    expect(v.getUint32(14, true)).toBe(crc32(a));
  });
});
