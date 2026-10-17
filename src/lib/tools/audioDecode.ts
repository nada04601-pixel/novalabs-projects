// 동영상의 소리를 음성 인식용 16kHz 모노로 꺼냅니다(mediabunny로 풀고 OfflineAudioContext로 표본 수를 바꿈).
// OfflineAudioContext는 화면 스레드에만 있어 워커가 아닌 여기서 처리합니다.
import { SAMPLE_RATE, SPEECH_MAX_SECONDS } from "./transcribe";

const BLOCK_SECONDS = 30; // 이만큼 모일 때마다 16kHz로 바꿔 메모리를 아낍니다.

async function resample(mono: Float32Array, rate: number): Promise<Float32Array> {
  if (rate === SAMPLE_RATE) return mono;
  const length = Math.max(1, Math.round((mono.length * SAMPLE_RATE) / rate));
  const ctx = new OfflineAudioContext(1, length, SAMPLE_RATE);
  const buf = ctx.createBuffer(1, mono.length, rate);
  buf.copyToChannel(mono as Float32Array<ArrayBuffer>, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
  return (await ctx.startRendering()).getChannelData(0);
}

export async function decodeSpeechAudio(file: Blob, onProgress: (p: number) => void, signal?: AbortSignal): Promise<{ samples: Float32Array; duration: number }> {
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("no-audio");
    if (!(await track.canDecode())) throw new Error("audio-decode");
    const duration = await track.computeDuration();
    if (duration > SPEECH_MAX_SECONDS) throw new Error("too-long");

    const out = new Float32Array(Math.ceil((duration + 1) * SAMPLE_RATE));
    let written = 0;
    let rate = 0;
    let block: Float32Array[] = [];
    let blockLen = 0;
    const flush = async () => {
      if (!blockLen) return;
      const mono = new Float32Array(blockLen);
      let o = 0;
      for (const b of block) (mono.set(b, o), (o += b.length));
      const res = await resample(mono, rate);
      const n = Math.min(res.length, out.length - written);
      out.set(res.subarray(0, n), written);
      written += n;
      block = [];
      blockLen = 0;
    };

    for await (const { buffer, timestamp } of new mb.AudioBufferSink(track).buffers()) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (rate && buffer.sampleRate !== rate) await flush();
      rate = buffer.sampleRate;
      // 여러 채널은 평균 내어 하나로 합칩니다.
      const mono = new Float32Array(buffer.length);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
      }
      block.push(mono);
      blockLen += mono.length;
      if (blockLen >= BLOCK_SECONDS * rate) {
        await flush();
        onProgress(Math.min(1, timestamp / duration));
      }
    }
    await flush();
    onProgress(1);
    return { samples: out.subarray(0, written), duration };
  } finally {
    input.dispose();
  }
}
