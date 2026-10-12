// 브라우저에서 PDF 쪽을 그릴 때 쓰는 pdf.js를 필요할 때만 불러오고 작업 스레드(worker) 주소를 맞춥니다.
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}
