"use client";
import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import { checkUpscale, UPSCALE_MAX_BYTES, upscaledName, type Scale, type UpscaleMode } from "@/lib/tools/upscale";

type Format = "png" | "jpg";
type Output = { url: string; name: string; size: number; w: number; h: number };
// AI 업스케일러는 배율마다 모델이 달라 한 번 불러온 것을 다시 씁니다.
type UpscalerLike = {
  upscale: (img: unknown, opts: Record<string, unknown>) => Promise<unknown>;
  dispose: () => Promise<void>;
};

const MODES: { key: UpscaleMode; label: string; desc: string }[] = [
  { key: "ai", label: "AI 고화질", desc: "흐린 경계와 질감을 AI로 되살립니다. 처음 쓸 때 모델(약 3MB)을 받고, 기기에 따라 수십 초 걸릴 수 있습니다." },
  { key: "fast", label: "빠른 모드", desc: "정교한 보간(Lanczos3)과 선명도 보정으로 바로 키웁니다. 없는 디테일을 만들지는 않습니다." },
];

// 그래픽 가속 없이 AI 모드를 돌릴 수 있는 최대 화소 수(CPU에서 1분 안팎)
const CPU_AI_MAX = 100_000;
const NO_GPU = "no-gpu";

const toBlob = (c: HTMLCanvasElement, f: Format) =>
  new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("encode"))), f === "jpg" ? "image/jpeg" : "image/png", 0.92));

export default function ImageUpscaler() {
  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState("");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState<UpscaleMode>("ai");
  const [scale, setScale] = useState<Scale>(2);
  const [format, setFormat] = useState<Format>("png");
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<Output | null>(null);
  const [split, setSplit] = useState(50);

  const img = useRef<HTMLImageElement | null>(null);
  const upscalers = useRef<Partial<Record<Scale, UpscalerLike>>>({});
  const abort = useRef<AbortController | null>(null);
  const worker = useRef<Worker | null>(null);

  const clearOutput = () =>
    setOutput((o) => {
      if (o) URL.revokeObjectURL(o.url);
      return null;
    });

  useEffect(
    () => () => {
      abort.current?.abort();
      worker.current?.terminate();
      Object.values(upscalers.current).forEach((u) => u?.dispose().catch(() => {}));
    },
    [],
  );

  const pick = (f: File | null) => {
    abort.current?.abort();
    clearOutput();
    setError("");
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    setSrcUrl("");
    setFile(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("이미지 파일(JPG, PNG, WEBP 등)을 골라 주세요.");
    if (f.size > UPSCALE_MAX_BYTES) return setError(`파일이 너무 큽니다. ${formatBytes(UPSCALE_MAX_BYTES)} 이하만 처리합니다.`);
    const url = URL.createObjectURL(f);
    const el = new Image();
    el.onload = () => {
      img.current = el;
      setSize({ w: el.naturalWidth, h: el.naturalHeight });
      setSrcUrl(url);
      setFile(f);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      setError("이미지를 읽지 못했습니다. 다른 파일로 시도해 주세요.");
    };
    el.src = url;
  };

  const limit = file ? checkUpscale(size.w, size.h, scale, mode) : null;

  // 원본을 캔버스에 그립니다. AI 모델은 투명도를 다루지 않아 투명한 곳을 흰색으로 채웁니다.
  const sourceCanvas = (fillWhite: boolean) => {
    const c = document.createElement("canvas");
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext("2d")!;
    if (fillWhite) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.drawImage(img.current!, 0, 0);
    return c;
  };

  const runAi = async (signal: AbortSignal): Promise<HTMLCanvasElement> => {
    setBusy("AI 모델을 불러오는 중…");
    const tf = await import("@tensorflow/tfjs");
    let up = upscalers.current[scale];
    if (!up) {
      const [{ default: Upscaler }, def] = await Promise.all([
        import("upscaler"),
        scale === 2 ? import("@upscalerjs/esrgan-medium/2x") : import("@upscalerjs/esrgan-medium/4x"),
      ]);
      up = new Upscaler({ model: { ...def.default, path: `/models/esrgan-medium/x${scale}/model.json` } }) as unknown as UpscalerLike;
      upscalers.current[scale] = up;
    }
    await tf.ready();
    // 그래픽 가속(WebGL)이 없으면 CPU로 돌아 수십 배 느려집니다. 작은 이미지만 받고, 크면 빠른 모드를 권합니다.
    const cpu = tf.getBackend() === "cpu";
    if (cpu && size.w * size.h > CPU_AI_MAX) throw new Error(NO_GPU);
    setBusy(cpu ? "AI로 키우는 중… (이 기기는 그래픽 가속이 없어 오래 걸립니다)" : "AI로 키우는 중…");
    setProgress(0);
    const input = tf.browser.fromPixels(sourceCanvas(true));
    try {
      const out = (await up.upscale(input, {
        output: "tensor",
        patchSize: 64,
        padding: 6,
        awaitNextFrame: true,
        signal,
        progress: (rate: number) => setProgress(rate),
      })) as import("@tensorflow/tfjs").Tensor3D;
      const pixels = tf.tidy(() => out.clipByValue(0, 255).round().toInt() as import("@tensorflow/tfjs").Tensor3D);
      out.dispose();
      const c = document.createElement("canvas");
      [c.height, c.width] = pixels.shape;
      await tf.browser.toPixels(pixels, c); // 한 번만 그리므로 tf.browser.draw보다 호환성이 좋은 쪽을 씁니다
      pixels.dispose();
      return c;
    } finally {
      input.dispose();
    }
  };

  const runFast = (signal: AbortSignal): Promise<HTMLCanvasElement> =>
    new Promise((resolve, reject) => {
      setBusy("키우는 중…");
      setProgress(null);
      const src = sourceCanvas(false).getContext("2d")!.getImageData(0, 0, size.w, size.h);
      const w = (worker.current ??= new Worker(new URL("../lib/tools/upscale.worker.ts", import.meta.url)));
      const onAbort = () => {
        w.terminate();
        worker.current = null;
        reject(new DOMException("aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      w.onerror = () => reject(new Error("worker"));
      w.onmessage = (e: MessageEvent<{ data: Uint8ClampedArray; width: number; height: number }>) => {
        signal.removeEventListener("abort", onAbort);
        const { data, width, height } = e.data;
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data.buffer as ArrayBuffer), width, height), 0, 0);
        resolve(c);
      };
      w.postMessage({ data: src.data, width: size.w, height: size.h, scale }, [src.data.buffer]);
    });

  const run = async () => {
    if (!file || limit) return;
    clearOutput();
    setError("");
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const canvas = mode === "ai" ? await runAi(ctrl.signal) : await runFast(ctrl.signal);
      setBusy("파일로 저장하는 중…");
      const blob = await toBlob(canvas, format);
      setOutput({ url: URL.createObjectURL(blob), name: upscaledName(file.name, scale, format), size: blob.size, w: canvas.width, h: canvas.height });
      setSplit(50);
    } catch (e) {
      if (ctrl.signal.aborted) setError("처리를 멈췄습니다.");
      else if (e instanceof Error && e.message === NO_GPU) setError("이 브라우저는 그래픽 가속(WebGL)을 쓸 수 없어 AI 모드가 매우 느립니다. 빠른 모드를 쓰거나, 크롬·엣지·사파리 최신 버전에서 다시 시도해 보세요.");
      else setError(mode === "ai" ? "AI 처리 중 문제가 생겼습니다. 그래픽 메모리가 모자랄 수 있으니 2배나 빠른 모드로 다시 시도해 보세요." : "처리 중 문제가 생겼습니다. 더 작은 이미지로 다시 시도해 보세요.");
      console.error(e);
    } finally {
      setBusy("");
      setProgress(null);
      abort.current = null;
    }
  };

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <span>{file ? `${file.name} (${formatBytes(file.size)} · ${size.w}×${size.h})` : "키울 이미지 파일을 고르세요 (JPG, PNG, WEBP)"}</span>
      </label>

      <h3 style={{ marginTop: 16 }}>방식</h3>
      <div className="seg" role="group" aria-label="방식">
        {MODES.map((m) => (
          <button key={m.key} type="button" aria-pressed={mode === m.key} onClick={() => setMode(m.key)} disabled={!!busy}>{m.label}</button>
        ))}
      </div>
      <p className="note-sm">{MODES.find((m) => m.key === mode)!.desc}</p>

      <div className="fields">
        <label>배율
          <select value={scale} onChange={(e) => setScale(Number(e.target.value) as Scale)} disabled={!!busy}>
            <option value={2}>2배</option>
            <option value={4}>4배</option>
          </select>
        </label>
        <label>저장 형식
          <select value={format} onChange={(e) => setFormat(e.target.value as Format)} disabled={!!busy}>
            <option value="png">PNG (화질 그대로)</option>
            <option value="jpg">JPG (용량 작게)</option>
          </select>
        </label>
      </div>
      {file && <p className="note-sm">결과 크기: {(size.w * scale).toLocaleString("ko-KR")}×{(size.h * scale).toLocaleString("ko-KR")}px</p>}
      {limit && <p className="warn">{limit}</p>}
      {error && <p className="warn">{error}</p>}

      <div className="actions">
        <button type="button" className="btn sm" onClick={run} disabled={!file || !!limit || !!busy}>{scale}배로 키우기</button>
        {busy && <button type="button" className="btn sm ghost" onClick={() => abort.current?.abort()}>멈추기</button>}
      </div>
      {busy && <p className="note" role="status">{busy}{progress !== null && ` ${Math.round(progress * 100)}%`}</p>}
      {progress !== null && <progress className="wm-progress" value={progress} max={1} />}

      {output && (
        <div className="result">
          <div className="compare" style={{ aspectRatio: `${output.w} / ${output.h}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={output.url} alt="키운 결과" />
            <div className="compare-before" style={{ width: `${split}%` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={srcUrl} alt="원본" style={{ width: `${10000 / split}%` }} />
            </div>
            <span className="compare-label l">원본</span>
            <span className="compare-label r">결과</span>
          </div>
          <label>왼쪽은 원본, 오른쪽은 결과입니다. 막대를 움직여 비교하세요.
            <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Math.max(1, Number(e.target.value)))} />
          </label>
          <p className="note-sm">{output.w.toLocaleString("ko-KR")}×{output.h.toLocaleString("ko-KR")}px · {formatBytes(output.size)}</p>
          <div className="actions">
            <a className="btn sm" href={output.url} download={output.name}>내려받기</a>
          </div>
        </div>
      )}
      <p className="note">이미지는 이 브라우저 안에서만 처리하며 서버로 보내지 않습니다. AI 모델 파일만 처음 한 번 이 사이트에서 내려받습니다.</p>
    </div>
  );
}
