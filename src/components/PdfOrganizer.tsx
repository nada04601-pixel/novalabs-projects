"use client";
import { useT } from "@/lib/useT";
import { useEffect, useRef, useState } from "react";
import { loadPdfjs } from "@/lib/tools/pdfjs";
import { formatBytes } from "@/lib/tools/fileSize";
import { move, normalizeAngle, PDF_MAX_BYTES, pdfBlob, pdfErrorMessage, pdfName, type PagePlan } from "@/lib/tools/pdfPlan";

type Result = { url: string; name: string; size: number; pages: number };

const MAX_PAGES = 500;
const THUMB_WIDTH = 160; // 미리보기 한 장의 가로 픽셀

const toJpegUrl = (c: HTMLCanvasElement) =>
  new Promise<string>((ok, fail) => c.toBlob((b) => (b ? ok(URL.createObjectURL(b)) : fail(new Error("jpeg"))), "image/jpeg", 0.7));

export default function PdfOrganizer() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [total, setTotal] = useState(0);
  const [plan, setPlan] = useState<PagePlan[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const run = useRef(0); // 새 파일을 고르면 이전 미리보기 그리기를 멈추기 위한 번호

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  useEffect(() => () => thumbs.forEach((u) => u && URL.revokeObjectURL(u)), [thumbs]);

  const renderThumbs = async (data: ArrayBuffer, id: number) => {
    const pdfjs = await loadPdfjs();
    const task = pdfjs.getDocument({ data: new Uint8Array(data) });
    try {
      const doc = await task.promise;
      for (let i = 1; i <= doc.numPages && run.current === id; i++) {
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: THUMB_WIDTH / Math.max(base.width, base.height) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise;
        const url = await toJpegUrl(canvas);
        canvas.width = canvas.height = 0;
        page.cleanup();
        if (run.current !== id) { URL.revokeObjectURL(url); break; }
        setThumbs((prev) => { const next = prev.slice(); next[i - 1] = url; return next; });
      }
    } catch {
      // 미리보기를 못 그려도 쪽 번호만으로 정리할 수 있으니 조용히 넘어갑니다.
    } finally {
      await task.destroy();
    }
  };

  const pick = async (f: File | null) => {
    const id = ++run.current;
    setResult(null);
    setError("");
    setFile(null);
    setTotal(0);
    setPlan([]);
    setThumbs([]);
    if (!f) return;
    if (f.size > PDF_MAX_BYTES) {
      setError(t(`파일이 너무 큽니다. ${formatBytes(PDF_MAX_BYTES)} 이하의 PDF만 처리할 수 있습니다.`, `The file is too large. Only PDFs up to ${formatBytes(PDF_MAX_BYTES)} can be processed.`));
      return;
    }
    setBusy(t("파일을 읽는 중…", "Reading the file…"));
    try {
      const data = await f.arrayBuffer();
      const { pageCount } = await import("@/lib/tools/pdfPages");
      const n = await pageCount(data);
      if (n > MAX_PAGES) {
        setError(t(`${MAX_PAGES}쪽이 넘는 파일은 미리보기를 그리기 어렵습니다. PDF 나누기로 먼저 나눈 뒤 정리해 주세요.`, `Files with more than ${MAX_PAGES} pages are too long to preview. Split the PDF first, then organize it.`));
        return;
      }
      setFile(f);
      setTotal(n);
      setPlan(Array.from({ length: n }, (_, index) => ({ index, rotate: 0 })));
      renderThumbs(data, id);
    } catch (e) {
      setError(pdfErrorMessage(e, t.lang));
    } finally {
      setBusy("");
    }
  };

  const update = (next: PagePlan[]) => {
    setPlan(next);
    setResult(null);
  };
  const rotateAt = (i: number, d: number) => update(plan.map((p, k) => (k === i ? { ...p, rotate: normalizeAngle(p.rotate + d) } : p)));
  const rotateAll = (d: number) => update(plan.map((p) => ({ ...p, rotate: normalizeAngle(p.rotate + d) })));
  const changed = plan.length !== total || plan.some((p, i) => p.index !== i || p.rotate);

  const save = async () => {
    if (!file || plan.length === 0) return;
    setError("");
    setResult(null);
    setBusy(t("새 PDF를 만드는 중…", "Creating the new PDF…"));
    try {
      const { arrangePdf } = await import("@/lib/tools/pdfPages");
      const blob = pdfBlob(await arrangePdf(await file.arrayBuffer(), plan));
      setResult({ url: URL.createObjectURL(blob), name: pdfName(file.name, t("정리", "organized"), t.lang), size: blob.size, pages: plan.length });
    } catch (e) {
      setError(pdfErrorMessage(e, t.lang));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <span>{file ? `${file.name} (${formatBytes(file.size)})` : t("정리할 PDF 파일을 고르세요", "Choose a PDF file to organize")}</span>
      </label>

      {file && (
        <>
          <div className="list-head">
            <h3 className="sub">{t(`쪽 ${plan.length}개`, `${plan.length} pages`)}</h3>
            <span className="actions top">
              <button type="button" className="link" onClick={() => rotateAll(-90)}>{t("모두 왼쪽으로", "Rotate all left")} ↺</button>
              <button type="button" className="link" onClick={() => rotateAll(90)}>{t("모두 오른쪽으로", "Rotate all right")} ↻</button>
              <button type="button" className="link" onClick={() => update(Array.from({ length: total }, (_, index) => ({ index, rotate: 0 })))}>{t("처음 상태로", "Reset")}</button>
            </span>
          </div>
          {plan.length === 0 ? (
            <p className="warn">{t("모든 쪽을 지웠습니다. 남길 쪽이 하나는 있어야 합니다. '처음 상태로'를 누르면 되돌릴 수 있습니다.", "All pages were deleted. Keep at least one page. Press 'Reset' to undo.")}</p>
          ) : (
            <ol className="pagegrid">
              {plan.map((p, i) => (
                <li key={p.index}>
                  <div className="thumb">
                    {thumbs[p.index]
                      ? <img src={thumbs[p.index]} alt={t(`원본 ${p.index + 1}쪽`, `Original page ${p.index + 1}`)} style={{ transform: `rotate(${p.rotate}deg)` }} />
                      : <span className="note-sm">{t("불러오는 중", "Loading")}</span>}
                  </div>
                  <span className="pno">{i + 1}<small> {t(`(원본 ${p.index + 1}쪽)`, `(original page ${p.index + 1})`)}</small></span>
                  <span className="ctrl">
                    <button type="button" aria-label={t(`${i + 1}번째 쪽 앞으로`, `Move page ${i + 1} earlier`)} disabled={i === 0} onClick={() => update(move(plan, i, -1))}>←</button>
                    <button type="button" aria-label={t(`${i + 1}번째 쪽 왼쪽으로 돌리기`, `Rotate page ${i + 1} left`)} onClick={() => rotateAt(i, -90)}>↺</button>
                    <button type="button" aria-label={t(`${i + 1}번째 쪽 오른쪽으로 돌리기`, `Rotate page ${i + 1} right`)} onClick={() => rotateAt(i, 90)}>↻</button>
                    <button type="button" aria-label={t(`${i + 1}번째 쪽 지우기`, `Delete page ${i + 1}`)} onClick={() => update(plan.filter((_, k) => k !== i))}>✕</button>
                    <button type="button" aria-label={t(`${i + 1}번째 쪽 뒤로`, `Move page ${i + 1} later`)} disabled={i === plan.length - 1} onClick={() => update(move(plan, i, 1))}>→</button>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <div className="actions">
        <button type="button" className="btn sm" disabled={!file || plan.length === 0 || !changed || !!busy} onClick={save}>
          {busy ? t("처리 중…", "Working…") : t("정리한 PDF 만들기", "Create organized PDF")}
        </button>
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}</p>}
        {error && <p className="warn">{error}</p>}
        {result && (
          <>
            <div className="big">
              <span>{t("정리한 파일", "Organized file")}</span>
              <strong>{t(`${result.pages}쪽`, `${result.pages} pages`)}</strong>
              <small>{result.name} · {formatBytes(result.size)}</small>
            </div>
            <div className="actions">
              <a className="btn sm" href={result.url} download={result.name}>{t("정리한 PDF 내려받기", "Download organized PDF")}</a>
            </div>
          </>
        )}
        <p className="note">{t("파일은 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다. 화살표로 순서를 바꾸고, ↺ ↻로 돌리고, ✕로 지운 뒤 새 PDF를 만드세요.", "Files are processed only in this browser and never uploaded. Reorder with the arrows, rotate with ↺ ↻, delete with ✕, then create the new PDF.")}</p>
      </div>
    </div>
  );
}

