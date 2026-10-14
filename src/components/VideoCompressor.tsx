"use client";
import { useT } from "@/lib/useT";
import { useEffect, useRef, useState } from "react";
import { formatBytes, reduction } from "@/lib/tools/fileSize";
import {
  COMPRESS_PRESETS, editedName, estimateBytes, fitShortSide, formatTime, videoBitrate, VIDEO_MAX_BYTES, type CompressPreset,
} from "@/lib/tools/videoEdit";
import type { VideoInfo } from "@/lib/tools/videoConvert";

type Output = { url: string; name: string; size: number };

export default function VideoCompressor() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [preset, setPreset] = useState<CompressPreset>("medium");
  const [dropAudio, setDropAudio] = useState(false);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<Output | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);
  useEffect(() => () => cancelRef.current?.(), []);
  useEffect(() => {
    import("@/lib/tools/videoConvert").then((m) => setSupported(m.canReencode()));
  }, []);

  // 고른 프리셋으로 만들 크기·비트레이트와 예상 용량
  const plan = (() => {
    if (!info) return null;
    const p = COMPRESS_PRESETS[preset];
    const size = fitShortSide(info.width, info.height, p.maxShort);
    const vbr = videoBitrate(size.w, size.h, info.fps, p.bpp, info.videoBitrate);
    const abr = dropAudio || !info.hasAudio ? 0 : p.audio;
    return { ...size, vbr, abr, estimate: estimateBytes(vbr, abr, info.duration) };
  })();

  const clearOutput = () => {
    cancelRef.current?.();
    setOutput(null);
  };

  const pick = async (f: File | null) => {
    clearOutput();
    setError("");
    setFile(null);
    setInfo(null);
    if (!f) return;
    if (f.size > VIDEO_MAX_BYTES) {
      setError(t(`파일이 너무 큽니다. ${formatBytes(VIDEO_MAX_BYTES)} 이하의 동영상만 처리할 수 있습니다.`, `The file is too large. Videos up to ${formatBytes(VIDEO_MAX_BYTES)} are supported.`));
      return;
    }
    setBusy(t("동영상 정보를 읽는 중…", "Reading video info…"));
    try {
      const { probe } = await import("@/lib/tools/videoConvert");
      setInfo(await probe(f));
      setFile(f);
    } catch (e) {
      const { convertErrorMessage } = await import("@/lib/tools/videoConvert");
      setError(convertErrorMessage(e, t.lang) || t("동영상을 읽지 못했습니다.", "Couldn't read the video."));
    } finally {
      setBusy("");
    }
  };

  const run = async () => {
    if (!file || !info || !plan) return;
    clearOutput();
    setError("");
    setBusy(t("용량을 줄이는 중… 영상이 길면 시간이 걸리니 이 탭을 열어 두세요.", "Compressing… Long videos take a while, so keep this tab open."));
    setProgress(0);
    try {
      const { convert } = await import("@/lib/tools/videoConvert");
      const job = await convert(file, info, {
        encode: { width: plan.w, height: plan.h, videoBitrate: plan.vbr, audioBitrate: COMPRESS_PRESETS[preset].audio, dropAudio },
      }, setProgress);
      cancelRef.current = job.cancel;
      const r = await job.done;
      setOutput({ url: URL.createObjectURL(r.blob), name: editedName(file.name, t("압축", "compressed"), r.ext, t.lang), size: r.blob.size });
    } catch (e) {
      const { convertErrorMessage } = await import("@/lib/tools/videoConvert");
      setError(convertErrorMessage(e, t.lang) || t("용량 줄이기를 멈췄습니다.", "Compression stopped."));
    } finally {
      cancelRef.current = null;
      setBusy("");
      setProgress(null);
    }
  };

  const saved = file && output ? reduction(file.size, output.size) : 0;

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="video/*,.mkv" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <span>{file ? `${file.name} (${formatBytes(file.size)})` : t("용량을 줄일 동영상 파일을 고르세요", "Choose a video to compress")}</span>
      </label>

      {!supported && (
        <p className="warn">{t("이 브라우저는 동영상 인코딩(WebCodecs)을 지원하지 않습니다. 최신 크롬·엣지·사파리(16.4 이상)에서 열어 주세요.", "This browser doesn't support video encoding (WebCodecs). Please open this page in the latest Chrome, Edge or Safari (16.4+).")}</p>
      )}

      {info && plan && (
        <>
          <p className="note-sm">
            {t("원본", "Original")}: {info.width}×{info.height} · {formatTime(info.duration)}
            {info.videoBitrate ? t(` · 영상 ${(info.videoBitrate / 1e6).toFixed(1)}Mbps`, ` · video ${(info.videoBitrate / 1e6).toFixed(1)} Mbps`) : ""}
            {info.hasAudio ? "" : t(" · 소리 없음", " · no audio")}
          </p>

          <h3 className="sub">{t("줄이는 정도", "Compression level")}</h3>
          <div className="seg" role="group" aria-label={t("줄이는 정도", "Compression level")}>
            {(Object.keys(COMPRESS_PRESETS) as CompressPreset[]).map((k) => (
              <button key={k} type="button" aria-pressed={preset === k} onClick={() => { setPreset(k); clearOutput(); }}>
                {t(COMPRESS_PRESETS[k].label, COMPRESS_PRESETS[k].labelEn)} · {COMPRESS_PRESETS[k].desc}
              </button>
            ))}
          </div>
          {info.hasAudio && (
            <label className="inline">
              <input type="checkbox" checked={dropAudio} onChange={(e) => { setDropAudio(e.target.checked); clearOutput(); }} />
              {t("소리 빼기", "Remove audio")}
            </label>
          )}
          <p className="note-sm">
            {t(`${plan.w}×${plan.h} · 영상 ${(plan.vbr / 1e6).toFixed(1)}Mbps로 다시 인코딩합니다.`, `Re-encodes at ${plan.w}×${plan.h}, video ${(plan.vbr / 1e6).toFixed(1)} Mbps.`)}{" "}
            {t("예상 크기 약", "Estimated size about")} {formatBytes(plan.estimate)}
            {file && t(` (원본 대비 ${Math.max(0, Math.round(reduction(file.size, plan.estimate) * 100))}% 감소)`, ` (${Math.max(0, Math.round(reduction(file.size, plan.estimate) * 100))}% smaller than the original)`)}
          </p>
        </>
      )}

      <div className="actions">
        {busy && progress !== null
          ? <button type="button" className="btn sm" onClick={() => cancelRef.current?.()}>{t("멈추기", "Stop")}</button>
          : <button type="button" className="btn sm" disabled={!info || !supported || !!busy} onClick={run}>{busy ? t("처리 중…", "Working…") : t("용량 줄이기", "Compress")}</button>}
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}{progress !== null && ` ${Math.round(progress * 100)}%`}</p>}
        {progress !== null && <progress className="wm-progress" value={progress} max={1} />}
        {error && <p className="warn">{error}</p>}
        {output && file && (
          <>
            {saved > 0
              ? <p className="big"><strong>{t(`${Math.round(saved * 100)}% 줄었습니다`, `${Math.round(saved * 100)}% smaller`)}</strong> {formatBytes(file.size)} → {formatBytes(output.size)}</p>
              : <p className="warn">{t(`원본보다 작아지지 않았습니다(${formatBytes(file.size)} → ${formatBytes(output.size)}). 이미 잘 압축된 영상이니 원본을 그대로 쓰거나 '많이 줄이기'를 골라 보세요.`, `It didn't get smaller than the original (${formatBytes(file.size)} → ${formatBytes(output.size)}). The video is already well compressed - keep the original or choose 'Smallest'.`)}</p>}
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
