"use client";
import { useT } from "@/lib/useT";
import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import { editedName, formatTime, parseTime, trimError, VIDEO_MAX_BYTES } from "@/lib/tools/videoEdit";
import type { VideoInfo } from "@/lib/tools/videoConvert";

type Mode = "fast" | "exact";
type Output = { url: string; name: string; size: number };

export default function VideoTrimmer() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [src, setSrc] = useState("");
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [mode, setMode] = useState<Mode>("fast");
  const [canExact, setCanExact] = useState(true);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<Output | null>(null);
  const player = useRef<HTMLVideoElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const stopAt = useRef<number | null>(null);

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);
  useEffect(() => () => cancelRef.current?.(), []);
  useEffect(() => {
    import("@/lib/tools/videoConvert").then((m) => setCanExact(m.canReencode()));
  }, []);

  const start = parseTime(startText);
  const end = parseTime(endText);
  const problem = info ? trimError(start, end, info.duration, t.lang) : null;

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
      setError(t(`파일이 너무 큽니다. ${formatBytes(VIDEO_MAX_BYTES)} 이하의 동영상만 처리할 수 있습니다.`, `The file is too large. Videos up to ${formatBytes(VIDEO_MAX_BYTES)} are supported.`));
      return;
    }
    setBusy(t("동영상 정보를 읽는 중…", "Reading video info…"));
    try {
      const { probe } = await import("@/lib/tools/videoConvert");
      const i = await probe(f);
      setFile(f);
      setInfo(i);
      setSrc(URL.createObjectURL(f));
      setStartText(formatTime(0));
      setEndText(formatTime(i.duration));
    } catch (e) {
      const { convertErrorMessage } = await import("@/lib/tools/videoConvert");
      setError(convertErrorMessage(e, t.lang) || t("동영상을 읽지 못했습니다.", "Couldn't read the video."));
    } finally {
      setBusy("");
    }
  };

  const now = () => player.current?.currentTime ?? 0;
  const setStartNow = () => { setStartText(formatTime(now())); clearOutput(); };
  const setEndNow = () => { setEndText(formatTime(now())); clearOutput(); };

  // 고른 구간만 재생합니다. 끝 시간에 이르면 멈춥니다.
  const playRange = () => {
    const v = player.current;
    if (!v || start === null || end === null) return;
    stopAt.current = end;
    v.currentTime = start;
    v.play();
  };
  const onTime = () => {
    const v = player.current;
    if (v && stopAt.current !== null && v.currentTime >= stopAt.current) {
      v.pause();
      stopAt.current = null;
    }
  };

  const run = async () => {
    if (!file || !info || problem || start === null || end === null) return;
    clearOutput();
    setError("");
    setBusy(mode === "fast" ? t("자르는 중…", "Trimming…") : t("다시 인코딩하며 자르는 중… 영상이 길면 시간이 걸립니다.", "Re-encoding and trimming… Long videos take a while."));
    setProgress(0);
    try {
      const { convert } = await import("@/lib/tools/videoConvert");
      // 정확하게 자를 때는 크기는 그대로 두고 원본과 비슷한 비트레이트로 다시 인코딩합니다.
      const bitrate = Math.round(info.videoBitrate ?? info.width * info.height * (info.fps || 30) * 0.12);
      const job = await convert(file, info, {
        trim: { start, end: Math.min(end, info.duration) },
        encode: mode === "exact"
          ? { width: info.width - (info.width % 2), height: info.height - (info.height % 2), videoBitrate: bitrate, audioBitrate: 128_000, dropAudio: false }
          : undefined,
      }, setProgress);
      cancelRef.current = job.cancel;
      const r = await job.done;
      setOutput({ url: URL.createObjectURL(r.blob), name: editedName(file.name, t("자름", "trimmed"), r.ext, t.lang), size: r.blob.size });
    } catch (e) {
      const { convertErrorMessage } = await import("@/lib/tools/videoConvert");
      const m = convertErrorMessage(e, t.lang);
      setError(m || t("자르기를 멈췄습니다.", "Trimming stopped."));
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
            : t("자를 동영상 파일을 고르세요", "Choose a video to trim")}
        </span>
      </label>

      {info && (
        <>
          <video ref={player} className="wm-canvas" src={src} controls playsInline preload="metadata" onTimeUpdate={onTime} />

          <h3 className="sub">{t("남길 구간", "Segment to keep")}</h3>
          <div className="fields">
            <label>
              {t("시작", "Start")}
              <input value={startText} inputMode="decimal" placeholder="0:00.0" onChange={(e) => { setStartText(e.target.value); clearOutput(); }} />
            </label>
            <label>
              {t("끝", "End")}
              <input value={endText} inputMode="decimal" placeholder="1:23.5" onChange={(e) => { setEndText(e.target.value); clearOutput(); }} />
            </label>
          </div>
          <div className="actions">
            <button type="button" className="btn sm ghost" onClick={setStartNow}>{t("지금 장면을 시작으로", "Set start here")}</button>
            <button type="button" className="btn sm ghost" onClick={setEndNow}>{t("지금 장면을 끝으로", "Set end here")}</button>
            <button type="button" className="btn sm ghost" disabled={!!problem} onClick={playRange}>{t("구간 재생", "Play selection")}</button>
          </div>
          <p className="note-sm">
            {problem ?? t(`${formatTime(end! - start!)} 길이의 영상이 만들어집니다.`, `A ${formatTime(end! - start!)} video will be created.`)}
          </p>

          <h3 className="sub">{t("자르는 방식", "Method")}</h3>
          <div className="seg" role="group" aria-label={t("자르는 방식", "Method")}>
            <button type="button" aria-pressed={mode === "fast"} onClick={() => { setMode("fast"); clearOutput(); }}>{t("빠르게 (화질 그대로)", "Fast (original quality)")}</button>
            <button type="button" aria-pressed={mode === "exact"} disabled={!canExact} onClick={() => { setMode("exact"); clearOutput(); }}>{t("정확하게 (다시 인코딩)", "Exact (re-encode)")}</button>
          </div>
          <p className="note-sm">
            {mode === "fast"
              ? t("다시 인코딩하지 않아 몇 초 만에 끝나고 화질이 그대로입니다. 시작 앞의 키프레임까지 함께 담고 재생 시작점을 표시하는 방식이라, 일부 오래된 플레이어에서는 고른 시간보다 조금 앞부분이 보일 수 있습니다.", "No re-encoding, so it finishes in seconds at original quality. The keyframe before your start is included and the playback start is marked, so some older players may show a little extra at the beginning.")
              : t("고른 시간에 정확히 맞춰 자릅니다. 영상을 다시 인코딩하므로 시간이 더 걸리고 화질이 아주 약간 떨어질 수 있습니다.", "Cuts exactly at your chosen times. The video is re-encoded, so it takes longer and quality may drop very slightly.")}
            {!canExact && t(" 이 브라우저는 다시 인코딩을 지원하지 않아 '빠르게'만 쓸 수 있습니다.", " This browser can't re-encode video, so only 'Fast' is available.")}
          </p>
        </>
      )}

      <div className="actions">
        {busy && progress !== null
          ? <button type="button" className="btn sm" onClick={() => cancelRef.current?.()}>{t("멈추기", "Stop")}</button>
          : <button type="button" className="btn sm" disabled={!info || !!problem || !!busy} onClick={run}>{busy ? t("처리 중…", "Working…") : t("자르기", "Trim")}</button>}
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}{progress !== null && ` ${Math.round(progress * 100)}%`}</p>}
        {progress !== null && <progress className="wm-progress" value={progress} max={1} />}
        {error && <p className="warn">{error}</p>}
        {output && (
          <>
            <video className="wm-canvas" src={output.url} controls playsInline />
            <div className="actions">
              <a className="btn sm" href={output.url} download={output.name}>{t("내려받기", "Download")} ({formatBytes(output.size)})</a>
            </div>
          </>
        )}
        <p className="note">{t("파일은 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다.", "Files are processed only in this browser and never uploaded.")}</p>
      </div>
    </div>
  );
}
