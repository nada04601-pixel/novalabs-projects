"use client";
import { useT } from "@/lib/useT";
import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import { formatTime, VIDEO_MAX_BYTES } from "@/lib/tools/videoEdit";
import type { VideoInfo } from "@/lib/tools/videoConvert";
import type { SubtitleTrack } from "@/lib/tools/subtitles";
import { normalizeRect, workArea, type Rect } from "@/lib/tools/watermark";
import {
  cleanArea, defaultArea, fitLongSide, MAX_AREAS, subtitleRemovedName,
  type DetectOptions, type Sensitivity, type TextColor,
} from "@/lib/tools/subtitleRemove";

type Mode = "track" | "burn";
type Output = { url: string; name: string; size: number };
// 자막 트랙 확인 상태: 확인 중이면 null, 읽지 못했으면 "error"
type Tracks = SubtitleTrack[] | "error" | null;

const PADS = [0, 2, 4] as const;

// 프레임 캔버스의 영역들 안 자막을 지웁니다. 작업 범위만 읽고 써서 프레임마다 돌려도 빠릅니다.
function cleanCanvas(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, areas: Rect[], o: DetectOptions) {
  const { width, height } = ctx.canvas;
  const area = workArea(areas, width, height);
  if (!area) return;
  const img = ctx.getImageData(area.x, area.y, area.w, area.h);
  if (cleanArea(img, area, areas, o)) ctx.putImageData(img, area.x, area.y);
}

export default function SubtitleRemover() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [tracks, setTracks] = useState<Tracks>(null);
  const [mode, setMode] = useState<Mode>("burn");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [seek, setSeek] = useState(0);
  const [areas, setAreas] = useState<Rect[]>([]);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [color, setColor] = useState<TextColor>("white");
  const [sensitivity, setSensitivity] = useState<Sensitivity>("normal");
  const [pad, setPad] = useState<number>(2);
  const [preview, setPreview] = useState(false);
  const [canPlay, setCanPlay] = useState(true);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<Output | null>(null);

  const view = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement | null>(null); // 고른 시점의 원본 프레임
  const srcUrl = useRef("");
  const video = useRef<HTMLVideoElement | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const scan = useRef<AbortController | null>(null);

  const detect: DetectOptions = { color, sensitivity, frameH: size.h, pad };

  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);
  useEffect(() => () => {
    cancelRef.current?.();
    scan.current?.abort();
    if (srcUrl.current) URL.revokeObjectURL(srcUrl.current);
  }, []);

  // 화면 캔버스: 원본(또는 미리보기 결과) 위에 고른 영역과 드래그 중인 영역을 그립니다.
  useEffect(() => {
    const c = view.current, b = base.current;
    if (!c || !b || !size.w || mode !== "burn") return;
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(b, 0, 0);
    if (preview) {
      cleanCanvas(ctx, areas, detect);
      return;
    }
    const lw = Math.max(2, Math.round(Math.max(size.w, size.h) / 400));
    ctx.lineWidth = lw;
    ctx.setLineDash([lw * 3, lw * 2]);
    const box = (r: Rect, stroke: string) => {
      ctx.fillStyle = "rgba(239,68,68,.18)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = stroke;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    };
    areas.forEach((r) => box(r, "#ef4444"));
    const d = drag && normalizeRect(drag.x0, drag.y0, drag.x1, drag.y1, size.w, size.h);
    if (d) box(d, "#f59e0b");
  }, [areas, drag, size, preview, color, sensitivity, pad, seek, mode]);

  const clearOutput = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setOutput(null);
    setProgress(null);
  };

  const pick = async (f: File | null) => {
    clearOutput();
    scan.current?.abort();
    setError("");
    setFile(null);
    setInfo(null);
    setTracks(null);
    setAreas([]);
    setPreview(false);
    setSize({ w: 0, h: 0 });
    base.current = null;
    video.current = null;
    if (srcUrl.current) URL.revokeObjectURL(srcUrl.current);
    srcUrl.current = "";
    if (!f) return;
    if (f.size > VIDEO_MAX_BYTES) {
      setError(t(`파일이 너무 큽니다. ${formatBytes(VIDEO_MAX_BYTES)} 이하의 동영상만 처리할 수 있습니다.`, `The file is too large. Videos up to ${formatBytes(VIDEO_MAX_BYTES)} are supported.`));
      return;
    }
    setBusy(t("동영상 정보를 읽는 중…", "Reading video info…"));
    try {
      const { probe } = await import("@/lib/tools/videoConvert");
      const i = await probe(f);
      const s = fitLongSide(i.width, i.height);
      const url = URL.createObjectURL(f);
      srcUrl.current = url;
      setFile(f);
      setInfo(i);
      setSize(s);
      setAreas([defaultArea(s.w, s.h)]);
      setMode("burn");
      // 장면 미리보기는 브라우저가 재생할 수 있어야 합니다. 못 해도 자막 트랙 빼기는 됩니다.
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.src = url;
      const ok = await new Promise<boolean>((done) => {
        v.onloadeddata = () => done(true);
        v.onerror = () => done(false);
      });
      setCanPlay(ok && !!v.videoWidth);
      if (ok && v.videoWidth) {
        video.current = v;
        base.current = document.createElement("canvas");
        base.current.width = s.w;
        base.current.height = s.h;
        await grabFrame(Math.min(i.duration / 2, Math.max(0.5, i.duration * 0.2)), s);
      }
      findTracks(f);
    } catch (e) {
      const { convertErrorMessage } = await import("@/lib/tools/videoConvert");
      setError(convertErrorMessage(e, t.lang));
    } finally {
      setBusy("");
    }
  };

  // 파일 안의 자막 트랙을 찾습니다. MKV는 파일 전체를 읽어야 해서 뒤에서 따로 돌립니다.
  const findTracks = async (f: File) => {
    const ctrl = new AbortController();
    scan.current = ctrl;
    try {
      const { extractSubtitles } = await import("@/lib/tools/subtitleExtract");
      const found = await extractSubtitles(f, () => {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setTracks(found);
      if (found.length > 0) setMode("track");
    } catch {
      if (!ctrl.signal.aborted) setTracks("error");
    }
  };

  // t초 장면을 원본 캔버스로 가져옵니다. 자막이 나오는 장면을 골라 위치와 결과를 확인할 때 씁니다.
  const grabFrame = async (sec: number, s = size) => {
    const v = video.current, b = base.current;
    if (!v || !b) return;
    await new Promise<void>((ok) => {
      v.onseeked = () => ok();
      v.currentTime = sec;
    });
    b.getContext("2d")!.drawImage(v, 0, 0, s.w, s.h);
    setSeek(sec);
  };

  // 화면 좌표 → 처리 크기 기준 픽셀 좌표
  const toPx = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * size.w, y: ((e.clientY - r.top) / r.height) * size.h };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (preview || busy || areas.length >= MAX_AREAS) return;
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
      setAreas((rs) => [...rs, r]);
      clearOutput();
    }
  };

  const run = async () => {
    if (!file || !info) return;
    if (mode === "burn" && areas.length === 0) return;
    clearOutput();
    setError("");
    scan.current?.abort();
    setBusy(mode === "track"
      ? t("자막 트랙을 빼는 중…", "Removing subtitle tracks…")
      : t("프레임마다 자막을 지우는 중… 시간이 걸리니 이 탭을 열어 두세요.", "Removing subtitles frame by frame… This takes a while, so keep this tab open."));
    setProgress(0);
    try {
      const vc = await import("@/lib/tools/videoConvert");
      let job: { cancel: () => void; done: Promise<{ blob: Blob; ext: string }> };
      if (mode === "track") {
        job = await vc.dropSubtitleTracks(file, setProgress);
      } else {
        const o = { ...detect };
        const a = areas.map((r) => ({ ...r }));
        // 원본 비트레이트를 처리 크기에 맞춰 옮겨, 다시 인코딩해도 화질이 크게 떨어지지 않게 합니다.
        const scale = (size.w * size.h) / (info.width * info.height);
        const bitrate = Math.max(800_000, Math.round(info.videoBitrate ? info.videoBitrate * scale : size.w * size.h * info.fps * 0.12));
        job = await vc.processFrames(file, { width: size.w, height: size.h, videoBitrate: bitrate }, (ctx) => cleanCanvas(ctx, a, o), setProgress);
      }
      cancelRef.current = job.cancel;
      const { blob, ext } = await job.done;
      setOutput({ url: URL.createObjectURL(blob), name: subtitleRemovedName(file.name, ext, t.lang), size: blob.size });
    } catch (e) {
      const { convertErrorMessage } = await import("@/lib/tools/videoConvert");
      const msg = convertErrorMessage(e, t.lang);
      setError(msg || t("처리를 멈췄습니다.", "Stopped."));
    } finally {
      cancelRef.current = null;
      setBusy("");
      setProgress(null);
    }
  };

  const trackLabel = (tr: SubtitleTrack) =>
    [tr.name, tr.language !== "und" ? tr.language : "", tr.codec].filter(Boolean).join(" · ");

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="video/*,.mkv" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <span>
          {file && info
            ? `${file.name} (${formatBytes(file.size)} · ${info.width}×${info.height} · ${formatTime(info.duration)})`
            : t("자막을 지울 동영상 파일을 고르세요 (MP4·MOV·MKV·WEBM)", "Choose a video to remove subtitles from (MP4, MOV, MKV, WEBM)")}
        </span>
      </label>

      {file && info && (
        <>
          <h3 className="sub">{t("자막 종류", "Subtitle type")}</h3>
          <div className="seg" role="group" aria-label={t("자막 종류", "Subtitle type")}>
            <button type="button" aria-pressed={mode === "track"} disabled={!!busy} onClick={() => { setMode("track"); clearOutput(); }}>
              {t("켜고 끄는 자막 트랙", "Subtitle tracks")}
            </button>
            <button type="button" aria-pressed={mode === "burn"} disabled={!!busy} onClick={() => { setMode("burn"); clearOutput(); }}>
              {t("화면에 새겨진 자막", "Burned-in subtitles")}
            </button>
          </div>
          <p className="note-sm">
            {tracks === null
              ? t("파일 안의 자막 트랙을 확인하는 중…", "Checking the file for subtitle tracks…")
              : tracks === "error"
                ? t("자막 트랙을 확인하지 못했습니다. 트랙 빼기는 그래도 시도할 수 있습니다.", "Couldn't check for subtitle tracks. You can still try removing them.")
                : tracks.length > 0
                  ? t(`자막 트랙 ${tracks.length}개: `, `${tracks.length} subtitle track(s): `) + tracks.map(trackLabel).join(", ")
                  : t("파일 안에 자막 트랙이 없습니다. 자막이 보인다면 화면에 새겨진 자막입니다.", "No subtitle tracks in this file. If you see subtitles, they're burned into the picture.")}
          </p>

          {mode === "track" && (
            <p className="note-sm">
              {t(
                "영상과 소리는 다시 인코딩하지 않고 그대로 옮기고 자막 트랙만 뺍니다. 화질이 그대로이고 몇 초에서 몇십 초면 끝납니다.",
                "The video and audio are copied as they are, without re-encoding, and only the subtitle tracks are left out. Quality is unchanged and it takes seconds.",
              )}
            </p>
          )}

          {mode === "burn" && !canPlay && (
            <p className="warn">{t("이 브라우저에서 재생할 수 없는 동영상이라 화면 자막을 지울 수 없습니다. MP4(H.264)나 WEBM 파일로 다시 시도해 주세요.", "This browser can't play this video, so burned-in subtitles can't be removed. Try an MP4 (H.264) or WEBM file.")}</p>
          )}

          {mode === "burn" && canPlay && size.w > 0 && (
            <>
              <h3 className="sub">{t("자막 영역 고르기", "Select the subtitle area")}</h3>
              <p className="note-sm">
                {preview
                  ? t("지운 결과를 보고 있습니다. 영역을 고치려면 '영역 다시 고르기'를 누르세요.", "You're viewing the result. Press 'Edit areas' to change the selection.")
                  : t(`화면 아래쪽이 미리 골라져 있습니다. 자막이 다른 곳에 나오면 '영역 모두 지우기' 후 드래그해 고르세요(최대 ${MAX_AREAS}곳).`, `The bottom of the frame is pre-selected. If subtitles appear elsewhere, press 'Clear all areas' and drag to select (up to ${MAX_AREAS}).`)}
              </p>
              <canvas
                ref={view}
                className="wm-canvas"
                style={{ cursor: preview ? "default" : "crosshair" }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={() => setDrag(null)}
                aria-label={t("자막 영역을 드래그해 고르는 화면", "Drag to select subtitle areas")}
              />
              <label>
                {t(`자막이 나오는 장면 찾기 (${formatTime(seek)} / ${formatTime(info.duration)})`, `Find a frame with subtitles (${formatTime(seek)} / ${formatTime(info.duration)})`)}
                <input
                  type="range" min={0} max={Math.max(0, info.duration - 0.05)} step={0.1} value={seek} disabled={!!busy}
                  onChange={(e) => grabFrame(Number(e.target.value))}
                />
              </label>

              {areas.length > 0 && (
                <ul className="filelist">
                  {areas.map((r, i) => (
                    <li key={`${r.x}-${r.y}-${i}`}>
                      <span className="fname"><b>{t(`영역 ${i + 1}`, `Area ${i + 1}`)}</b><small>{t(`위치 ${r.x}, ${r.y} · 크기 ${r.w}×${r.h}px`, `Position ${r.x}, ${r.y} · size ${r.w}×${r.h}px`)}</small></span>
                      <span className="ctrl">
                        <button type="button" aria-label={t(`영역 ${i + 1} 지우기`, `Remove area ${i + 1}`)} disabled={!!busy}
                          onClick={() => { setAreas(areas.filter((_, j) => j !== i)); setPreview(false); clearOutput(); }}>✕</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="sub">{t("자막 글자색", "Subtitle color")}</h3>
              <div className="seg" role="group" aria-label={t("자막 글자색", "Subtitle color")}>
                {([["white", "흰색", "White"], ["yellow", "노란색", "Yellow"], ["bright", "밝은 색 모두", "Any bright color"]] as const).map(([c, ko, en]) => (
                  <button key={c} type="button" aria-pressed={color === c} disabled={!!busy} onClick={() => { setColor(c); clearOutput(); }}>{t(ko, en)}</button>
                ))}
              </div>

              <h3 className="sub">{t("감지 민감도", "Detection sensitivity")}</h3>
              <div className="seg" role="group" aria-label={t("감지 민감도", "Detection sensitivity")}>
                {([["low", "낮게", "Low"], ["normal", "보통", "Normal"], ["high", "높게", "High"]] as const).map(([s, ko, en]) => (
                  <button key={s} type="button" aria-pressed={sensitivity === s} disabled={!!busy} onClick={() => { setSensitivity(s); clearOutput(); }}>{t(ko, en)}</button>
                ))}
              </div>

              <h3 className="sub">{t("가장자리 여유", "Edge padding")}</h3>
              <div className="seg" role="group" aria-label={t("가장자리 여유", "Edge padding")}>
                {PADS.map((p) => (
                  <button key={p} type="button" aria-pressed={pad === p} disabled={!!busy} onClick={() => { setPad(p); clearOutput(); }}>
                    {p === 0 ? t("기본", "Default") : t(`${p}px 넓게`, `+${p}px`)}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="actions">
        {file && mode === "burn" && canPlay && (
          <button type="button" className="btn sm ghost" disabled={areas.length === 0 || !!busy} onClick={() => setPreview(!preview)}>
            {preview ? t("영역 다시 고르기", "Edit areas") : t("미리보기", "Preview")}
          </button>
        )}
        {file && mode === "burn" && canPlay && areas.length > 0 && !busy && (
          <button type="button" className="btn sm ghost" onClick={() => { setAreas([]); setPreview(false); clearOutput(); }}>{t("영역 모두 지우기", "Clear all areas")}</button>
        )}
        {busy && progress !== null
          ? <button type="button" className="btn sm" onClick={() => cancelRef.current?.()}>{t("멈추기", "Stop")}</button>
          : (
            <button type="button" className="btn sm" disabled={!file || !!busy || (mode === "burn" && (!canPlay || areas.length === 0))} onClick={run}>
              {busy ? t("처리 중…", "Working…") : t("자막 지우기", "Remove subtitles")}
            </button>
          )}
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}{progress !== null && ` ${Math.round(progress * 100)}%`}</p>}
        {progress !== null && <progress className="wm-progress" value={progress} max={1} />}
        {error && <p className="warn">{error}</p>}
        {output && (
          <>
            {!output.name.endsWith(".mkv") && <video className="wm-canvas" src={output.url} controls playsInline />}
            <div className="actions">
              <a className="btn sm" href={output.url} download={output.name}>{t("내려받기", "Download")} ({formatBytes(output.size)})</a>
            </div>
          </>
        )}
        <p className="note">
          {t(
            "동영상은 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다. 직접 만들었거나 편집 권한이 있는 동영상에만 쓰세요.",
            "Videos are processed only in this browser and never uploaded. Use this only on videos you made or have permission to edit.",
          )}
        </p>
      </div>
    </div>
  );
}
