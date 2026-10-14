"use client";
import { useT } from "@/lib/useT";
import { useEffect, useState } from "react";
import { loadPdfjs } from "@/lib/tools/pdfjs";
import { compressedName, formatBytes, PDF_PRESETS, reduction, renderScale, type PdfPreset } from "@/lib/tools/fileSize";

type Mode = "image" | "clean";
type Result = { url: string; name: string; before: number; after: number; pages: number };

const MAX_BYTES = 200 * 1024 * 1024;
// 휴대폰에서 메모리가 모자라지 않도록 한 쪽을 그릴 때 캔버스 크기를 제한합니다.
const MAX_SIDE = 4096;
const MAX_PIXELS = 12_000_000;

const encrypted = (e: unknown) => {
  const n = (e as { name?: string })?.name ?? "";
  const m = (e as { message?: string })?.message ?? "";
  return n === "PasswordException" || /encrypt/i.test(n + m);
};

const toJpeg = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("jpeg"))), "image/jpeg", q));

async function rasterize(data: ArrayBuffer, preset: PdfPreset, onPage: (n: number, total: number) => void) {
  const pdfjs = await loadPdfjs();
  const { PDFDocument } = await import("pdf-lib");
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const src = await task.promise;
  const out = await PDFDocument.create();
  const { dpi, quality } = PDF_PRESETS[preset];
  try {
    for (let i = 1; i <= src.numPages; i++) {
      onPage(i, src.numPages);
      const page = await src.getPage(i);
      const size = page.getViewport({ scale: 1 }); // 회전이 반영된 쪽 크기(pt)
      let scale = renderScale(dpi);
      scale = Math.min(scale, MAX_SIDE / size.width, MAX_SIDE / size.height, Math.sqrt(MAX_PIXELS / (size.width * size.height)));
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d")!;
      // 투명한 부분이 JPEG에서 검게 나오지 않도록 흰 바탕을 먼저 칠합니다.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise;
      const jpg = await out.embedJpg(await (await toJpeg(canvas, quality)).arrayBuffer());
      out.addPage([size.width, size.height]).drawImage(jpg, { x: 0, y: 0, width: size.width, height: size.height });
      canvas.width = canvas.height = 0;
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return { bytes: await out.save(), pages: out.getPageCount() };
}

async function clean(data: ArrayBuffer) {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(data);
  return { bytes: await doc.save({ useObjectStreams: true }), pages: doc.getPageCount() };
}

export default function PdfCompressor() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("image");
  const [preset, setPreset] = useState<PdfPreset>("medium");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  // 이전 결과 파일의 임시 주소를 정리합니다.
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const run = async () => {
    if (!file) return;
    setError("");
    setResult(null);
    setBusy(t("파일을 읽는 중…", "Reading the file…"));
    try {
      const data = await file.arrayBuffer();
      const r = mode === "image"
        ? await rasterize(data, preset, (n, total) => setBusy(t(`${total}쪽 중 ${n}쪽 처리 중…`, `Processing page ${n} of ${total}…`)))
        : (setBusy(t("구조를 정리하는 중…", "Optimizing structure…")), await clean(data));
      const blob = new Blob([r.bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
      setResult({ url: URL.createObjectURL(blob), name: compressedName(file.name, t.lang), before: file.size, after: blob.size, pages: r.pages });
    } catch (e) {
      setError(encrypted(e)
        ? t("암호가 걸린 PDF는 압축할 수 없습니다. 암호를 해제한 파일로 다시 시도해 주세요.", "Password-protected PDFs can't be compressed. Remove the password and try again.")
        : t("PDF를 처리하지 못했습니다. 손상된 파일이거나 이 브라우저에서 열 수 없는 형식일 수 있습니다.", "Couldn't process this PDF. The file may be damaged or in a format this browser can't open."));
    } finally {
      setBusy("");
    }
  };

  const pick = (f: File | null) => {
    setResult(null);
    setError("");
    if (f && f.size > MAX_BYTES) {
      setFile(null);
      setError(t(`파일이 너무 큽니다. ${formatBytes(MAX_BYTES)} 이하의 PDF만 처리할 수 있습니다.`, `The file is too large. Only PDFs up to ${formatBytes(MAX_BYTES)} can be processed.`));
      return;
    }
    setFile(f);
  };

  const saved = result ? reduction(result.before, result.after) : 0;

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <span>{file ? `${file.name} (${formatBytes(file.size)})` : t("PDF 파일을 고르세요", "Choose a PDF file")}</span>
      </label>

      <h3 className="sub">{t("압축 방식", "Method")}</h3>
      <div className="seg" role="group" aria-label={t("압축 방식", "Method")}>
        <button type="button" aria-pressed={mode === "image"} onClick={() => { setMode("image"); setResult(null); }}>{t("강하게 (쪽을 이미지로)", "Strong (pages as images)")}</button>
        <button type="button" aria-pressed={mode === "clean"} onClick={() => { setMode("clean"); setResult(null); }}>{t("가볍게 (글자 유지)", "Light (keep text)")}</button>
      </div>
      {mode === "image" ? (
        <>
          <div className="seg" role="group" aria-label={t("화질", "Quality")}>
            {(Object.keys(PDF_PRESETS) as PdfPreset[]).map((k) => (
              <button key={k} type="button" aria-pressed={preset === k} onClick={() => { setPreset(k); setResult(null); }}>
                {t(PDF_PRESETS[k].label, PDF_PRESETS[k].labelEn)} · {PDF_PRESETS[k].dpi}dpi
              </button>
            ))}
          </div>
          <p className="note">{t("스캔본이나 사진이 많은 PDF에 효과가 큽니다. 대신 결과 파일에서는 글자를 선택·검색할 수 없고 링크가 사라집니다.", "Works best on scans and photo-heavy PDFs. Text in the result can no longer be selected or searched, and links are removed.")}</p>
        </>
      ) : (
        <p className="note">{t("글자와 링크를 그대로 두고 파일 구조만 정리합니다. 줄어드는 폭은 작거나 없을 수 있습니다.", "Keeps text and links and only optimizes the file structure. The size may shrink only a little, or not at all.")}</p>
      )}

      <div className="actions">
        <button type="button" className="btn sm" disabled={!file || !!busy} onClick={run}>{busy ? t("처리 중…", "Working…") : t("압축하기", "Compress")}</button>
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}</p>}
        {error && <p className="warn">{error}</p>}
        {result && (
          <>
            <div className="big">
              <span>{saved > 0 ? t("줄어든 용량", "Size reduced by") : t("용량 변화", "Size change")}</span>
              <strong>{saved > 0 ? t(`${Math.round(saved * 100)}% 감소`, `${Math.round(saved * 100)}%`) : t("줄지 않음", "No reduction")}</strong>
              <small>{formatBytes(result.before)} → {formatBytes(result.after)} · {result.pages}{t("쪽", " pages")}</small>
            </div>
            {saved <= 0 ? (
              <p className="warn">
                {t.lang === "en"
                  ? `This file is already well compressed, so ${mode === "image" ? "turning pages into images makes it bigger" : "it didn't get any smaller"}. Keep the original, or try again with ${mode === "image" ? "'Light' or a lower quality" : "'Strong'"}.`
                  : `이 파일은 이미 잘 압축되어 있어 ${mode === "image" ? "이미지로 바꾸면 오히려 커집니다" : "더 줄지 않았습니다"}. 원본을 그대로 쓰거나 ${mode === "image" ? "'가볍게' 방식이나 더 낮은 화질" : "'강하게' 방식"}로 다시 시도해 보세요.`}
              </p>
            ) : (
              <div className="actions">
                <a className="btn sm" href={result.url} download={result.name}>{t("압축한 PDF 내려받기", "Download compressed PDF")}</a>
              </div>
            )}
          </>
        )}
        <p className="note">{t("파일은 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다. 쪽수가 많거나 용량이 큰 파일은 휴대폰에서 시간이 오래 걸릴 수 있습니다.", "Files are processed only in this browser and never uploaded. Large or long files can take a while on phones.")}</p>
      </div>
    </div>
  );
}
