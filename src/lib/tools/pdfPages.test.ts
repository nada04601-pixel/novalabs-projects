import { describe, expect, it } from "vitest";
import { degrees, PDFDocument } from "pdf-lib";
import { arrangePdf, mergePdfs, splitPdf } from "./pdfPages";
import { chunkPages, groupLabel, isEncryptedError, move, normalizeAngle, parsePageRanges, pdfName } from "./pdfPlan";

// 쪽마다 폭을 다르게 만들어(100, 101, …) 어느 쪽이 어디로 갔는지 확인합니다.
async function makePdf(pages: number, startWidth = 100) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([startWidth + i, 200]);
  return doc.save();
}
const widths = async (bytes: Uint8Array) =>
  (await PDFDocument.load(bytes)).getPages().map((p) => p.getWidth());
const rotations = async (bytes: Uint8Array) =>
  (await PDFDocument.load(bytes)).getPages().map((p) => p.getRotation().angle);

describe("쪽 번호 입력 해석", () => {
  it("범위·단일 쪽·열린 범위를 묶음으로 바꾼다", () => {
    expect(parsePageRanges("1-3, 5, 8-", 10)).toEqual({ ok: true, groups: [[1, 2, 3], [5], [8, 9, 10]] });
    expect(parsePageRanges("-2", 5)).toEqual({ ok: true, groups: [[1, 2]] });
  });
  it("물결표·공백·전각 쉼표도 받아들이고 거꾸로 쓴 범위는 역순으로 뽑는다", () => {
    expect(parsePageRanges(" 2 ~ 4 ，6", 6)).toEqual({ ok: true, groups: [[2, 3, 4], [6]] });
    expect(parsePageRanges("4-2", 5)).toEqual({ ok: true, groups: [[4, 3, 2]] });
  });
  it("없는 쪽과 잘못된 형식은 오류를 낸다", () => {
    expect(parsePageRanges("", 3).ok).toBe(false);
    expect(parsePageRanges("0", 3).ok).toBe(false);
    expect(parsePageRanges("2-9", 3)).toEqual({ ok: false, error: "9쪽은 없습니다. 이 파일은 1~3쪽입니다." });
    expect(parsePageRanges("a", 3).ok).toBe(false);
    expect(parsePageRanges("-", 3).ok).toBe(false);
  });
});

describe("나누기 보조 함수", () => {
  it("n쪽씩 나누고 마지막 묶음은 남은 쪽만 담는다", () => {
    expect(chunkPages(7, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    expect(chunkPages(2, 0)).toEqual([[1], [2]]);
  });
  it("묶음 이름표와 파일 이름을 만든다", () => {
    expect(groupLabel([5])).toBe("5쪽");
    expect(groupLabel([1, 2, 3])).toBe("1-3쪽");
    expect(groupLabel([1, 3])).toBe("1,3쪽");
    expect(pdfName("보고서.PDF", "1-3쪽")).toBe("보고서-1-3쪽.pdf");
    expect(pdfName(".pdf", "합본")).toBe("문서-합본.pdf");
  });
  it("각도를 90도 단위로 0~270 사이에 맞추고 순서를 한 칸씩 옮긴다", () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
    expect(move(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(move(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
  it("암호 관련 오류를 알아본다", () => {
    expect(isEncryptedError({ name: "EncryptedPDFError" })).toBe(true);
    expect(isEncryptedError(new Error("Input document to `PDFDocument.load` is encrypted."))).toBe(true);
    expect(isEncryptedError(new Error("Failed to parse"))).toBe(false);
  });
});

describe("PDF 처리", () => {
  it("여러 파일을 받은 순서대로 합친다", async () => {
    const merged = await mergePdfs([await makePdf(2, 100), await makePdf(3, 200)]);
    expect(await widths(merged)).toEqual([100, 101, 200, 201, 202]);
  });
  it("묶음마다 별도 파일로 나눈다", async () => {
    const [a, b] = await splitPdf(await makePdf(5), [[1, 2], [5, 3]]);
    expect(await widths(a)).toEqual([100, 101]);
    expect(await widths(b)).toEqual([104, 102]);
  });
  it("같은 쪽을 여러 번 넣으면 각각 별도 쪽으로 들어간다", async () => {
    const [a] = await splitPdf(await makePdf(2), [[1, 1, 2]]);
    const doc = await PDFDocument.load(a);
    expect(doc.getPages().map((p) => p.getWidth())).toEqual([100, 100, 101]);
    expect(new Set(doc.getPages().map((p) => p.ref.toString())).size).toBe(3);
  });
  it("페이지 정리: 순서 변경·삭제·회전을 반영하고 기존 회전에 더한다", async () => {
    const doc = await PDFDocument.load(await makePdf(3));
    doc.getPage(2).setRotation(degrees(90));
    const out = await arrangePdf(await doc.save(), [
      { index: 2, rotate: 270 },
      { index: 0, rotate: 90 },
    ]);
    expect(await widths(out)).toEqual([102, 100]);
    expect(await rotations(out)).toEqual([0, 90]);
  });
  it("모든 쪽을 지우면 오류를 낸다", async () => {
    await expect(arrangePdf(await makePdf(1), [])).rejects.toThrow();
  });
});
