"use client";
import { useT } from "@/lib/useT";
import { useEffect, useRef, useState } from "react";
import { formatBytes, reduction } from "@/lib/tools/fileSize";
import {
  CONVERT_MAX_BYTES, CONVERT_MAX_FILES, convertedName, convertZipName, findQuality, isHeic, OUTPUT_FORMATS, outputSize, parseTargetSize,
  type OutputFormat, type Resize, type ResizeMode,
} from "@/lib/tools/imageConvert";
import { uniqueNames, zipStore } from "@/lib/tools/zip";

type Item = { id: number; file: File; error: string };
type Output = { id: number; url: string; name: string; blob: Blob; before: number; w: number; h: number; kept: boolean; overTarget: boolean };

const encode = (c: HTMLCanvasElement, mime: string, q?: number) =>
  new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("encode"))), mime, q));

const n = (v: number) => v.toLocaleString("ko-KR");

export default function ImageConverter() {
  const t = useT();
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<OutputFormat>("jpg");
  const [quality, setQuality] = useState(80);
  const [useTarget, setUseTarget] = useState(false);
  const [target, setTarget] = useState("500KB");
  const [resizeMode, setResizeMode] = useState<ResizeMode>("none");
  const [percent, setPercent] = useState(50);
  const [longSide, setLongSide] = useState(1920);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [zip, setZip] = useState<{ url: string; name: string; size: number } | null>(null);
  const nextId = useRef(1);
  const cancel = useRef(false);

  useEffect(() => () => outputs.forEach((o) => URL.revokeObjectURL(o.url)), [outputs]);
  useEffect(() => () => { if (zip) URL.revokeObjectURL(zip.url); }, [zip]);

  const lossy = OUTPUT_FORMATS[format].lossy;
  const targetBytes = lossy && useTarget ? parseTargetSize(target) : null;
  const targetBad = lossy && useTarget && targetBytes === null;
  const resize: Resize = { mode: resizeMode, value: resizeMode === "percent" ? percent : resizeMode === "long" ? longSide : 0 };
  const resizeBad = (resizeMode === "percent" && !(percent >= 1 && percent <= 100)) || (resizeMode === "long" && !(longSide >= 16));

  const reset = () => { setOutputs([]); setZip(null); };

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    reset();
    setError("");
    const picked = Array.from(list);
    const room = CONVERT_MAX_FILES - items.length;
    if (picked.length > room) setError(t(`한 번에 최대 ${CONVERT_MAX_FILES}장까지 변환할 수 있습니다.`, `You can convert up to ${CONVERT_MAX_FILES} images at once.`));
    const fresh = picked.slice(0, Math.max(0, room)).map((file) => ({
      id: nextId.current++, file,
      error: file.size > CONVERT_MAX_BYTES ? t(`${formatBytes(CONVERT_MAX_BYTES)}를 넘는 이미지입니다.`, `Larger than ${formatBytes(CONVERT_MAX_BYTES)}.`) : "",
    }));
    setItems((prev) => [...prev, ...fresh]);
  };
  const remove = (id: number) => { setItems(items.filter((x) => x.id !== id)); reset(); };
  const markBad = (id: number, msg: string) => setItems((prev) => prev.map((p) => (p.id === id ? { ...p, error: msg } : p)));

  const ready = items.filter((i) => !i.error);

  // 한 장을 변환합니다. 같은 형식이고 크기도 그대로인데 결과가 원본보다 크면 원본을 그대로 돌려줍니다.
  const convertOne = async (it: Item, name: string): Promise<Output> => {
    const bmp = await createImageBitmap(it.file, { imageOrientation: "from-image" });
    const canvas = document.createElement("canvas");
    try {
      const size = outputSize(bmp.width, bmp.height, resize);
      canvas.width = size.w;
      canvas.height = size.h;
      const ctx = canvas.getContext("2d")!;
      if (format === "jpg") {
        ctx.fillStyle = "#fff"; // JPG는 투명도가 없어 투명한 부분이 검게 나오지 않도록
        ctx.fillRect(0, 0, size.w, size.h);
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, size.w, size.h);
      const mime = OUTPUT_FORMATS[format].mime;
      let blob: Blob;
      let overTarget = false;
      if (!lossy) blob = await encode(canvas, mime);
      else if (targetBytes) {
        let last: Blob | null = null;
        const found = await findQuality(async (q) => (last = await encode(canvas, mime, q)).size, targetBytes);
        blob = last && (last as Blob).size === found.size ? last : await encode(canvas, mime, found.quality);
        overTarget = !found.fits;
      } else blob = await encode(canvas, mime, quality / 100);
      if (blob.type !== mime) throw new Error("unsupported");
      const sameKind = it.file.type === mime;
      const kept = sameKind && size.w === bmp.width && size.h === bmp.height && blob.size >= it.file.size && !targetBytes;
      if (kept) blob = it.file;
      return { id: it.id, url: URL.createObjectURL(blob), name, blob, before: it.file.size, w: size.w, h: size.h, kept, overTarget: overTarget || (!!targetBytes && blob.size > targetBytes) };
    } finally {
      bmp.close();
      canvas.width = canvas.height = 0;
    }
  };

  const run = async () => {
    if (ready.length === 0 || targetBad || resizeBad) return;
    setError("");
    reset();
    cancel.current = false;
    const names = uniqueNames(ready.map((i) => convertedName(i.file.name, format, t.lang)));
    const done: Output[] = [];
    try {
      for (let i = 0; i < ready.length; i++) {
        if (cancel.current) break;
        setBusy(t(`${ready.length}장 중 ${i + 1}장 변환 중…`, `Converting image ${i + 1} of ${ready.length}…`));
        try {
          done.push(await convertOne(ready[i], names[i]));
          setOutputs([...done]);
        } catch (e) {
          const heic = isHeic(new Uint8Array(await ready[i].file.slice(0, 16).arrayBuffer()));
          markBad(ready[i].id, (e as Error).message === "unsupported"
            ? t(`이 브라우저는 ${OUTPUT_FORMATS[format].label}로 저장하지 못합니다. 다른 형식을 고르세요.`, `This browser can't save as ${OUTPUT_FORMATS[format].label}. Choose another format.`)
            : heic
              ? t("이 브라우저는 HEIC 사진을 열지 못합니다. 아이폰·맥의 Safari에서 열거나, 아이폰 설정 > 카메라 > 포맷에서 '높은 호환성'을 고르세요.", "This browser can't open HEIC photos. Open this page in Safari on iPhone or Mac, or set iPhone Settings > Camera > Formats to 'Most Compatible'.")
              : t("이 브라우저에서 열 수 없는 이미지입니다.", "This browser can't open this image."));
        }
      }
      if (done.length === 0) setError(t("변환한 이미지가 없습니다. 파일이 손상되었거나 이 브라우저에서 열 수 없는 형식일 수 있습니다.", "No images were converted. The files may be damaged or in a format this browser can't open."));
    } finally {
      setBusy("");
    }
  };

  const makeZip = async () => {
    const entries = await Promise.all(outputs.map(async (o) => ({ name: o.name, data: new Uint8Array(await o.blob.arrayBuffer()) })));
    const blob = new Blob([zipStore(entries)], { type: "application/zip" });
    setZip({ url: URL.createObjectURL(blob), name: convertZipName(t.lang), size: blob.size });
  };

  const before = outputs.reduce((s, o) => s + o.before, 0);
  const after = outputs.reduce((s, o) => s + o.blob.size, 0);
  const pct = (r: number) => `${Math.abs(Math.round(r * 100))}%`;
  const change = (b: number, a: number) => {
    const r = reduction(b, a);
    return r >= 0 ? t(`${pct(r)} 줄어듦`, `${pct(r)} smaller`) : t(`${pct(r)} 커짐`, `${pct(r)} larger`);
  };

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="image/*,.heic,.heif" multiple onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <span>{items.length ? t("이미지 더 추가하기", "Add more images") : t("변환할 이미지를 고르세요 (JPG·PNG·WebP·GIF·BMP, 여러 장 선택 가능)", "Choose images (JPG, PNG, WebP, GIF, BMP; you can select several)")}</span>
      </label>

      {items.length > 0 && (
        <>
          <ul className="filelist">
            {items.map((it) => (
              <li key={it.id} className={it.error ? "bad" : undefined}>
                <span className="fname">
                  <b>{it.file.name}</b>
                  <small>{formatBytes(it.file.size)}</small>
                  {it.error && <small className="err">{it.error} {t("빼고 변환합니다.", "It will be skipped.")}</small>}
                </span>
                <button type="button" className="link" aria-label={t(`${it.file.name} 빼기`, `Remove ${it.file.name}`)} onClick={() => remove(it.id)}>✕</button>
              </li>
            ))}
          </ul>

          <h3 className="sub">{t("저장 형식", "Output format")}</h3>
          <div className="seg" role="group" aria-label={t("저장 형식", "Output format")}>
            {(Object.keys(OUTPUT_FORMATS) as OutputFormat[]).map((k) => (
              <button key={k} type="button" aria-pressed={format === k} onClick={() => { setFormat(k); reset(); }}>{OUTPUT_FORMATS[k].label}</button>
            ))}
          </div>
          <p className="note-sm">
            {format === "jpg" && t("사진에 알맞고 어디서나 열립니다. 투명한 부분은 흰색이 됩니다.", "Best for photos and opens everywhere. Transparent areas become white.")}
            {format === "webp" && t("같은 화질에서 JPG보다 보통 25~35% 작고 투명도도 유지합니다. 웹사이트·블로그용으로 알맞습니다.", "Usually 25–35% smaller than JPG at the same quality and keeps transparency. Good for websites and blogs.")}
            {format === "png" && t("화질 손실이 없고 투명도를 유지합니다. 글자·캡처 화면에 알맞지만 사진은 용량이 커집니다.", "Lossless and keeps transparency. Good for text and screenshots, but photos get large.")}
          </p>

          {lossy && (
            <>
              <h3 className="sub">{t("용량", "Size")}</h3>
              <div className="seg" role="group" aria-label={t("용량 정하는 방법", "How to set the size")}>
                <button type="button" aria-pressed={!useTarget} onClick={() => { setUseTarget(false); reset(); }}>{t("화질로 정하기", "By quality")}</button>
                <button type="button" aria-pressed={useTarget} onClick={() => { setUseTarget(true); reset(); }}>{t("목표 용량 이하로", "Under a target size")}</button>
              </div>
              {useTarget ? (
                <label>{t("장당 최대 용량 (예: 200KB, 1MB)", "Max size per image (e.g. 200KB, 1MB)")}
                  <input value={target} inputMode="text" onChange={(e) => { setTarget(e.target.value); reset(); }} />
                  {targetBad && <small className="err">{t("200KB나 1.5MB처럼 1KB 이상으로 적어 주세요.", "Enter at least 1KB, like 200KB or 1.5MB.")}</small>}
                </label>
              ) : (
                <label>{t(`화질: ${quality}%`, `Quality: ${quality}%`)}
                  <input type="range" min={10} max={100} step={5} value={quality} onChange={(e) => { setQuality(Number(e.target.value)); reset(); }} />
                </label>
              )}
              <p className="note-sm">{useTarget
                ? t("용량 제한이 있는 서류 제출·쇼핑몰 업로드에 쓰세요. 정한 용량 안에서 가장 좋은 화질을 찾습니다. 화질을 가장 낮춰도 넘으면 크기 조절을 함께 쓰세요.", "Use this for upload limits on forms or marketplaces. It finds the best quality that fits. If even the lowest quality is too big, also reduce the dimensions.")
                : t("70~85%면 눈으로 차이를 느끼기 어렵고 용량은 크게 줄어듭니다.", "70–85% usually looks the same to the eye while cutting the size a lot.")}</p>
            </>
          )}

          <h3 className="sub">{t("크기 조절", "Resize")}</h3>
          <div className="seg" role="group" aria-label={t("크기 조절", "Resize")}>
            <button type="button" aria-pressed={resizeMode === "none"} onClick={() => { setResizeMode("none"); reset(); }}>{t("그대로", "Keep")}</button>
            <button type="button" aria-pressed={resizeMode === "percent"} onClick={() => { setResizeMode("percent"); reset(); }}>{t("비율(%)", "Percent")}</button>
            <button type="button" aria-pressed={resizeMode === "long"} onClick={() => { setResizeMode("long"); reset(); }}>{t("긴 변(px)", "Long side (px)")}</button>
          </div>
          {resizeMode === "percent" && (
            <label>{t("원본의 몇 %로 줄일까요? (1~100)", "Scale to what % of the original? (1–100)")}
              <input type="number" min={1} max={100} value={percent} onChange={(e) => { setPercent(Number(e.target.value)); reset(); }} />
            </label>
          )}
          {resizeMode === "long" && (
            <label>{t("가로·세로 중 긴 쪽 길이(px)", "Length of the longer side (px)")}
              <input type="number" min={16} step={10} value={longSide} onChange={(e) => { setLongSide(Number(e.target.value)); reset(); }} />
            </label>
          )}
          {resizeBad && <p className="warn">{t("크기 값을 확인해 주세요.", "Check the resize value.")}</p>}
          <p className="note-sm">{t("비율은 그대로 지키며 원본보다 키우지는 않습니다. 블로그·메신저용이면 긴 변 1920px이나 1280px이 알맞습니다.", "Proportions are kept and images are never enlarged. For blogs or messengers, 1920 or 1280 px on the long side works well.")}</p>
        </>
      )}

      <div className="actions">
        <button type="button" className="btn sm" disabled={ready.length === 0 || !!busy || targetBad || resizeBad} onClick={run}>
          {busy ? t("처리 중…", "Working…") : ready.length ? t(`${ready.length}장을 ${OUTPUT_FORMATS[format].label}로 변환`, `Convert ${ready.length} to ${OUTPUT_FORMATS[format].label}`) : t("변환하기", "Convert")}
        </button>
        {busy && <button type="button" className="btn sm ghost" onClick={() => { cancel.current = true; }}>{t("멈추기", "Stop")}</button>}
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}</p>}
        {error && <p className="warn">{error}</p>}
        {outputs.length > 0 && !busy && (
          <>
            <div className="big">
              <span>{t(`${outputs.length}장 합계`, `Total for ${outputs.length} images`)}</span>
              <strong>{formatBytes(after)}</strong>
              <small>{t("원본", "Original")} {formatBytes(before)} · {change(before, after)}</small>
            </div>
            {outputs.some((o) => o.overTarget) && <p className="warn">{t("화질을 가장 낮춰도 목표 용량을 넘는 이미지가 있습니다. 크기 조절로 가로·세로를 줄여 다시 변환해 보세요.", "Some images are still over the target at the lowest quality. Reduce their dimensions and convert again.")}</p>}
            <div className="actions">
              {outputs.length === 1
                ? <a className="btn sm" href={outputs[0].url} download={outputs[0].name}>{t("내려받기", "Download")}</a>
                : zip
                  ? <a className="btn sm" href={zip.url} download={zip.name}>{t("ZIP 내려받기", "Download ZIP")} ({formatBytes(zip.size)})</a>
                  : <button type="button" className="btn sm" onClick={makeZip}>{t(`${outputs.length}장 모두 ZIP으로 묶기`, `Bundle all ${outputs.length} as ZIP`)}</button>}
            </div>
          </>
        )}
        {outputs.length > 0 && (
          <ol className="pagegrid">
            {outputs.map((o) => (
              <li key={o.url}>
                <div className="thumb"><img src={o.url} alt={o.name} /></div>
                <small className="tname">{o.name}</small>
                <span className="pno"><small>{n(o.w)}×{n(o.h)} · {formatBytes(o.blob.size)}<br />{o.kept ? t("원본이 더 작아 그대로 둠", "Original kept (already smaller)") : change(o.before, o.blob.size)}</small></span>
                {outputs.length > 1 && <a className="btn sm" href={o.url} download={o.name}>{t("내려받기", "Download")}</a>}
              </li>
            ))}
          </ol>
        )}
        <p className="note">{t("이미지는 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다. 변환하면 촬영 위치·기기 같은 사진 정보(EXIF)는 지워지고, 사진 방향은 바르게 맞춰집니다.", "Images are processed only in this browser and never uploaded. Converting removes photo metadata such as location and camera (EXIF), and fixes the orientation.")}</p>
      </div>
    </div>
  );
}
