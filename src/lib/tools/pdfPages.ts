// PDF 합치기·나누기·페이지 정리를 pdf-lib로 처리합니다. 화면 코드에서는 동적으로 불러 첫 로딩을 가볍게 합니다.
import { degrees, PDFDocument } from "pdf-lib";
import { normalizeAngle, type PagePlan } from "./pdfPlan";

export const loadPdf = (data: ArrayBuffer | Uint8Array) => PDFDocument.load(data, { updateMetadata: false });

export async function pageCount(data: ArrayBuffer | Uint8Array) {
  return (await loadPdf(data)).getPageCount();
}

// 여러 PDF를 받은 순서대로 이어 붙입니다.
export async function mergePdfs(files: (ArrayBuffer | Uint8Array)[]) {
  const out = await PDFDocument.create();
  for (const data of files) {
    const src = await loadPdf(data);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

// 원본에서 지정한 쪽(1부터)만 순서대로 담은 새 PDF를 만듭니다.
export async function extractPages(src: PDFDocument, pages: number[]) {
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pages.map((p) => p - 1));
  copied.forEach((p) => out.addPage(p));
  return out.save();
}

export async function splitPdf(data: ArrayBuffer | Uint8Array, groups: number[][]) {
  const src = await loadPdf(data);
  const results: Uint8Array[] = [];
  for (const g of groups) results.push(await extractPages(src, g));
  return results;
}

export async function arrangePdf(data: ArrayBuffer | Uint8Array, plan: PagePlan[]) {
  if (plan.length === 0) throw new Error("no pages");
  const src = await loadPdf(data);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, plan.map((p) => p.index));
  copied.forEach((page, i) => {
    const extra = normalizeAngle(plan[i].rotate);
    if (extra) page.setRotation(degrees(normalizeAngle(page.getRotation().angle + extra)));
    out.addPage(page);
  });
  return out.save();
}
