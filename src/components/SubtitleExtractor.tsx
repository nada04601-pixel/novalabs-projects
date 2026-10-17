"use client";
import { useT } from "@/lib/useT";
import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import { formatTime, VIDEO_MAX_BYTES } from "@/lib/tools/videoEdit";
import { cueCount, formatsFor, IMAGE_CODECS, languageName, previewLines, render, subtitleName, type SubtitleFormat, type SubtitleTrack } from "@/lib/tools/subtitles";

const FORMAT_LABEL: Record<SubtitleFormat, [string, string]> = {
  srt: ["SRT", "SRT"],
  vtt: ["VTT", "VTT"],
  ass: ["ASS (꾸밈 유지)", "ASS (keeps styling)"],
  txt: ["TXT (글만)", "TXT (text only)"],
};

function download(text: string, name: string) {
  // BOM을 붙여야 윈도 메모장·일부 재생기가 한글을 깨뜨리지 않습니다.
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SubtitleExtractor() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [tracks, setTracks] = useState<SubtitleTrack[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const pick = async (f: File | null) => {
    abortRef.current?.abort();
    setError("");
    setTracks(null);
    setFile(f);
    if (!f) return;
    if (f.size > VIDEO_MAX_BYTES) {
      setError(t(`파일이 너무 큽니다. ${formatBytes(VIDEO_MAX_BYTES)} 이하의 동영상만 처리할 수 있습니다.`, `The file is too large. Videos up to ${formatBytes(VIDEO_MAX_BYTES)} are supported.`));
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setProgress(0);
    const { extractSubtitles, extractErrorMessage } = await import("@/lib/tools/subtitleExtract");
    try {
      setTracks(await extractSubtitles(f, setProgress, ctrl.signal));
    } catch (e) {
      if (!ctrl.signal.aborted || abortRef.current === ctrl) setError(extractErrorMessage(e, t.lang));
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const textTracks = tracks?.filter((tr) => tr.source) ?? [];
  const otherTracks = tracks?.filter((tr) => !tr.source) ?? [];

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="video/*,.mkv,.mp4,.m4v,.mov,.webm" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <span>{file ? `${file.name} (${formatBytes(file.size)})` : t("자막을 꺼낼 동영상 파일을 고르세요 (MKV·MP4·MOV·WebM)", "Choose a video to extract subtitles from (MKV, MP4, MOV, WebM)")}</span>
      </label>

      <div className="result" aria-live="polite">
        {busy && (
          <>
            <p className="note" role="status">{t("자막 트랙을 찾는 중…", "Looking for subtitle tracks…")} {Math.round(progress * 100)}%</p>
            <progress className="wm-progress" value={progress} max={1} />
            <div className="actions">
              <button type="button" className="btn sm" onClick={() => abortRef.current?.abort()}>{t("멈추기", "Stop")}</button>
            </div>
          </>
        )}
        {error && <p className="warn">{error}</p>}

        {tracks && file && (
          <>
            {textTracks.length === 0 && (
              <p className="warn">
                {otherTracks.length > 0
                  ? t("이 동영상의 자막은 그림으로 저장된 자막이라 글자로 꺼낼 수 없습니다.", "This video's subtitles are stored as images, so they can't be extracted as text.")
                  : t("이 동영상에는 따로 들어 있는 자막 트랙이 없습니다. 화면에 새겨진 자막은 꺼낼 수 없습니다.", "This video has no separate subtitle tracks. Subtitles burned into the picture can't be extracted.")}
              </p>
            )}
            {textTracks.length > 0 && (
              <h3 className="sub">{t(`자막 트랙 ${textTracks.length}개`, `${textTracks.length} subtitle track${textTracks.length > 1 ? "s" : ""}`)}</h3>
            )}
            <ul className="list">
              {textTracks.map((tr) => {
                const count = cueCount(tr);
                const flags = [tr.isDefault && t("기본", "default"), tr.forced && t("강제", "forced")].filter(Boolean).join(" · ");
                return (
                  <li key={tr.number}>
                    <strong>
                      {languageName(tr.language, t.lang)}
                      {tr.name && ` · ${tr.name}`}
                    </strong>
                    <p>
                      {t(`트랙 ${tr.number}`, `Track ${tr.number}`)} · {tr.codec} · {t(`자막 ${count.toLocaleString("ko-KR")}개`, `${count.toLocaleString("en-US")} lines`)}
                      {flags && ` · ${flags}`}
                    </p>
                    {count > 0 ? (
                      <>
                        <div className="note-sm">
                          {previewLines(tr).map((c, i) => (
                            <div key={i}>
                              {formatTime(c.start)} {c.text.replace(/\n/g, " / ")}
                            </div>
                          ))}
                        </div>
                        <div className="actions">
                          {formatsFor(tr).map((fmt) => (
                            <button key={fmt} type="button" className="btn sm ghost" onClick={() => download(render(tr, fmt), subtitleName(file.name, tr, textTracks, fmt, t.lang))}>
                              {t(...FORMAT_LABEL[fmt])}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p>{t("이 트랙에는 자막 내용이 없습니다.", "This track has no subtitle lines.")}</p>
                    )}
                  </li>
                );
              })}
              {otherTracks.map((tr) => (
                <li key={tr.number}>
                  <strong>{languageName(tr.language, t.lang)}{tr.name && ` · ${tr.name}`}</strong>
                  <p>
                    {t(`트랙 ${tr.number}`, `Track ${tr.number}`)} · {IMAGE_CODECS[tr.codec] ?? tr.codec} ·{" "}
                    {IMAGE_CODECS[tr.codec]
                      ? t("그림 자막이라 글자로 꺼낼 수 없습니다", "image-based, can't be extracted as text")
                      : t("지원하지 않는 자막 형식입니다", "unsupported subtitle format")}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="note">{t("파일은 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다.", "Files are processed only in this browser and never uploaded.")}</p>
      </div>
    </div>
  );
}
