"use client";
import { useT } from "@/lib/useT";
import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import { move, pdfBlob } from "@/lib/tools/pdfPlan";
import {
  IMAGE_MAX_BYTES, imagesPdfName, jpegOrientation, MARGINS, MAX_IMAGES, MAX_PIXELS, MAX_SIDE, sniffImage,
  type MarginKey, type PageMode,
} from "@/lib/tools/imagePdf";
import type { PdfImage } from "@/lib/tools/pdfPages";

type Item = { id: number; file: File; preview: string; error: string };
type Result = { url: string; name: string; size: number; pages: number };

const toJpeg = (c: HTMLCanvasElement) =>
  new Promise<Uint8Array>((ok, fail) =>
    c.toBlob(async (b) => (b ? ok(new Uint8Array(await b.arrayBuffer())) : fail(new Error("jpeg"))), "image/jpeg", 0.92));

// JPG·PNG는 원본 그대로 넣고, 회전 정보가 있는 JPG나 WebP 같은 다른 형식은 브라우저로 그려 JPG로 바꿉니다.
async function prepare(file: File): Promise<PdfImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (kind === "png" || (kind === "jpg" && jpegOrientation(bytes) === 1)) return { bytes, kind };
  const bmp = await createImageBitmap(new Blob([bytes]), { imageOrientation: "from-image" });
  try {
    const s = Math.min(1, MAX_SIDE / bmp.width, MAX_SIDE / bmp.height, Math.sqrt(MAX_PIXELS / (bmp.width * bmp.height)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * s);
    canvas.height = Math.round(bmp.height * s);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // 투명한 부분이 검게 나오지 않도록
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const jpg = await toJpeg(canvas);
    canvas.width = canvas.height = 0;
    return { bytes: jpg, kind: "jpg" };
  } finally {
    bmp.close();
  }
}

export default function ImageToPdf() {
  const t = useT();
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<PageMode>("a4");
  const [margin, setMargin] = useState<MarginKey>("small");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const nextId = useRef(1);
  const previews = useRef(new Set<string>());

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    setResult(null);
    setError("");
    const picked = Array.from(list);
    const room = MAX_IMAGES - items.length;
    if (picked.length > room) setError(t(`한 번에 최대 ${MAX_IMAGES}장까지 변환할 수 있습니다.`, `You can convert up to ${MAX_IMAGES} images at once.`));
    const fresh = picked.slice(0, Math.max(0, room)).map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { id: nextId.current++, file, preview, error: file.size > IMAGE_MAX_BYTES ? t(`${formatBytes(IMAGE_MAX_BYTES)}를 넘는 이미지입니다.`, `Larger than ${formatBytes(IMAGE_MAX_BYTES)}.`) : "" };
    });
    setItems((prev) => [...prev, ...fresh]);
  };

  const update = (next: Item[]) => {
    setItems(next);
    setResult(null);
  };
  const remove = (id: number) => {
    const it = items.find((x) => x.id === id);
    if (it) { URL.revokeObjectURL(it.preview); previews.current.delete(it.preview); }
    update(items.filter((x) => x.id !== id));
  };
  const markBad = (id: number, msg: string) => setItems((prev) => prev.map((p) => (p.id === id ? { ...p, error: msg } : p)));

  const ready = items.filter((i) => !i.error);

  const run = async () => {
    if (ready.length === 0) return;
    setError("");
    setResult(null);
    try {
      const images: PdfImage[] = [];
      const used: Item[] = [];
      for (let i = 0; i < ready.length; i++) {
        setBusy(t(`${ready.length}장 중 ${i + 1}장 준비 중…`, `Preparing image ${i + 1} of ${ready.length}…`));
        try {
          images.push(await prepare(ready[i].file));
          used.push(ready[i]);
        } catch {
          markBad(ready[i].id, t("이 브라우저에서 열 수 없는 이미지입니다.", "This browser can't open this image."));
        }
      }
      if (images.length === 0) throw new Error("no images");
      setBusy(t("PDF를 만드는 중…", "Creating the PDF…"));
      const { imagesToPdf } = await import("@/lib/tools/pdfPages");
      const pt = MARGINS.find((m) => m.key === margin)!.pt;
      const blob = pdfBlob(await imagesToPdf(images, mode, mode === "a4" ? pt : 0));
      setResult({ url: URL.createObjectURL(blob), name: imagesPdfName(used.map((u) => u.file.name), t.lang), size: blob.size, pages: images.length });
    } catch {
      setError(t("PDF를 만들지 못했습니다. 이미지가 손상되었거나 이 브라우저에서 열 수 없는 형식일 수 있습니다.", "Couldn't create the PDF. An image may be damaged or in a format this browser can't open."));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp" multiple onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <span>{items.length ? t("이미지 더 추가하기", "Add more images") : t("PDF로 바꿀 이미지를 고르세요 (JPG·PNG, 여러 장 선택 가능)", "Choose images to convert (JPG, PNG; you can select several)")}</span>
      </label>

      {items.length > 0 && (
        <>
          <div className="list-head">
            <h3 className="sub">{t(`쪽 순서 (${items.length}장)`, `Page order (${items.length} images)`)}</h3>
            <button
              type="button"
              className="link"
              onClick={() => update([...items].sort((a, b) => a.file.name.localeCompare(b.file.name, "ko", { numeric: true })))}
            >
              {t("파일 이름순 정렬", "Sort by name")}
            </button>
          </div>
          <ol className="pagegrid">
            {items.map((it, i) => (
              <li key={it.id} className={it.error ? "bad" : undefined}>
                <div className="thumb">
                  <img src={it.preview} alt={it.file.name} onError={() => !it.error && markBad(it.id, t("미리보기를 열 수 없는 이미지입니다.", "This image can't be previewed."))} />
                </div>
                <span className="pno">{i + 1}<small> {formatBytes(it.file.size)}</small></span>
                <small className="tname">{it.error ? <span className="err">{it.error} {t("빼고 만듭니다.", "It will be skipped.")}</span> : it.file.name}</small>
                <span className="ctrl">
                  <button type="button" aria-label={t(`${it.file.name} 앞으로`, `Move ${it.file.name} earlier`)} disabled={i === 0} onClick={() => update(move(items, i, -1))}>←</button>
                  <button type="button" aria-label={t(`${it.file.name} 빼기`, `Remove ${it.file.name}`)} onClick={() => remove(it.id)}>✕</button>
                  <button type="button" aria-label={t(`${it.file.name} 뒤로`, `Move ${it.file.name} later`)} disabled={i === items.length - 1} onClick={() => update(move(items, i, 1))}>→</button>
                </span>
              </li>
            ))}
          </ol>

          <h3 className="sub">{t("쪽 크기", "Page size")}</h3>
          <div className="seg" role="group" aria-label={t("쪽 크기", "Page size")}>
            <button type="button" aria-pressed={mode === "a4"} onClick={() => { setMode("a4"); setResult(null); }}>{t("A4에 맞추기", "Fit to A4")}</button>
            <button type="button" aria-pressed={mode === "image"} onClick={() => { setMode("image"); setResult(null); }}>{t("사진 비율 그대로", "Same as image")}</button>
          </div>
          {mode === "a4" ? (
            <>
              <div className="seg" role="group" aria-label={t("여백", "Margin")}>
                {MARGINS.map((m) => (
                  <button key={m.key} type="button" aria-pressed={margin === m.key} onClick={() => { setMargin(m.key); setResult(null); }}>{t(`여백 ${m.label}`, `Margin: ${m.labelEn}`)}</button>
                ))}
              </div>
              <p className="note-sm">{t("사진이 가로로 길면 A4 가로, 세로로 길면 A4 세로 쪽에 비율을 지켜 가운데 놓습니다. 인쇄하거나 서류로 제출할 때 알맞습니다.", "Wide images go on landscape A4 and tall ones on portrait A4, centered with their proportions kept. Good for printing and paperwork.")}</p>
            </>
          ) : (
            <p className="note-sm">{t("쪽 크기를 사진 비율과 똑같이 만들어 여백 없이 꽉 채웁니다. 화면으로 볼 때 알맞습니다.", "Each page matches the image's proportions with no margins. Good for viewing on screen.")}</p>
          )}
        </>
      )}

      <div className="actions">
        <button type="button" className="btn sm" disabled={ready.length === 0 || !!busy} onClick={run}>
          {busy ? t("처리 중…", "Working…") : ready.length ? t(`${ready.length}장을 PDF로 만들기`, `Convert ${ready.length} images to PDF`) : t("PDF로 만들기", "Convert to PDF")}
        </button>
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}</p>}
        {error && <p className="warn">{error}</p>}
        {result && (
          <>
            <div className="big">
              <span>{t("만든 PDF", "Your PDF")}</span>
              <strong>{t(`${result.pages}쪽`, `${result.pages} pages`)}</strong>
              <small>{result.name} · {formatBytes(result.size)}</small>
            </div>
            <div className="actions">
              <a className="btn sm" href={result.url} download={result.name}>{t("PDF 내려받기", "Download PDF")}</a>
            </div>
          </>
        )}
        <p className="note">{t("이미지는 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다. JPG·PNG는 다시 압축하지 않아 화질이 그대로 유지됩니다.", "Images are processed only in this browser and never uploaded. JPG and PNG files aren't recompressed, so quality is preserved.")}</p>
      </div>
    </div>
  );
}
