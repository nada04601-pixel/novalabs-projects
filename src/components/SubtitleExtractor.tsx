"use client";
import { useT } from "@/lib/useT";
import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import { formatTime, VIDEO_MAX_BYTES } from "@/lib/tools/videoEdit";
import { cueCount, formatsFor, IMAGE_CODECS, languageName, previewLines, render, subtitleName, type SubtitleCue, type SubtitleFormat, type SubtitleTrack } from "@/lib/tools/subtitles";
import { mergeRepeats, SPEECH_LANGUAGES, SPEECH_MAX_SECONDS, splitLongCue, WHISPER_MODELS, type SpeechLanguage, type WhisperModel } from "@/lib/tools/transcribe";
import type { WhisperMessage } from "@/lib/tools/whisper.worker";

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

// 자막 미리보기와 형식별 내려받기 버튼
function TrackFiles({ track, all, videoName }: { track: SubtitleTrack; all: SubtitleTrack[]; videoName: string }) {
  const t = useT();
  return (
    <>
      <div className="note-sm">
        {previewLines(track).map((c, i) => (
          <div key={i}>
            {formatTime(c.start)} {c.text.replace(/\n/g, " / ")}
          </div>
        ))}
      </div>
      <div className="actions">
        {formatsFor(track).map((fmt) => (
          <button key={fmt} type="button" className="btn sm ghost" onClick={() => download(render(track, fmt), subtitleName(videoName, track, all, fmt, t.lang))}>
            {t(...FORMAT_LABEL[fmt])}
          </button>
        ))}
      </div>
    </>
  );
}

type SpeechState =
  | { phase: "idle" }
  | { phase: "decode"; progress: number }
  | { phase: "load"; loaded: number; total: number }
  | { phase: "recognize"; done: number; total: number; device: "webgpu" | "wasm" };

// 소리를 듣고 받아 적어 자막을 만듭니다(Whisper). 자막 트랙이 없는 동영상에도 쓸 수 있습니다.
function SpeechToSubtitle({ file }: { file: File }) {
  const t = useT();
  const [language, setLanguage] = useState<SpeechLanguage>(t.lang === "en" ? "english" : "korean");
  const [model, setModel] = useState<WhisperModel>("base");
  const [state, setState] = useState<SpeechState>({ phase: "idle" });
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [result, setResult] = useState<SubtitleTrack | null>(null);
  const [error, setError] = useState("");
  const worker = useRef<Worker | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    worker.current?.terminate();
    worker.current = null;
  };
  useEffect(() => stop, []);

  const finish = (all: SubtitleCue[]) => {
    const lang = SPEECH_LANGUAGES.find((l) => l.v === language)!;
    setResult({
      number: 0,
      codec: "Whisper",
      source: "srt",
      language: lang.code,
      name: t("음성 인식", "Speech recognition"),
      isDefault: false,
      forced: false,
      cues: mergeRepeats(all).flatMap((c) => splitLongCue(c)),
    });
  };

  const run = async () => {
    stop();
    setError("");
    setCues([]);
    setResult(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ phase: "decode", progress: 0 });
    let samples: Float32Array;
    try {
      const { decodeSpeechAudio } = await import("@/lib/tools/audioDecode");
      samples = (await decodeSpeechAudio(file, (p) => setState({ phase: "decode", progress: p }), ctrl.signal)).samples;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!ctrl.signal.aborted)
        setError(
          msg === "no-audio" ? t("이 동영상에는 소리가 없습니다.", "This video has no audio.")
          : msg === "too-long" ? t(`${SPEECH_MAX_SECONDS / 60}분보다 긴 동영상은 받아 적을 수 없습니다. 동영상 자르기로 나눈 뒤 다시 해 보세요.`, `Videos longer than ${SPEECH_MAX_SECONDS / 60} minutes aren't supported. Split it with the video trimmer and try again.`)
          : msg === "audio-decode" ? t("이 브라우저가 이 동영상의 소리 형식을 읽지 못합니다. 크롬이나 엣지에서 다시 해 보세요.", "This browser can't decode the video's audio. Try Chrome or Edge.")
          : t("소리를 읽지 못했습니다.", "Couldn't read the audio."),
        );
      setState({ phase: "idle" });
      return;
    }
    if (ctrl.signal.aborted) return;

    setState({ phase: "load", loaded: 0, total: 0 });
    const w = new Worker(new URL("../lib/tools/whisper.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    const got: SubtitleCue[] = [];
    let device: "webgpu" | "wasm" = "wasm";
    w.onmessage = (e: MessageEvent<WhisperMessage>) => {
      const m = e.data;
      if (m.type === "load") setState({ phase: "load", loaded: m.loaded, total: m.total });
      else if (m.type === "ready") {
        device = m.device;
        setState({ phase: "recognize", done: 0, total: 1, device });
      } else if (m.type === "chunk") {
        got.push(...m.cues);
        setCues([...got]);
        setState({ phase: "recognize", done: m.done, total: m.total, device });
      } else {
        if (m.type === "done") finish(got);
        else setError(t(`음성 인식을 하지 못했습니다. 인터넷 연결을 확인하거나 다른 브라우저에서 해 보세요. (${m.message})`, `Speech recognition failed. Check your connection or try another browser. (${m.message})`));
        stop();
        setState({ phase: "idle" });
      }
    };
    w.onerror = () => {
      setError(t("음성 인식을 시작하지 못했습니다. 다른 브라우저에서 해 보세요.", "Couldn't start speech recognition. Try another browser."));
      stop();
      setState({ phase: "idle" });
    };
    w.postMessage({ samples, model, language }, [samples.buffer]);
  };

  // 멈추면 그때까지 받아 적은 부분만이라도 자막으로 남깁니다.
  const cancel = () => {
    const partial = state.phase === "recognize" ? cues : [];
    stop();
    setState({ phase: "idle" });
    if (partial.length) finish(partial);
  };

  const busy = state.phase !== "idle";
  return (
    <>
      <h3 className="sub">{t("소리를 듣고 자막 만들기", "Create subtitles from speech")}</h3>
      <p className="note-sm">
        {t(
          "말소리를 AI(Whisper)가 받아 적어 자막을 만듭니다. 처음 한 번 AI 모델을 내려받고, 소리는 이 브라우저 밖으로 보내지 않습니다.",
          "AI (Whisper) transcribes the speech into subtitles. The AI model is downloaded once; the audio never leaves this browser.",
        )}
      </p>
      <div className="seg" role="group" aria-label={t("말하는 언어", "Spoken language")}>
        {SPEECH_LANGUAGES.map((l) => (
          <button key={l.v} type="button" aria-pressed={language === l.v} disabled={busy} onClick={() => setLanguage(l.v)}>
            {t(l.label, l.en)}
          </button>
        ))}
      </div>
      <div className="seg" role="group" aria-label={t("인식 방식", "Model")}>
        {(Object.keys(WHISPER_MODELS) as WhisperModel[]).map((k) => (
          <button key={k} type="button" aria-pressed={model === k} disabled={busy} onClick={() => setModel(k)}>
            {t(WHISPER_MODELS[k].label, WHISPER_MODELS[k].labelEn)} ({t(WHISPER_MODELS[k].size, WHISPER_MODELS[k].sizeEn)})
          </button>
        ))}
      </div>
      <div className="actions">
        {busy
          ? <button type="button" className="btn sm" onClick={cancel}>{t("멈추기", "Stop")}</button>
          : <button type="button" className="btn sm" onClick={run}>{result ? t("다시 만들기", "Run again") : t("자막 만들기", "Create subtitles")}</button>}
      </div>

      {state.phase === "decode" && <Status text={t("소리를 꺼내는 중…", "Extracting audio…")} value={state.progress} />}
      {state.phase === "load" && (
        <Status
          text={state.total ? `${t("AI 모델을 내려받는 중…", "Downloading the AI model…")} ${formatBytes(state.loaded)} / ${formatBytes(state.total)}` : t("AI 모델을 준비하는 중…", "Preparing the AI model…")}
          value={state.total ? state.loaded / state.total : null}
        />
      )}
      {state.phase === "recognize" && (
        <>
          <Status text={`${t("받아 적는 중…", "Transcribing…")} (${state.device === "webgpu" ? t("그래픽 카드 사용", "using GPU") : t("CPU 사용, 시간이 걸립니다", "using CPU, this takes a while")})`} value={state.done / state.total} />
          {cues.length > 0 && (
            <div className="note-sm">
              {cues.slice(-3).map((c, i) => (
                <div key={i}>{formatTime(c.start)} {c.text}</div>
              ))}
            </div>
          )}
        </>
      )}
      {error && <p className="warn">{error}</p>}
      {result && (
        result.cues.length ? (
          <ul className="list">
            <li>
              <strong>{t("음성 인식 자막", "Speech-recognized subtitles")} · {languageName(result.language, t.lang)}</strong>
              <p>{t(`자막 ${cueCount(result).toLocaleString("ko-KR")}개 · 잘못 들은 부분이 있을 수 있으니 확인 후 쓰세요`, `${cueCount(result).toLocaleString("en-US")} lines · check for mistakes before use`)}</p>
              <TrackFiles track={result} all={[result]} videoName={file.name} />
            </li>
          </ul>
        ) : (
          <p className="warn">{t("알아들은 말이 없습니다. 말소리가 없거나 너무 작은 동영상일 수 있습니다.", "No speech was recognized. The video may have no speech, or it's too quiet.")}</p>
        )
      )}
    </>
  );
}

function Status({ text, value }: { text: string; value: number | null }) {
  return (
    <>
      <p className="note" role="status">{text}{value !== null && ` ${Math.round(value * 100)}%`}</p>
      {value !== null ? <progress className="wm-progress" value={value} max={1} /> : <progress className="wm-progress" />}
    </>
  );
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
    setFile(null);
    if (!f) return;
    if (f.size > VIDEO_MAX_BYTES) {
      setError(t(`파일이 너무 큽니다. ${formatBytes(VIDEO_MAX_BYTES)} 이하의 동영상만 처리할 수 있습니다.`, `The file is too large. Videos up to ${formatBytes(VIDEO_MAX_BYTES)} are supported.`));
      return;
    }
    setFile(f);
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
            <Status text={t("자막 트랙을 찾는 중…", "Looking for subtitle tracks…")} value={progress} />
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
                  ? t("이 동영상의 자막은 그림으로 저장된 자막이라 글자로 꺼낼 수 없습니다. 아래에서 소리를 듣고 자막을 만들 수 있습니다.", "This video's subtitles are stored as images, so they can't be extracted as text. You can create subtitles from the speech below.")
                  : t("이 동영상에는 따로 들어 있는 자막 트랙이 없습니다. 아래에서 소리를 듣고 자막을 만들 수 있습니다.", "This video has no separate subtitle tracks. You can create subtitles from the speech below.")}
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
                    {count > 0
                      ? <TrackFiles track={tr} all={textTracks} videoName={file.name} />
                      : <p>{t("이 트랙에는 자막 내용이 없습니다.", "This track has no subtitle lines.")}</p>}
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

        {file && !busy && <SpeechToSubtitle key={`${file.name}-${file.size}-${file.lastModified}`} file={file} />}
        <p className="note">{t("동영상 파일과 소리는 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다.", "Videos and audio are processed only in this browser and never uploaded.")}</p>
      </div>
    </div>
  );
}
