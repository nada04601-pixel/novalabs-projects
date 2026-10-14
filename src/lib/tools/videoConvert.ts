// 브라우저 안에서 동영상을 읽고 다시 쓰는 부분(mediabunny). 이 도구 페이지를 열었을 때만 라이브러리를 내려받습니다.
import { pick, type Lang } from "../i18n";

export type VideoInfo = {
  duration: number;
  width: number; // 회전 정보를 반영한 화면 기준 크기
  height: number;
  fps: number;
  videoBitrate: number | null;
  hasAudio: boolean;
  container: "mp4" | "webm";
};

export type ConvertOptions = {
  trim?: { start: number; end: number };
  // 없으면 영상·소리를 다시 인코딩하지 않고 그대로 옮깁니다(빠르고 화질 그대로).
  encode?: { width: number; height: number; videoBitrate: number; audioBitrate: number; dropAudio: boolean };
};

export type ConvertResult = { blob: Blob; ext: "mp4" | "webm" };

const load = () => import("mediabunny");

// 다시 인코딩하려면 WebCodecs가 있어야 합니다(크롬·엣지 94+, 사파리 16.4+, 파이어폭스 130+).
export const canReencode = () => typeof window !== "undefined" && "VideoEncoder" in window;

export async function probe(file: File): Promise<VideoInfo> {
  const mb = await load();
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new Error("no-video");
    const audio = await input.getPrimaryAudioTrack();
    const [duration, stats, format] = await Promise.all([
      input.computeDuration(),
      video.computePacketStats(120).catch(() => null),
      input.getFormat(),
    ]);
    return {
      duration,
      width: video.displayWidth,
      height: video.displayHeight,
      fps: stats?.averagePacketRate ?? 30,
      videoBitrate: stats?.averageBitrate ? Math.round(stats.averageBitrate) : null,
      hasAudio: !!audio,
      container: /webm|matroska/i.test(format.mimeType) ? "webm" : "mp4",
    };
  } finally {
    input.dispose();
  }
}

// 변환을 시작하고, 멈추기 함수와 결과 약속을 돌려줍니다.
export async function convert(
  file: File,
  info: VideoInfo,
  opts: ConvertOptions,
  onProgress: (p: number) => void,
): Promise<{ cancel: () => void; done: Promise<ConvertResult> }> {
  const mb = await load();
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });

  // 다시 인코딩할 때는 어디서나 열리는 H.264+AAC MP4를 먼저 쓰고, 브라우저가 못 만들면 VP9(또는 VP8)+Opus WebM을 씁니다.
  // 그대로 옮길 때는 원본과 같은 형식을 씁니다.
  let ext: "mp4" | "webm" = info.container;
  let videoCodec: "avc" | "vp9" | "vp8" | undefined;
  let audioCodec: "aac" | "opus" | undefined;
  if (opts.encode) {
    const { width, height, videoBitrate } = opts.encode;
    const can = (c: "avc" | "vp9" | "vp8") => mb.canEncodeVideo(c, { width, height, bitrate: videoBitrate });
    if (await can("avc")) { videoCodec = "avc"; ext = "mp4"; }
    else if (await can("vp9")) { videoCodec = "vp9"; ext = "webm"; }
    else if (await can("vp8")) { videoCodec = "vp8"; ext = "webm"; }
    else { input.dispose(); throw new Error("no-encoder"); }
    const aac = ext === "mp4" && await mb.canEncodeAudio("aac", { bitrate: opts.encode.audioBitrate });
    audioCodec = aac ? "aac" : "opus";
    if (!aac && ext === "mp4") ext = "webm"; // AAC를 못 만들면 Opus와 잘 맞는 WebM으로 저장합니다.
  }

  const target = new mb.BufferTarget();
  const output = new mb.Output({
    format: ext === "mp4" ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat(),
    target,
  });
  const e = opts.encode;
  const conversion = await mb.Conversion.init({
    input,
    output,
    trim: opts.trim,
    video: e
      ? { codec: videoCodec, width: e.width, height: e.height, fit: "fill", quality: new mb.Quality({ bitrate: e.videoBitrate }), forceTranscode: true }
      : undefined,
    audio: e
      ? e.dropAudio ? { discard: true } : { codec: audioCodec, quality: new mb.Quality({ bitrate: e.audioBitrate }), forceTranscode: true }
      : undefined,
    showWarnings: false,
  });
  if (!conversion.isValid || !conversion.utilizedTracks.some((t) => t.isVideoTrack())) {
    input.dispose();
    throw new Error("invalid");
  }
  conversion.onProgress = (p) => onProgress(Math.min(1, Math.max(0, p)));

  const done = conversion.execute().then(() => {
    const buf = target.buffer;
    if (!buf) throw new Error("empty");
    return { blob: new Blob([buf], { type: ext === "mp4" ? "video/mp4" : "video/webm" }), ext };
  }).finally(() => input.dispose());

  return { cancel: () => { conversion.cancel(); }, done };
}

// 소리만 MP3로 뽑습니다. 브라우저에는 MP3 인코더가 없어서 필요할 때만 WebAssembly 인코더(LAME)를 불러와 씁니다.
export async function extractMp3(
  file: File,
  opts: { bitrate: number; trim?: { start: number; end: number } },
  onProgress: (p: number) => void,
): Promise<{ cancel: () => void; done: Promise<Blob> }> {
  const mb = await load();
  if (!(await mb.canEncodeAudio("mp3"))) {
    const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder");
    registerMp3Encoder();
  }
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.Mp3OutputFormat(), target });
  const conversion = await mb.Conversion.init({
    input,
    output,
    trim: opts.trim,
    video: { discard: true },
    audio: { codec: "mp3", quality: new mb.Quality({ bitrate: opts.bitrate }), forceTranscode: true },
    showWarnings: false,
  });
  if (!conversion.isValid || !conversion.utilizedTracks.some((t) => t.isAudioTrack())) {
    input.dispose();
    throw new Error("no-audio");
  }
  conversion.onProgress = (p) => onProgress(Math.min(1, Math.max(0, p)));
  const done = conversion.execute().then(() => {
    if (!target.buffer) throw new Error("empty");
    return new Blob([target.buffer], { type: "audio/mpeg" });
  }).finally(() => input.dispose());
  return { cancel: () => { conversion.cancel(); }, done };
}

// 고른 시각들의 장면을 뽑아 GIF로 묶습니다. 프레임마다 256색 팔레트를 따로 만들어 색이 덜 뭉개지게 합니다.
export async function makeGif(
  file: File,
  opts: { times: number[]; width: number; height: number; delay: number },
  onProgress: (p: number) => void,
): Promise<{ cancel: () => void; done: Promise<Blob> }> {
  const mb = await load();
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  if (!video) { input.dispose(); throw new Error("no-video"); }
  if (!(await video.canDecode())) { input.dispose(); throw new Error("invalid"); }
  let canceled = false;
  const run = async () => {
    const sink = new mb.CanvasSink(video, { width: opts.width, height: opts.height, fit: "fill", poolSize: 2 });
    const gif = GIFEncoder();
    let k = 0;
    for await (const frame of sink.canvasesAtTimestamps(opts.times)) {
      if (canceled) throw new Error("cancel");
      k++;
      if (!frame) continue; // 영상 첫 장면보다 앞선 시각
      const ctx = frame.canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
      const { data } = ctx.getImageData(0, 0, opts.width, opts.height);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), opts.width, opts.height, { palette, delay: opts.delay, repeat: 0 });
      onProgress(k / opts.times.length);
      // 색 줄이기는 무거운 계산이라 몇 장마다 화면이 멈추지 않게 숨을 돌립니다.
      if (k % 3 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    gif.finish();
    return new Blob([gif.bytes()], { type: "image/gif" });
  };
  const done = run().finally(() => input.dispose());
  return { cancel: () => { canceled = true; }, done };
}

// 오류를 안내 문구로 바꿉니다. 사용자가 멈춘 경우는 빈 문자열입니다.
export function convertErrorMessage(e: unknown, lang: Lang = "ko"): string {
  const name = e instanceof Error ? e.name : "";
  const msg = e instanceof Error ? e.message : "";
  if (name === "ConversionCanceledError" || /cancel/i.test(msg)) return "";
  if (msg === "no-audio") return pick(lang, "이 동영상에는 소리가 없거나, 이 브라우저가 읽을 수 없는 소리 형식입니다.", "This video has no audio, or its audio format can't be read by this browser.");
  if (msg === "no-video") return pick(lang, "동영상 트랙을 찾지 못했습니다. 소리만 있는 파일이거나 손상된 파일일 수 있습니다.", "No video track found. The file may be audio-only or damaged.");
  if (msg === "no-encoder") return pick(lang, "이 브라우저는 동영상 인코딩을 지원하지 않습니다. 최신 크롬·엣지·사파리에서 다시 시도해 주세요.", "This browser can't encode video. Try again in the latest Chrome, Edge or Safari.");
  if (msg === "invalid") return pick(lang, "이 동영상의 코덱은 이 브라우저에서 변환할 수 없습니다. 다른 브라우저(크롬·엣지)에서 시도해 보세요.", "This video's codec can't be converted in this browser. Try another browser such as Chrome or Edge.");
  if (/unsupported|format/i.test(msg)) return pick(lang, "지원하지 않는 동영상 형식입니다. MP4·MOV·WEBM·MKV 파일을 골라 주세요.", "Unsupported video format. Please choose an MP4, MOV, WEBM or MKV file.");
  return pick(lang, "동영상을 처리하지 못했습니다. 메모리가 부족할 수 있으니 더 짧은 영상으로 다시 시도해 주세요.", "Couldn't process the video. The device may be low on memory - try a shorter clip.");
}
