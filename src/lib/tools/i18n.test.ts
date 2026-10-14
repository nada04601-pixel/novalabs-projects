import { describe, expect, it } from "vitest";
import { langOf, switchPath } from "../i18n";
import { compressedName } from "./fileSize";
import { imagesPdfName, pagesZipName } from "./imagePdf";
import { strength } from "./password";
import { groupLabel, parsePageRanges, splitZipName } from "./pdfPlan";
import { trimError, editedName } from "./videoEdit";
import { cleanedName } from "./watermark";
import { checkUpscale, upscaledName } from "./upscale";

describe("다국어", () => {
  it("경로로 언어를 정한다", () => {
    expect(langOf("/en")).toBe("en");
    expect(langOf("/en/tools/pdf-merge")).toBe("en");
    expect(langOf("/english")).toBe("ko");
    expect(langOf("/tools/pdf-merge")).toBe("ko");
  });
  it("언어 전환 주소: 영어 버전이 있는 도구는 짝으로, 없으면 영어 홈으로", () => {
    expect(switchPath("/tools/pdf-merge", "en")).toBe("/en/tools/pdf-merge");
    expect(switchPath("/tools/net-salary", "en")).toBe("/en");
    expect(switchPath("/lotto", "en")).toBe("/en");
    expect(switchPath("/en/tools/pdf-merge", "ko")).toBe("/tools/pdf-merge");
    expect(switchPath("/en", "ko")).toBe("/");
  });
  it("영어 파일 이름과 문구", () => {
    expect(compressedName("report.pdf", "en")).toBe("report-compressed.pdf");
    expect(imagesPdfName(["a.jpg", "b.jpg"], "en")).toBe("a-combined.pdf");
    expect(pagesZipName("doc.pdf", "en")).toBe("doc-images.zip");
    expect(splitZipName("doc.pdf", "en")).toBe("doc-split.zip");
    expect(groupLabel([1, 2, 3], "en")).toBe("p1-3");
    expect(groupLabel([5])).toBe("5쪽");
    expect(cleanedName("a.png", "png", "en")).toBe("a-no-watermark.png");
    expect(upscaledName("", 4, "png", "en")).toBe("image-4x.png");
    expect(editedName("", "trimmed", "mp4", "en")).toBe("video-trimmed.mp4");
    expect(strength(100, "en").label).toBe("Very strong");
    expect(parsePageRanges("9", 3, "en")).toEqual({ ok: false, error: "There is no page 9. This file has pages 1-3." });
    expect(trimError(null, 3, 10, "en")).toBe("Enter the start time like 1:23.5.");
    expect(checkUpscale(1000, 600, 4, "ai", "en")).toMatch(/^AI mode at 4x/);
  });
});
