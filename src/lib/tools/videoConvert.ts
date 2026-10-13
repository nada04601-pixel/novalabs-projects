// 브라우저 안에서 동영상을 읽고 다시 쓰는 부분(mediabunny). 이 도구 페이지를 열었을 때만 라이브러리를 내려받습니다.

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

// 오류를 안내 문구로 바꿉니다. 사용자가 멈춘 경우는 빈 문자열입니다.
export function convertErrorMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : "";
  const msg = e instanceof Error ? e.message : "";
  if (name === "ConversionCanceledError" || /cancel/i.test(msg)) return "";
  if (msg === "no-video") return "동영상 트랙을 찾지 못했습니다. 소리만 있는 파일이거나 손상된 파일일 수 있습니다.";
  if (msg === "no-encoder") return "이 브라우저는 동영상 인코딩을 지원하지 않습니다. 최신 크롬·엣지·사파리에서 다시 시도해 주세요.";
  if (msg === "invalid") return "이 동영상의 코덱은 이 브라우저에서 변환할 수 없습니다. 다른 브라우저(크롬·엣지)에서 시도해 보세요.";
  if (/unsupported|format/i.test(msg)) return "지원하지 않는 동영상 형식입니다. MP4·MOV·WEBM·MKV 파일을 골라 주세요.";
  return "동영상을 처리하지 못했습니다. 메모리가 부족할 수 있으니 더 짧은 영상으로 다시 시도해 주세요.";
}
