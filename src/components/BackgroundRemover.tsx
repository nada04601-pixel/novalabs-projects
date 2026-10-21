"use client";
import { useT } from "@/lib/useT";
import { pick } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import { BG_MAX_BYTES, BG_MODELS, cropBox, cutoutName, MASK_MAX_SIDE, maskBounds, maskCoverage, type BgModel } from "@/lib/tools/bgRemove";
import { isHeic, outputSize } from "@/lib/tools/imageConvert";
import type { BgMessage, BgRequest } from "@/lib/tools/bgRemove.worker";

type Phase =
  | { phase: "idle" }
  | { phase: "load"; loaded: number; total: number; device: "webgpu" | "wasm" }
  | { phase: "run"; device: "webgpu" | "wasm" };
type Mask = { data: Uint8Array; w: number; h: number };
type Background = "transparent" | "white" | "color";
type Output = { url: string; name: string; size: number; w: number; h: number };

const n = (v: number) => v.toLocaleString("ko-KR");
const canvasOf = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h });
const encode = (c: HTMLCanvasElement, mime: string, q?: number) =>
  new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("encode"))), mime, q));

// 원본을 마스크로 오려 내고, 배경색을 깔고, 고르면 피사체에 맞게 자릅니다.
async function compose(src: ImageBitmap, mask: Mask, bg: Background, color: string, crop: boolean) {
  const { w, h } = outputSize(src.width, src.height, { mode: "none", value: 0 });
  const full = canvasOf(w, h);
  const ctx = full.getContext("2d")!;
  ctx.drawImage(src, 0, 0, w, h);
  const m = canvasOf(mask.w, mask.h);
  const img = new ImageData(mask.w, mask.h);
  for (let i = 0; i < mask.data.length; i++) img.data[i * 4 + 3] = mask.data[i];
  m.getContext("2d")!.putImageData(img, 0, 0);
  ctx.imageSmoothingQuality = "high";
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(m, 0, 0, w, h);
  m.width = m.height = 0;
  if (bg !== "transparent") {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = bg === "white" ? "#ffffff" : color;
    ctx.fillRect(0, 0, w, h);
  }
  let out = full;
  const box = crop ? maskBounds(mask.data, mask.w, mask.h) : null;
  if (box) {
    const c = cropBox(box, mask.w, mask.h, w, h);
    out = canvasOf(c.w, c.h);
    out.getContext("2d")!.drawImage(full, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
    full.width = full.height = 0;
  }
  const blob = await encode(out, bg === "transparent" ? "image/png" : "image/jpeg", 0.92);
  const size = { w: out.width, h: out.height };
  out.width = out.height = 0;
  return { blob, ...size };
}

function Status({ text, value }: { text: string; value: number | null }) {
  return (
    <>
      <p className="note" role="status">{text}{value !== null && ` ${Math.round(value * 100)}%`}</p>
      {value !== null ? <progress className="wm-progress" value={value} max={1} /> : <progress className="wm-progress" />}
    </>
  );
}

export default function BackgroundRemover() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState("");
  const [model, setModel] = useState<BgModel>("person");
  const [state, setState] = useState<Phase>({ phase: "idle" });
  const [retried, setRetried] = useState(false);
  const [error, setError] = useState("");
  const [mask, setMask] = useState<Mask | null>(null);
  const [bg, setBg] = useState<Background>("transparent");
  const [color, setColor] = useState("#3b82f6");
  const [crop, setCrop] = useState(false);
  const [output, setOutput] = useState<Output | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const worker = useRef<Worker | null>(null);
  const source = useRef<ImageBitmap | null>(null);

  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
    setState({ phase: "idle" });
  };
  useEffect(() => () => { worker.current?.terminate(); source.current?.close(); }, []);
  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl); }, [srcUrl]);
  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);

  // 마스크나 배경 설정이 바뀌면 모델을 다시 돌리지 않고 결과만 새로 만듭니다.
  // t는 렌더링마다 새로 만들어지므로 의존성에는 언어만 넣습니다.
  const lang = t.lang;
  useEffect(() => {
    if (!mask || !source.current || !file) return;
    let live = true;
    compose(source.current, mask, bg, color, crop)
      .then(({ blob, w, h }) => {
        if (live) setOutput({ url: URL.createObjectURL(blob), name: cutoutName(file.name, bg === "transparent" ? "png" : "jpg", lang), size: blob.size, w, h });
      })
      .catch(() => live && setError(pick(lang, "결과 이미지를 만들지 못했습니다. 이미지가 너무 크면 크기를 줄여 다시 해 보세요.", "Couldn't create the result. If the image is very large, shrink it and try again.")));
    return () => { live = false; };
  }, [mask, bg, color, crop, file, lang]);

  const choose = async (f: File | null) => {
    if (!f) return;
    stop();
    setError("");
    setMask(null);
    setOutput(null);
    setShowOriginal(false);
    setFile(null);
    source.current?.close();
    source.current = null;
    if (f.size > BG_MAX_BYTES) return setError(t(`${formatBytes(BG_MAX_BYTES)}를 넘는 이미지는 처리할 수 없습니다.`, `Images larger than ${formatBytes(BG_MAX_BYTES)} aren't supported.`));
    try {
      source.current = await createImageBitmap(f, { imageOrientation: "from-image" });
    } catch {
      const heic = isHeic(new Uint8Array(await f.slice(0, 16).arrayBuffer()));
      return setError(heic
        ? t("이 브라우저는 HEIC 사진을 열지 못합니다. 아이폰·맥의 Safari에서 열거나, JPG로 바꾼 뒤 다시 골라 주세요.", "This browser can't open HEIC photos. Use Safari on iPhone or Mac, or convert to JPG first.")
        : t("이 브라우저에서 열 수 없는 이미지입니다.", "This browser can't open this image."));
    }
    setFile(f);
    setSrcUrl(URL.createObjectURL(f));
  };

  const run = () => {
    const src = source.current;
    if (!src || state.phase !== "idle") return;
    setError("");
    setRetried(false);
    setMask(null);
    setOutput(null);
    // 모델에 넘길 작은 RGB 이미지
    const s = Math.min(1, MASK_MAX_SIDE / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * s)), h = Math.max(1, Math.round(src.height * s));
    const c = canvasOf(w, h);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0, w, h);
    const rgba = ctx.getImageData(0, 0, w, h).data;
    c.width = c.height = 0;
    const rgb = new Uint8ClampedArray(w * h * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4) {
      rgb[j++] = rgba[i]; rgb[j++] = rgba[i + 1]; rgb[j++] = rgba[i + 2];
    }

    if (!worker.current) {
      const wk = new Worker(new URL("../lib/tools/bgRemove.worker.ts", import.meta.url), { type: "module" });
      wk.onerror = () => {
        setError(t("배경 제거를 시작하지 못했습니다. 다른 브라우저에서 해 보세요.", "Couldn't start background removal. Try another browser."));
        stop();
      };
      worker.current = wk;
    }
    worker.current.onmessage = (e: MessageEvent<BgMessage>) => {
      const m = e.data;
      if (m.type === "load") setState({ phase: "load", loaded: m.loaded, total: m.total, device: m.device });
      else if (m.type === "run") setState({ phase: "run", device: m.device });
      else if (m.type === "retry") setRetried(true);
      else if (m.type === "done") {
        setState({ phase: "idle" });
        if (maskCoverage(m.mask) < 0.002) setError(t("피사체를 찾지 못했습니다. 사물·상품 사진이면 '사물·상품 (정교하게)'로 다시 해 보세요.", "No subject was found. For objects or products, try 'Objects & products (precise)'."));
        else setMask({ data: m.mask, w: m.width, h: m.height });
      } else {
        setError(t(`배경을 지우지 못했습니다. 인터넷 연결을 확인하거나, 휴대폰이면 '인물 (빠르게)'를 고르거나 컴퓨터에서 해 보세요. (${m.message})`, `Background removal failed. Check your connection, or on a phone choose 'People (fast)' or use a computer. (${m.message})`));
        stop();
      }
    };
    setState({ phase: "load", loaded: 0, total: 0, device: "wasm" });
    const req: BgRequest = { rgb, width: w, height: h, model };
    worker.current.postMessage(req, [rgb.buffer]);
  };

  const busy = state.phase !== "idle";

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="image/*,.heic,.heif" disabled={busy} onChange={(e) => { choose(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <span>{file ? t(`${file.name} (${formatBytes(file.size)}) · 다른 이미지 고르기`, `${file.name} (${formatBytes(file.size)}) · choose another`) : t("배경을 지울 이미지를 고르세요 (JPG·PNG·WebP)", "Choose an image (JPG, PNG, WebP)")}</span>
      </label>

      {file && (
        <>
          <h3 className="sub">{t("AI 모델", "AI model")}</h3>
          <div className="seg" role="group" aria-label={t("AI 모델", "AI model")}>
            {(Object.keys(BG_MODELS) as BgModel[]).map((k) => (
              <button key={k} type="button" disabled={busy} aria-pressed={model === k} onClick={() => setModel(k)}>{t(BG_MODELS[k].label, BG_MODELS[k].labelEn)}</button>
            ))}
          </div>
          <p className="note-sm">{model === "person"
            ? t(`사람이 나온 사진(프로필·증명사진·전신)에 알맞고 빠릅니다. 처음 한 번 모델 약 ${BG_MODELS.person.sizeMb}MB를 내려받습니다.`, `Best and fastest for photos of people (profiles, portraits, full body). Downloads a model of about ${BG_MODELS.person.sizeMb} MB the first time.`)
            : t(`상품·동물·물건까지 머리카락이나 가장자리를 정교하게 땁니다. 처음 한 번 모델 약 ${BG_MODELS.object.sizeMb}MB(그래픽 카드가 없으면 약 220MB)를 내려받아, 컴퓨터에서 쓰기를 권합니다.`, `Precise edges for products, pets and objects, as well as hair. Downloads a model of about ${BG_MODELS.object.sizeMb} MB the first time (about 220 MB without a GPU), so a computer is recommended.`)}</p>
        </>
      )}

      <div className="actions">
        {busy
          ? <button type="button" className="btn sm ghost" onClick={stop}>{t("멈추기", "Stop")}</button>
          : <button type="button" className="btn sm" disabled={!file} onClick={run}>{mask ? t("다시 지우기", "Run again") : t("배경 지우기", "Remove background")}</button>}
      </div>

      {state.phase === "load" && (
        <Status
          text={state.total ? `${t("AI 모델을 내려받는 중…", "Downloading the AI model…")} ${formatBytes(state.loaded)} / ${formatBytes(state.total)}` : t("AI 모델을 준비하는 중…", "Getting the AI model ready…")}
          value={state.total ? state.loaded / state.total : null}
        />
      )}
      {state.phase === "run" && (
        <Status text={`${t("배경을 지우는 중…", "Removing the background…")} (${state.device === "webgpu" ? t("그래픽 카드", "GPU") : t("CPU, 휴대폰에서는 시간이 걸립니다", "CPU, may take a while on phones")})`} value={null} />
      )}
      {retried && busy && <p className="note-sm">{t("그래픽 카드 방식이 이 기기에서 실패해 CPU 방식으로 다시 시도하고 있습니다.", "The GPU mode failed on this device, so it's retrying with the CPU.")}</p>}
      {error && <p className="warn">{error}</p>}

      {output && (
        <div className="result">
          <div className="cutout">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={showOriginal ? srcUrl : output.url} alt={showOriginal ? t("원본", "Original") : t("배경을 지운 결과", "Result with background removed")} />
          </div>
          <div className="seg" role="group" aria-label={t("보기", "View")}>
            <button type="button" aria-pressed={!showOriginal} onClick={() => setShowOriginal(false)}>{t("결과", "Result")}</button>
            <button type="button" aria-pressed={showOriginal} onClick={() => setShowOriginal(true)}>{t("원본", "Original")}</button>
          </div>

          <h3 className="sub">{t("배경", "Background")}</h3>
          <div className="seg" role="group" aria-label={t("배경", "Background")}>
            <button type="button" aria-pressed={bg === "transparent"} onClick={() => setBg("transparent")}>{t("투명 (PNG)", "Transparent (PNG)")}</button>
            <button type="button" aria-pressed={bg === "white"} onClick={() => setBg("white")}>{t("흰색 (JPG)", "White (JPG)")}</button>
            <button type="button" aria-pressed={bg === "color"} onClick={() => setBg("color")}>{t("색 고르기", "Pick a color")}</button>
          </div>
          {bg === "color" && (
            <label>{t("배경색", "Background color")}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>
          )}
          <label className="check">
            <input type="checkbox" checked={crop} onChange={(e) => setCrop(e.target.checked)} />
            {t("피사체에 맞게 여백 자르기", "Crop to the subject")}
          </label>

          <p className="note-sm">{n(output.w)}×{n(output.h)}px · {formatBytes(output.size)}</p>
          <div className="actions">
            <a className="btn sm" href={output.url} download={output.name}>{t("내려받기", "Download")}</a>
          </div>
        </div>
      )}
      <p className="note">{t("이미지는 이 브라우저 안에서만 처리하며 서버로 보내지 않습니다. AI 모델 파일만 처음 한 번 Hugging Face에서 내려받아 브라우저에 저장합니다.", "Images are processed only in this browser and never uploaded. Only the AI model file is downloaded from Hugging Face the first time and kept in your browser.")}</p>
    </div>
  );
}
