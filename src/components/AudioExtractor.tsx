"use client";
import { useT } from "@/lib/useT";
import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import { editedName, estimateBytes, formatTime, MP3_BITRATES, parseTime, trimError, VIDEO_MAX_BYTES } from "@/lib/tools/videoEdit";
import type { VideoInfo } from "@/lib/tools/videoConvert";

type Output = { url: string; name: string; size: number };

export default function AudioExtractor() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [src, setSrc] = useState("");
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [kbps, setKbps] = useState<number>(192);
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
  const problem = info ? trimError(start, end, info.duration, t.lang) : null;
  const whole = info && start === 0 && end !== null && end >= info.duration - 0.05;

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
      if (!i.hasAudio) throw new Error("no-audio");
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

  const run = async () => {
    if (!file || !info || problem || start === null || end === null) return;
    clearOutput();
    setError("");
    setBusy(t("MP3로 바꾸는 중…", "Converting to MP3…"));
    setProgress(0);
    try {
      const { extractMp3 } = await import("@/lib/tools/videoConvert");
      const job = await extractMp3(file, { bitrate: kbps * 1000, trim: whole ? undefined : { start, end: Math.min(end, info.duration) } }, setProgress);
      cancelRef.current = job.cancel;
      const blob = await job.done;
      setOutput({ url: URL.createObjectURL(blob), name: editedName(file.name, t("소리", "audio"), "mp3", t.lang), size: blob.size });
    } catch (e) {
      const { convertErrorMessage } = await import("@/lib/tools/videoConvert");
      setError(convertErrorMessage(e, t.lang) || t("MP3 추출을 멈췄습니다.", "MP3 extraction stopped."));
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
            ? `${file.name} (${formatBytes(file.size)} · ${formatTime(info.duration)})`
            : t("소리를 뽑을 동영상 파일을 고르세요", "Choose a video to extract audio from")}
        </span>
      </label>

      {info && (
        <>
          <video ref={player} className="wm-canvas" src={src} controls playsInline preload="metadata" />

          <h3 className="sub">{t("뽑을 구간", "Segment")}</h3>
          <div className="fields">
            <label>
              {t("시작", "Start")}
              <input value={startText} inputMode="decimal" placeholder="0:00.0" onChange={(e) => { setStartText(e.target.value); clearOutput(); }} />
            </label>
            <label>
              {t("끝", "End")}
              <input value={endText} inputMode="decimal" placeholder="3:20.0" onChange={(e) => { setEndText(e.target.value); clearOutput(); }} />
            </label>
          </div>
          <div className="actions">
            <button type="button" className="btn sm ghost" onClick={() => { setStartText(formatTime(now())); clearOutput(); }}>{t("지금 장면을 시작으로", "Set start here")}</button>
            <button type="button" className="btn sm ghost" onClick={() => { setEndText(formatTime(now())); clearOutput(); }}>{t("지금 장면을 끝으로", "Set end here")}</button>
            <button type="button" className="btn sm ghost" onClick={() => { setStartText(formatTime(0)); setEndText(formatTime(info.duration)); clearOutput(); }}>{t("전체", "Whole video")}</button>
          </div>

          <h3 className="sub">{t("음질", "Quality")}</h3>
          <div className="seg" role="group" aria-label={t("음질", "Quality")}>
            {MP3_BITRATES.map((b) => (
              <button key={b} type="button" aria-pressed={kbps === b} onClick={() => { setKbps(b); clearOutput(); }}>
                {b}kbps{b === 128 ? t(" (용량 작게)", " (smaller)") : b === 320 ? t(" (최고 음질)", " (best)") : t(" (권장)", " (recommended)")}
              </button>
            ))}
          </div>
          <p className="note-sm">
            {problem ?? `${whole ? t("전체", "Whole video") : formatTime(end! - start!)} · ${t("예상 크기 약", "estimated size about")} ${formatBytes(estimateBytes(0, kbps * 1000, end! - start!))}`}
          </p>
        </>
      )}

      <div className="actions">
        {busy && progress !== null
          ? <button type="button" className="btn sm" onClick={() => cancelRef.current?.()}>{t("멈추기", "Stop")}</button>
          : <button type="button" className="btn sm" disabled={!info || !!problem || !!busy} onClick={run}>{busy ? t("처리 중…", "Working…") : t("MP3로 추출하기", "Extract MP3")}</button>}
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}{progress !== null && ` ${Math.round(progress * 100)}%`}</p>}
        {progress !== null && <progress className="wm-progress" value={progress} max={1} />}
        {error && <p className="warn">{error}</p>}
        {output && (
          <>
            <audio className="wm-audio" src={output.url} controls />
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
