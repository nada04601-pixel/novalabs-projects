"use client";
import { useEffect, useRef, useState } from "react";
import { formatBytes, reduction } from "@/lib/tools/fileSize";
import {
  COMPRESS_PRESETS, editedName, estimateBytes, fitShortSide, formatTime, videoBitrate, VIDEO_MAX_BYTES, type CompressPreset,
} from "@/lib/tools/videoEdit";
import type { VideoInfo } from "@/lib/tools/videoConvert";

type Output = { url: string; name: string; size: number };

export default function VideoCompressor() {
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
      setError(`파일이 너무 큽니다. ${formatBytes(VIDEO_MAX_BYTES)} 이하의 동영상만 처리할 수 있습니다.`);
      return;
    }
    setBusy("동영상 정보를 읽는 중…");
    try {
      const { probe } = await import("@/lib/tools/videoConvert");
      setInfo(await probe(f));
      setFile(f);
    } catch (e) {
      const { convertErrorMessage } = await import("@/lib/tools/videoConvert");
      setError(convertErrorMessage(e) || "동영상을 읽지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  const run = async () => {
    if (!file || !info || !plan) return;
    clearOutput();
    setError("");
    setBusy("용량을 줄이는 중… 영상이 길면 시간이 걸리니 이 탭을 열어 두세요.");
    setProgress(0);
    try {
      const { convert } = await import("@/lib/tools/videoConvert");
      const job = await convert(file, info, {
        encode: { width: plan.w, height: plan.h, videoBitrate: plan.vbr, audioBitrate: COMPRESS_PRESETS[preset].audio, dropAudio },
      }, setProgress);
      cancelRef.current = job.cancel;
      const r = await job.done;
      setOutput({ url: URL.createObjectURL(r.blob), name: editedName(file.name, "압축", r.ext), size: r.blob.size });
    } catch (e) {
      const { convertErrorMessage } = await import("@/lib/tools/videoConvert");
      setError(convertErrorMessage(e) || "용량 줄이기를 멈췄습니다.");
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
        <span>{file ? `${file.name} (${formatBytes(file.size)})` : "용량을 줄일 동영상 파일을 고르세요"}</span>
      </label>

      {!supported && (
        <p className="warn">이 브라우저는 동영상 인코딩(WebCodecs)을 지원하지 않습니다. 최신 크롬·엣지·사파리(16.4 이상)에서 열어 주세요.</p>
      )}

      {info && plan && (
        <>
          <p className="note-sm">
            원본: {info.width}×{info.height} · {formatTime(info.duration)}
            {info.videoBitrate ? ` · 영상 ${(info.videoBitrate / 1e6).toFixed(1)}Mbps` : ""}
            {info.hasAudio ? "" : " · 소리 없음"}
          </p>

          <h3 className="sub">줄이는 정도</h3>
          <div className="seg" role="group" aria-label="줄이는 정도">
            {(Object.keys(COMPRESS_PRESETS) as CompressPreset[]).map((k) => (
              <button key={k} type="button" aria-pressed={preset === k} onClick={() => { setPreset(k); clearOutput(); }}>
                {COMPRESS_PRESETS[k].label} · {COMPRESS_PRESETS[k].desc}
              </button>
            ))}
          </div>
          {info.hasAudio && (
            <label className="inline">
              <input type="checkbox" checked={dropAudio} onChange={(e) => { setDropAudio(e.target.checked); clearOutput(); }} />
              소리 빼기
            </label>
          )}
          <p className="note-sm">
            {plan.w}×{plan.h} · 영상 {(plan.vbr / 1e6).toFixed(1)}Mbps로 다시 인코딩합니다.
            예상 크기 약 {formatBytes(plan.estimate)}
            {file && ` (원본 대비 ${Math.max(0, Math.round(reduction(file.size, plan.estimate) * 100))}% 감소)`}
          </p>
        </>
      )}

      <div className="actions">
        {busy && progress !== null
          ? <button type="button" className="btn sm" onClick={() => cancelRef.current?.()}>멈추기</button>
          : <button type="button" className="btn sm" disabled={!info || !supported || !!busy} onClick={run}>{busy ? "처리 중…" : "용량 줄이기"}</button>}
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}{progress !== null && ` ${Math.round(progress * 100)}%`}</p>}
        {progress !== null && <progress className="wm-progress" value={progress} max={1} />}
        {error && <p className="warn">{error}</p>}
        {output && file && (
          <>
            {saved > 0
              ? <p className="big"><strong>{Math.round(saved * 100)}% 줄었습니다</strong> {formatBytes(file.size)} → {formatBytes(output.size)}</p>
              : <p className="warn">원본보다 작아지지 않았습니다({formatBytes(file.size)} → {formatBytes(output.size)}). 이미 잘 압축된 영상이니 원본을 그대로 쓰거나 &apos;많이 줄이기&apos;를 골라 보세요.</p>}
            <video className="wm-canvas" src={output.url} controls playsInline />
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
