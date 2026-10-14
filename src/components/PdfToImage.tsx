"use client";
import { useT } from "@/lib/useT";
import { useEffect, useRef, useState } from "react";
import { formatBytes, renderScale } from "@/lib/tools/fileSize";
import { groupLabel, parsePageRanges, PDF_MAX_BYTES, pdfErrorMessage } from "@/lib/tools/pdfPlan";
import { MAX_PIXELS, MAX_SIDE, pageImageName, pagesZipName, RENDER_PRESETS, type RenderPreset } from "@/lib/tools/imagePdf";
import { loadPdfjs } from "@/lib/tools/pdfjs";
import { zipStore } from "@/lib/tools/zip";

type Format = "jpg" | "png";
type Output = { page: number; url: string; name: string; blob: Blob };

const MAX_OUTPUT = 200;

const toBlob = (c: HTMLCanvasElement, f: Format) =>
  new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("encode"))), f === "jpg" ? "image/jpeg" : "image/png", 0.9));

export default function PdfToImage() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [total, setTotal] = useState(0);
  const [format, setFormat] = useState<Format>("jpg");
  const [preset, setPreset] = useState<RenderPreset>("sharp");
  const [range, setRange] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [zip, setZip] = useState<{ url: string; name: string; size: number } | null>(null);
  const run = useRef(0);
  // 쪽 이미지는 한 장씩 늘어나므로 목록이 바뀔 때마다 지우지 않고, 새로 시작하거나 페이지를 떠날 때 한꺼번에 정리합니다.
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  useEffect(() => () => { if (zip) URL.revokeObjectURL(zip.url); }, [zip]);

  const reset = () => {
    run.current++;
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setOutputs([]);
    setZip(null);
  };

  const pick = async (f: File | null) => {
    reset();
    setError("");
    setFile(null);
    setTotal(0);
    setRange("");
    if (!f) return;
    if (f.size > PDF_MAX_BYTES) {
      setError(t(`파일이 너무 큽니다. ${formatBytes(PDF_MAX_BYTES)} 이하의 PDF만 처리할 수 있습니다.`, `The file is too large. Only PDFs up to ${formatBytes(PDF_MAX_BYTES)} can be processed.`));
      return;
    }
    setBusy(t("파일을 읽는 중…", "Reading the file…"));
    try {
      const { pageCount } = await import("@/lib/tools/pdfPages");
      const n = await pageCount(await f.arrayBuffer());
      setFile(f);
      setTotal(n);
    } catch (e) {
      setError(pdfErrorMessage(e, t.lang));
    } finally {
      setBusy("");
    }
  };

  // 비워 두면 모든 쪽, 입력하면 그 쪽만 바꿉니다. 같은 쪽을 두 번 적어도 한 번만 바꿉니다.
  const plan = (() => {
    if (!total) return null;
    if (!range.trim()) return { ok: true as const, pages: Array.from({ length: total }, (_, i) => i + 1) };
    const r = parsePageRanges(range, total, t.lang);
    return r.ok ? { ok: true as const, pages: [...new Set(r.groups.flat())] } : r;
  })();
  const tooMany = plan?.ok ? plan.pages.length > MAX_OUTPUT : false;

  const convert = async () => {
    if (!file || !plan?.ok || tooMany) return;
    reset();
    const id = run.current;
    setError("");
    setBusy(t("변환을 준비하는 중…", "Preparing…"));
    const made: Output[] = [];
    let task: { promise: Promise<import("pdfjs-dist").PDFDocumentProxy>; destroy: () => Promise<void> } | null = null;
    try {
      const pdfjs = await loadPdfjs();
      task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
      const doc = await task.promise;
      const { dpi } = RENDER_PRESETS[preset];
      for (let k = 0; k < plan.pages.length && run.current === id; k++) {
        const n = plan.pages[k];
        setBusy(t(`${plan.pages.length}쪽 중 ${k + 1}쪽 변환 중…`, `Converting page ${k + 1} of ${plan.pages.length}…`));
        const page = await doc.getPage(n);
        const size = page.getViewport({ scale: 1 });
        const scale = Math.min(renderScale(dpi), MAX_SIDE / size.width, MAX_SIDE / size.height, Math.sqrt(MAX_PIXELS / (size.width * size.height)));
        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext("2d")!;
        if (format === "jpg") {
          ctx.fillStyle = "#fff"; // JPG는 투명을 담지 못하므로 흰 바탕을 깝니다.
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise;
        const blob = await toBlob(canvas, format);
        canvas.width = canvas.height = 0;
        page.cleanup();
        const o = { page: n, url: URL.createObjectURL(blob), name: pageImageName(file.name, n, total, format), blob };
        if (run.current !== id) { URL.revokeObjectURL(o.url); break; }
        urls.current.push(o.url);
        made.push(o);
        setOutputs([...made]);
      }
    } catch (e) {
      if (run.current === id) setError(pdfErrorMessage(e, t.lang));
    } finally {
      await task?.destroy();
      if (run.current === id) setBusy("");
    }
  };

  const makeZip = async () => {
    if (!file || outputs.length === 0) return;
    setBusy(t("ZIP 파일로 묶는 중…", "Creating ZIP…"));
    try {
      const entries = await Promise.all(outputs.map(async (o) => ({ name: o.name, data: new Uint8Array(await o.blob.arrayBuffer()) })));
      const blob = new Blob([zipStore(entries)], { type: "application/zip" });
      setZip({ url: URL.createObjectURL(blob), name: pagesZipName(file.name, t.lang), size: blob.size });
    } catch {
      setError(t("ZIP 파일을 만들지 못했습니다. 메모리가 부족할 수 있으니 쪽 범위를 줄여 다시 시도해 주세요.", "Couldn't create the ZIP file. The device may be low on memory - try a smaller page range."));
    } finally {
      setBusy("");
    }
  };

  const done = !busy && plan?.ok && outputs.length === plan.pages.length && outputs.length > 0;

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <span>{file ? t(`${file.name} (${formatBytes(file.size)} · ${total}쪽)`, `${file.name} (${formatBytes(file.size)} · ${total} pages)`) : t("이미지로 바꿀 PDF 파일을 고르세요", "Choose a PDF file to convert")}</span>
      </label>

      {file && (
        <>
          <h3 className="sub">{t("이미지 형식", "Image format")}</h3>
          <div className="seg" role="group" aria-label={t("이미지 형식", "Image format")}>
            <button type="button" aria-pressed={format === "jpg"} onClick={() => { setFormat("jpg"); reset(); }}>{t("JPG (용량 작게)", "JPG (smaller)")}</button>
            <button type="button" aria-pressed={format === "png"} onClick={() => { setFormat("png"); reset(); }}>{t("PNG (글자 또렷하게)", "PNG (crisp text)")}</button>
          </div>
          <div className="seg" role="group" aria-label={t("화질", "Quality")}>
            {(Object.keys(RENDER_PRESETS) as RenderPreset[]).map((k) => (
              <button key={k} type="button" aria-pressed={preset === k} onClick={() => { setPreset(k); reset(); }}>
                {t(RENDER_PRESETS[k].label, RENDER_PRESETS[k].labelEn)} · {RENDER_PRESETS[k].dpi}dpi
              </button>
            ))}
          </div>
          <label>
            {t(`바꿀 쪽 (비워 두면 전체 ${total}쪽)`, `Pages to convert (leave empty for all ${total})`)}
            <input value={range} placeholder={t("예: 1-3, 5", "e.g. 1-3, 5")} onChange={(e) => { setRange(e.target.value); reset(); }} />
          </label>
          <p className="note-sm">
            {plan?.ok
              ? t(`이미지 ${plan.pages.length}장이 만들어집니다`, `${plan.pages.length} images will be created`) +
                (range.trim() ? `: ${groupLabel(plan.pages.slice(0, 12), t.lang)}${plan.pages.length > 12 ? " …" : ""}` : ".")
              : plan?.error}
          </p>
          {tooMany && <p className="warn">{t(`한 번에 ${MAX_OUTPUT}쪽까지 바꿀 수 있습니다. 쪽 범위를 나눠서 변환해 주세요.`, `Up to ${MAX_OUTPUT} pages can be converted at once. Convert in several ranges.`)}</p>}
        </>
      )}

      <div className="actions">
        <button type="button" className="btn sm" disabled={!plan?.ok || tooMany || !!busy} onClick={convert}>
          {busy ? t("처리 중…", "Working…") : t(`${format.toUpperCase()}로 변환하기`, `Convert to ${format.toUpperCase()}`)}
        </button>
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}</p>}
        {error && <p className="warn">{error}</p>}
        {done && (
          <div className="actions">
            {zip
              ? <a className="btn sm" href={zip.url} download={zip.name}>{t("ZIP 내려받기", "Download ZIP")} ({formatBytes(zip.size)})</a>
              : <button type="button" className="btn sm" onClick={makeZip}>{t(`${outputs.length}장 모두 ZIP으로 묶기`, `Bundle all ${outputs.length} as ZIP`)}</button>}
          </div>
        )}
        {outputs.length > 0 && (
          <ol className="pagegrid">
            {outputs.map((o) => (
              <li key={o.url}>
                <div className="thumb"><img src={o.url} alt={t(`${o.page}쪽`, `Page ${o.page}`)} /></div>
                <span className="pno">{t(`${o.page}쪽`, `Page ${o.page}`)}<small> {formatBytes(o.blob.size)}</small></span>
                <a className="btn sm" href={o.url} download={o.name}>{t("내려받기", "Download")}</a>
              </li>
            ))}
          </ol>
        )}
        <p className="note">{t("파일은 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다. 쪽수가 많거나 인쇄용 화질을 고르면 휴대폰에서 시간이 오래 걸릴 수 있습니다.", "Files are processed only in this browser and never uploaded. Many pages or print quality can take a while on phones.")}</p>
      </div>
    </div>
  );
}
