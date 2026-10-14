"use client";
import { useT } from "@/lib/useT";
import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import { MAX_PIXELS, MAX_SIDE } from "@/lib/tools/imagePdf";
import {
  buildMask, cleanedName, inpaint, MAX_RECTS, normalizeRect, pickVideoType, smoothItersFor, workArea,
  WM_IMAGE_MAX_BYTES, WM_VIDEO_MAX_BYTES, type Rect,
} from "@/lib/tools/watermark";

type Kind = "image" | "video";
type Output = { url: string; name: string; size: number; kind: Kind };
type ImgFormat = "png" | "jpg";

// 동영상은 실시간으로 다시 녹화하므로 너무 크면 프레임이 밀립니다. 긴 변을 이만큼으로 줄입니다.
const VIDEO_MAX_SIDE = 1920;
const PADS = [0, 3, 6] as const;

// 원본 크기를 한도 안으로 줄인 크기
function fitSize(w: number, h: number, maxSide: number) {
  const s = Math.min(1, maxSide / w, maxSide / h, Math.sqrt(MAX_PIXELS / (w * h)));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

// 캔버스의 영역들을 메웁니다. 작업 범위만 읽고 써서 동영상 프레임마다 돌려도 빠릅니다.
function cleanCanvas(ctx: CanvasRenderingContext2D, rects: Rect[], pad: number) {
  const { width, height } = ctx.canvas;
  const padded = rects.map((r) => ({ x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 }));
  const area = workArea(padded, width, height);
  if (!area) return;
  const img = ctx.getImageData(area.x, area.y, area.w, area.h);
  inpaint(img.data, area.w, area.h, buildMask(area, rects, pad), smoothItersFor(padded));
  ctx.putImageData(img, area.x, area.y);
}

const toBlob = (c: HTMLCanvasElement, f: ImgFormat) =>
  new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("encode"))), f === "jpg" ? "image/jpeg" : "image/png", 0.92));

export default function WatermarkRemover() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [duration, setDuration] = useState(0);
  const [seek, setSeek] = useState(0);
  const [rects, setRects] = useState<Rect[]>([]);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [pad, setPad] = useState<number>(3);
  const [format, setFormat] = useState<ImgFormat>("png");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<Output | null>(null);

  const view = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement | null>(null); // 원본(이미지 또는 고른 시점의 동영상 프레임)
  const srcUrl = useRef("");
  const video = useRef<HTMLVideoElement | null>(null);
  const run = useRef(0);
  const stopVideo = useRef<(() => void) | null>(null);

  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);
  useEffect(() => () => {
    run.current++;
    stopVideo.current?.();
    if (srcUrl.current) URL.revokeObjectURL(srcUrl.current);
  }, []);

  // 화면 캔버스: 원본(또는 미리보기 결과) 위에 고른 영역과 드래그 중인 영역을 그립니다.
  useEffect(() => {
    const c = view.current, b = base.current;
    if (!c || !b || !size.w) return;
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(b, 0, 0);
    if (preview) {
      cleanCanvas(ctx, rects, pad);
      return;
    }
    const lw = Math.max(2, Math.round(Math.max(size.w, size.h) / 400));
    ctx.lineWidth = lw;
    ctx.setLineDash([lw * 3, lw * 2]);
    const box = (r: Rect, color: string) => {
      ctx.fillStyle = "rgba(239,68,68,.25)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = color;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    };
    rects.forEach((r) => box(r, "#ef4444"));
    const d = drag && normalizeRect(drag.x0, drag.y0, drag.x1, drag.y1, size.w, size.h);
    if (d) box(d, "#f59e0b");
  }, [rects, drag, size, preview, pad, seek]);

  const clearOutput = () => {
    run.current++;
    stopVideo.current?.();
    setOutput(null);
    setProgress(null);
    setBusy("");
  };

  const pick = async (f: File | null) => {
    clearOutput();
    setError("");
    setFile(null);
    setKind(null);
    setRects([]);
    setPreview(false);
    setSize({ w: 0, h: 0 });
    base.current = null;
    video.current = null;
    if (srcUrl.current) URL.revokeObjectURL(srcUrl.current);
    srcUrl.current = "";
    if (!f) return;
    const k: Kind | null = f.type.startsWith("video/") ? "video" : f.type.startsWith("image/") ? "image" : null;
    if (!k) {
      setError(t("이미지(JPG·PNG·WEBP 등) 또는 동영상(MP4·WEBM·MOV) 파일을 골라 주세요.", "Please choose an image (JPG, PNG, WEBP, etc.) or a video (MP4, WEBM, MOV)."));
      return;
    }
    const limit = k === "video" ? WM_VIDEO_MAX_BYTES : WM_IMAGE_MAX_BYTES;
    if (f.size > limit) {
      setError(t(`파일이 너무 큽니다. ${formatBytes(limit)} 이하의 파일만 처리할 수 있습니다.`, `The file is too large. Files up to ${formatBytes(limit)} are supported.`));
      return;
    }
    setBusy(t("파일을 읽는 중…", "Reading the file…"));
    try {
      if (k === "image") {
        const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
        const s = fitSize(bmp.width, bmp.height, MAX_SIDE);
        const c = document.createElement("canvas");
        c.width = s.w;
        c.height = s.h;
        c.getContext("2d")!.drawImage(bmp, 0, 0, s.w, s.h);
        bmp.close();
        base.current = c;
        setFormat(/jpe?g/i.test(f.type) ? "jpg" : "png");
        setSize(s);
      } else {
        const url = URL.createObjectURL(f);
        srcUrl.current = url;
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.preload = "auto";
        v.src = url;
        await new Promise<void>((ok, fail) => {
          v.onloadeddata = () => ok();
          v.onerror = () => fail(new Error("video"));
        });
        if (!v.videoWidth || !Number.isFinite(v.duration)) throw new Error("video");
        video.current = v;
        const s = fitSize(v.videoWidth, v.videoHeight, VIDEO_MAX_SIDE);
        base.current = document.createElement("canvas");
        base.current.width = s.w;
        base.current.height = s.h;
        setDuration(v.duration);
        await grabFrame(Math.min(0.5, v.duration / 2), s);
        setSize(s);
      }
      setFile(f);
      setKind(k);
    } catch {
      setError(k === "video"
        ? t("이 브라우저에서 재생할 수 없는 동영상입니다. MP4(H.264)나 WEBM 파일로 다시 시도해 주세요.", "This browser can't play this video. Try an MP4 (H.264) or WEBM file.")
        : t("이미지를 읽지 못했습니다. 손상되었거나 브라우저가 지원하지 않는 형식일 수 있습니다.", "Couldn't read the image. It may be damaged or in a format this browser doesn't support."));
    } finally {
      setBusy("");
    }
  };

  // 동영상의 t초 장면을 원본 캔버스로 가져옵니다. 워터마크 위치를 확인할 때 씁니다.
  const grabFrame = async (t: number, s = size) => {
    const v = video.current, b = base.current;
    if (!v || !b) return;
    await new Promise<void>((ok) => {
      v.onseeked = () => ok();
      v.currentTime = t;
    });
    b.getContext("2d")!.drawImage(v, 0, 0, s.w, s.h);
    setSeek(t);
  };

  // 화면 좌표 → 원본 픽셀 좌표
  const toPx = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * size.w, y: ((e.clientY - r.top) / r.height) * size.h };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (preview || busy || rects.length >= MAX_RECTS) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPx(e);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    const p = toPx(e);
    setDrag({ ...drag, x1: p.x, y1: p.y });
  };
  const onUp = () => {
    if (!drag) return;
    const r = normalizeRect(drag.x0, drag.y0, drag.x1, drag.y1, size.w, size.h);
    setDrag(null);
    if (r) {
      setRects((rs) => [...rs, r]);
      clearOutput();
    }
  };

  const removeImage = async () => {
    if (!file || !base.current || rects.length === 0) return;
    clearOutput();
    setBusy(t("워터마크를 지우는 중…", "Removing the watermark…"));
    try {
      const c = document.createElement("canvas");
      c.width = size.w;
      c.height = size.h;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      if (format === "jpg") {
        ctx.fillStyle = "#fff"; // JPG는 투명을 담지 못하므로 흰 바탕을 깝니다.
        ctx.fillRect(0, 0, size.w, size.h);
      }
      ctx.drawImage(base.current, 0, 0);
      cleanCanvas(ctx, rects, pad);
      const blob = await toBlob(c, format);
      c.width = c.height = 0;
      setOutput({ url: URL.createObjectURL(blob), name: cleanedName(file.name, format, t.lang), size: blob.size, kind: "image" });
      setPreview(true);
    } catch {
      setError(t("이미지를 만들지 못했습니다. 메모리가 부족할 수 있으니 더 작은 이미지로 다시 시도해 주세요.", "Couldn't create the image. The device may be low on memory - try a smaller image."));
    } finally {
      setBusy("");
    }
  };

  // 동영상: 처음부터 끝까지 재생하면서 프레임마다 영역을 메운 캔버스를 소리와 함께 다시 녹화합니다.
  const removeVideo = async () => {
    if (!file || rects.length === 0) return;
    const type = typeof MediaRecorder === "undefined" ? null : pickVideoType((m) => MediaRecorder.isTypeSupported(m));
    const c0 = document.createElement("canvas");
    if (!type || typeof c0.captureStream !== "function") {
      setError(t("이 브라우저는 동영상 녹화를 지원하지 않습니다. 최신 크롬·엣지·사파리에서 다시 시도해 주세요.", "This browser can't record video. Try again in the latest Chrome, Edge or Safari."));
      return;
    }
    clearOutput();
    setError("");
    const id = run.current;
    setBusy(t("동영상을 처리하는 중… 영상 길이만큼 시간이 걸리니 이 탭을 열어 두세요.", "Processing the video… This takes as long as the video itself, so keep this tab open."));
    setProgress(0);

    const v = document.createElement("video");
    v.src = srcUrl.current;
    v.playsInline = true;
    v.preload = "auto";
    const c = c0;
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const stream = c.captureStream(30);
    let audio: AudioContext | null = null;
    try {
      // 소리는 스피커로 내보내지 않고 녹화 스트림에만 연결합니다.
      audio = new AudioContext();
      const dest = audio.createMediaStreamDestination();
      audio.createMediaElementSource(v).connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch {
      v.muted = true; // 소리를 가져오지 못하면 소리 없이 녹화합니다.
    }

    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: Math.round(size.w * size.h * 30 * 0.15) });
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    let stopped = false;
    const finish = new Promise<void>((ok) => { rec.onstop = () => ok(); });
    const stop = () => {
      if (stopped) return;
      stopped = true;
      v.pause();
      if (rec.state !== "inactive") rec.stop();
      stream.getTracks().forEach((t) => t.stop());
      audio?.close();
    };
    stopVideo.current = stop;

    const draw = () => {
      ctx.drawImage(v, 0, 0, size.w, size.h);
      cleanCanvas(ctx, rects, pad);
      if (run.current === id && v.duration) setProgress(Math.min(1, v.currentTime / v.duration));
    };
    const vfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback?.bind(v);
    const loop = () => {
      if (stopped) return;
      draw();
      if (vfc) vfc(loop);
      else requestAnimationFrame(loop);
    };

    try {
      await new Promise<void>((ok, fail) => {
        v.onloadeddata = () => ok();
        v.onerror = () => fail(new Error("video"));
      });
      draw();
      v.onended = () => { draw(); stop(); };
      rec.start(1000);
      await audio?.resume();
      await v.play();
      loop();
      await finish;
      if (run.current !== id) return;
      const blob = new Blob(chunks, { type: type.mime.split(";")[0] });
      if (blob.size === 0) throw new Error("empty");
      setOutput({ url: URL.createObjectURL(blob), name: cleanedName(file.name, type.ext, t.lang), size: blob.size, kind: "video" });
    } catch {
      stop();
      if (run.current === id) setError(t("동영상을 처리하지 못했습니다. 다른 브라우저(크롬·엣지)에서 다시 시도하거나 더 짧은 영상으로 시도해 주세요.", "Couldn't process the video. Try another browser (Chrome or Edge) or a shorter video."));
    } finally {
      if (stopVideo.current === stop) stopVideo.current = null;
      v.removeAttribute("src");
      v.load();
      if (run.current === id) {
        setBusy("");
        setProgress(null);
      }
    }
  };

  const cancel = () => {
    clearOutput();
    setError(t("처리를 멈췄습니다.", "Stopped."));
  };

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="image/*,video/*" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <span>
          {file
            ? `${file.name} (${formatBytes(file.size)} · ${size.w}×${size.h}${kind === "video" ? ` · ${Math.round(duration)}${t("초", "s")}` : ""})`
            : t("워터마크를 지울 이미지나 동영상 파일을 고르세요", "Choose an image or video to remove a watermark from")}
        </span>
      </label>

      {kind && (
        <>
          <h3 className="sub">{t("지울 영역 고르기", "Select the areas to remove")}</h3>
          <p className="note-sm">
            {preview
              ? t("지운 결과를 보고 있습니다. 영역을 고치려면 '영역 다시 고르기'를 누르세요.", "You're viewing the result. Press 'Edit areas' to change the selection.")
              : t(`그림 위를 드래그해 워터마크를 감싸세요. 여러 곳을 고를 수 있습니다(최대 ${MAX_RECTS}곳).`, `Drag over the picture to box the watermark. You can select several areas (up to ${MAX_RECTS}).`)}
          </p>
          <canvas
            ref={view}
            className="wm-canvas"
            style={{ cursor: preview ? "default" : "crosshair" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => setDrag(null)}
            aria-label={t("워터마크 영역을 드래그해 고르는 화면", "Drag to select watermark areas")}
          />
          {kind === "video" && !preview && (
            <label>
              {t(`워터마크 위치 확인용 장면 (${seek.toFixed(1)}초 / ${duration.toFixed(1)}초)`, `Frame for checking the watermark position (${seek.toFixed(1)}s / ${duration.toFixed(1)}s)`)}
              <input
                type="range" min={0} max={Math.max(0, duration - 0.05)} step={0.1} value={seek} disabled={!!busy}
                onChange={(e) => grabFrame(Number(e.target.value))}
              />
            </label>
          )}

          {rects.length > 0 && (
            <ul className="filelist">
              {rects.map((r, i) => (
                <li key={`${r.x}-${r.y}-${i}`}>
                  <span className="fname"><b>{t(`영역 ${i + 1}`, `Area ${i + 1}`)}</b><small>{t(`위치 ${r.x}, ${r.y} · 크기 ${r.w}×${r.h}px`, `Position ${r.x}, ${r.y} · size ${r.w}×${r.h}px`)}</small></span>
                  <span className="ctrl">
                    <button type="button" aria-label={t(`영역 ${i + 1} 지우기`, `Remove area ${i + 1}`)} disabled={!!busy}
                      onClick={() => { setRects(rects.filter((_, j) => j !== i)); setPreview(false); clearOutput(); }}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="sub">{t("가장자리 여유", "Edge padding")}</h3>
          <div className="seg" role="group" aria-label={t("가장자리 여유", "Edge padding")}>
            {PADS.map((p) => (
              <button key={p} type="button" aria-pressed={pad === p} onClick={() => { setPad(p); clearOutput(); }}>
                {p === 0 ? t("딱 맞게", "Exact") : t(`${p}px 넓게`, `+${p}px`)}
              </button>
            ))}
          </div>

          {kind === "image" && (
            <div className="seg" role="group" aria-label={t("저장 형식", "Save as")}>
              <button type="button" aria-pressed={format === "png"} onClick={() => { setFormat("png"); clearOutput(); }}>{t("PNG (화질 그대로)", "PNG (lossless)")}</button>
              <button type="button" aria-pressed={format === "jpg"} onClick={() => { setFormat("jpg"); clearOutput(); }}>{t("JPG (용량 작게)", "JPG (smaller)")}</button>
            </div>
          )}
        </>
      )}

      <div className="actions">
        {kind && (
          <button type="button" className="btn sm ghost" disabled={rects.length === 0 || !!busy} onClick={() => setPreview(!preview)}>
            {preview ? t("영역 다시 고르기", "Edit areas") : t("미리보기", "Preview")}
          </button>
        )}
        {kind && rects.length > 0 && !busy && (
          <button type="button" className="btn sm ghost" onClick={() => { setRects([]); setPreview(false); clearOutput(); }}>{t("영역 모두 지우기", "Clear all areas")}</button>
        )}
        {busy && progress !== null
          ? <button type="button" className="btn sm" onClick={cancel}>{t("멈추기", "Stop")}</button>
          : (
            <button type="button" className="btn sm" disabled={!kind || rects.length === 0 || !!busy}
              onClick={kind === "video" ? removeVideo : removeImage}>
              {busy ? t("처리 중…", "Working…") : t("워터마크 지우기", "Remove watermark")}
            </button>
          )}
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}{progress !== null && ` ${Math.round(progress * 100)}%`}</p>}
        {progress !== null && <progress className="wm-progress" value={progress} max={1} />}
        {error && <p className="warn">{error}</p>}
        {output && (
          <>
            {output.kind === "video" && <video className="wm-canvas" src={output.url} controls playsInline />}
            <div className="actions">
              <a className="btn sm" href={output.url} download={output.name}>{t("내려받기", "Download")} ({formatBytes(output.size)})</a>
            </div>
          </>
        )}
        <p className="note">
          {t(
            "파일은 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다. 직접 만들었거나 사용 권한이 있는 파일에만 쓰세요. 다른 사람의 저작물에서 워터마크를 지워 쓰거나 퍼뜨리면 저작권법 위반이 될 수 있습니다.",
            "Files are processed only in this browser and never uploaded. Use this only on files you made or have permission to edit. Removing watermarks from other people's work to use or share it may infringe copyright.",
          )}
        </p>
      </div>
    </div>
  );
}
