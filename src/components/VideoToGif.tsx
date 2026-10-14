"use client";
import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import {
  editedName, estimateGifBytes, formatTime, frameTimes, GIF_FPS, GIF_MAX_SECONDS, GIF_WIDTHS, gifDelay, gifSize, parseTime,
  trimError, VIDEO_MAX_BYTES,
} from "@/lib/tools/videoEdit";
import type { VideoInfo } from "@/lib/tools/videoConvert";

type Output = { url: string; name: string; size: number };

export default function VideoToGif() {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [src, setSrc] = useState("");
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [fps, setFps] = useState<number>(12);
  const [width, setWidth] = useState<number>(480);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<Output | null>(null);
  const player = useRef<HTMLVideoElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);
  useEffect(() => () => cancelRef.current?.(), []);

  const start = parseTime(startText);
  const end = parseTime(endText);
  const problem = info
    ? trimError(start, end, info.duration)
      ?? (end! - start! > GIF_MAX_SECONDS + 0.05 ? `GIF는 한 번에 ${GIF_MAX_SECONDS}초까지 만들 수 있습니다. 구간을 줄여 주세요.` : null)
    : null;
  const plan = info && !problem
    ? (() => {
      const size = gifSize(info.width, info.height, width);
      const times = frameTimes(start!, end!, fps);
      return { ...size, times, estimate: estimateGifBytes(size.w, size.h, times.length) };
    })()
    : null;

  const clearOutput = () => {
    cancelRef.current?.();
    setOutput(null);
  };

  const pick = async (f: File | null) => {
    clearOutput();
    setError("");
    setFile(null);
    setInfo(null);
    setSrc("");
    if (!f) return;
    if (f.size > VIDEO_MAX_BYTES) {
      setError(`파일이 너무 큽니다. ${formatBytes(VIDEO_MAX_BYTES)} 이하의 동영상만 처리할 수 있습니다.`);
      return;
    }
    setBusy("동영상 정보를 읽는 중…");
    try {
      const { probe } = await import("@/lib/tools/videoConvert");
      const i = await probe(f);
      setFile(f);
      setInfo(i);
      setSrc(URL.createObjectURL(f));
      setStartText(formatTime(0));
      setEndText(formatTime(Math.min(i.duration, 5))); // 처음 5초를 기본 구간으로
    } catch (e) {
      const { convertErrorMessage } = await import("@/lib/tools/videoConvert");
      setError(convertErrorMessage(e) || "동영상을 읽지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  const now = () => player.current?.currentTime ?? 0;

  const run = async () => {
    if (!file || !plan) return;
    clearOutput();
    setError("");
    setBusy("GIF를 만드는 중…");
    setProgress(0);
    try {
      const { makeGif } = await import("@/lib/tools/videoConvert");
      const job = await makeGif(file, { times: plan.times, width: plan.w, height: plan.h, delay: gifDelay(fps) }, setProgress);
      cancelRef.current = job.cancel;
      const blob = await job.done;
      setOutput({ url: URL.createObjectURL(blob), name: editedName(file.name, "움짤", "gif"), size: blob.size });
    } catch (e) {
      const { convertErrorMessage } = await import("@/lib/tools/videoConvert");
      setError(convertErrorMessage(e) || "GIF 만들기를 멈췄습니다.");
    } finally {
      cancelRef.current = null;
      setBusy("");
      setProgress(null);
    }
  };

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="video/*,.mkv" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <span>
          {file && info
            ? `${file.name} (${formatBytes(file.size)} · ${info.width}×${info.height} · ${formatTime(info.duration)})`
            : "GIF로 바꿀 동영상 파일을 고르세요"}
        </span>
      </label>

      {info && (
        <>
          <video ref={player} className="wm-canvas" src={src} controls playsInline preload="metadata" />

          <h3 className="sub">GIF로 만들 구간 (최대 {GIF_MAX_SECONDS}초)</h3>
          <div className="fields">
            <label>
              시작
              <input value={startText} inputMode="decimal" placeholder="0:00.0" onChange={(e) => { setStartText(e.target.value); clearOutput(); }} />
            </label>
            <label>
              끝
              <input value={endText} inputMode="decimal" placeholder="0:05.0" onChange={(e) => { setEndText(e.target.value); clearOutput(); }} />
            </label>
          </div>
          <div className="actions">
            <button type="button" className="btn sm ghost" onClick={() => { setStartText(formatTime(now())); clearOutput(); }}>지금 장면을 시작으로</button>
            <button type="button" className="btn sm ghost" onClick={() => { setEndText(formatTime(now())); clearOutput(); }}>지금 장면을 끝으로</button>
          </div>

          <h3 className="sub">크기와 부드러움</h3>
          <div className="seg" role="group" aria-label="GIF 가로 크기">
            {GIF_WIDTHS.map((w) => (
              <button key={w} type="button" aria-pressed={width === w} onClick={() => { setWidth(w); clearOutput(); }}>가로 {w}px</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="초당 장면 수">
            {GIF_FPS.map((f) => (
              <button key={f} type="button" aria-pressed={fps === f} onClick={() => { setFps(f); clearOutput(); }}>
                {f}fps{f === 8 ? " (가볍게)" : f === 15 ? " (부드럽게)" : ""}
              </button>
            ))}
          </div>
          <p className="note-sm">
            {problem ?? (plan && `${plan.w}×${plan.h} · ${plan.times.length}장 · 예상 크기 약 ${formatBytes(plan.estimate)}`)}
          </p>
          {plan && plan.estimate > 10 * 1024 * 1024 && (
            <p className="warn">GIF가 10MB를 넘을 수 있습니다. 메신저·커뮤니티는 용량 제한이 있으니 구간을 줄이거나 크기·fps를 낮춰 보세요.</p>
          )}
        </>
      )}

      <div className="actions">
        {busy && progress !== null
          ? <button type="button" className="btn sm" onClick={() => cancelRef.current?.()}>멈추기</button>
          : <button type="button" className="btn sm" disabled={!plan || !!busy} onClick={run}>{busy ? "처리 중…" : "GIF 만들기"}</button>}
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}{progress !== null && ` ${Math.round(progress * 100)}%`}</p>}
        {progress !== null && <progress className="wm-progress" value={progress} max={1} />}
        {error && <p className="warn">{error}</p>}
        {output && (
          <>
            <img className="wm-canvas" src={output.url} alt="만든 GIF 미리보기" />
            <div className="actions">
              <a className="btn sm" href={output.url} download={output.name}>내려받기 ({formatBytes(output.size)})</a>
            </div>
          </>
        )}
        <p className="note">파일은 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다.</p>
      </div>
    </div>
  );
}
