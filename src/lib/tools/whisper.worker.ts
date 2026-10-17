// 음성 인식(Whisper)을 화면과 분리된 스레드에서 돌립니다. 모델은 처음 한 번 Hugging Face에서 내려받아 브라우저에 저장되고,
// 소리는 이 브라우저 밖으로 나가지 않습니다. 실행 엔진(ONNX Runtime) 파일은 사이트에서 직접 내려줍니다(scripts/copy-models.mjs).
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import { chunkCues, planChunks, SAMPLE_RATE, WHISPER_MODELS, type SpeechChunk, type SpeechLanguage, type WhisperModel } from "./transcribe";
import type { SubtitleCue } from "./subtitles";

export type WhisperRequest = { samples: Float32Array; model: WhisperModel; language: SpeechLanguage };
export type WhisperMessage =
  | { type: "load"; loaded: number; total: number }
  | { type: "ready"; device: "webgpu" | "wasm" }
  | { type: "chunk"; done: number; total: number; cues: SubtitleCue[] }
  | { type: "done" }
  | { type: "error"; message: string };

const post = (m: WhisperMessage) => (self as unknown as Worker).postMessage(m);

const ort = `${self.location.origin}/models/ort/`;
const safari = /^((?!chrome|android).)*safari/i.test(self.navigator.userAgent);
env.allowLocalModels = false;
env.backends.onnx.wasm!.wasmPaths = safari
  ? { mjs: `${ort}ort-wasm-simd-threaded.mjs`, wasm: `${ort}ort-wasm-simd-threaded.wasm` }
  : { mjs: `${ort}ort-wasm-simd-threaded.asyncify.mjs`, wasm: `${ort}ort-wasm-simd-threaded.asyncify.wasm` };

let loaded: { key: string; asr: AutomaticSpeechRecognitionPipeline; device: "webgpu" | "wasm" } | null = null;

// WebGPU가 있으면 그래픽 카드로 훨씬 빠르게 돌리고, 없거나 실패하면 CPU(WebAssembly)로 돌립니다.
async function load(model: WhisperModel) {
  if (loaded?.key === model) return loaded;
  const id = WHISPER_MODELS[model].id;
  const progress_callback = (p: { status: string; loaded?: number; total?: number }) => {
    if (p.status === "progress_total") post({ type: "load", loaded: p.loaded ?? 0, total: p.total ?? 0 });
  };
  const gpu = (self.navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  const adapter = await gpu?.requestAdapter().catch(() => null);
  if (adapter) {
    try {
      // 인코더를 4비트로 줄이면 인식 품질이 크게 떨어져, 인코더는 16·32비트, 디코더만 4비트로 씁니다.
      const encoder = adapter.features.has("shader-f16") ? "fp16" : "fp32";
      const asr = (await pipeline("automatic-speech-recognition", id, {
        device: "webgpu",
        dtype: { encoder_model: encoder, decoder_model_merged: "q4" },
        progress_callback,
      })) as AutomaticSpeechRecognitionPipeline;
      return (loaded = { key: model, asr, device: "webgpu" });
    } catch {
      // 아래 CPU 방식으로 다시 시도
    }
  }
  const asr = (await pipeline("automatic-speech-recognition", id, { device: "wasm", dtype: "q8", progress_callback })) as AutomaticSpeechRecognitionPipeline;
  return (loaded = { key: model, asr, device: "wasm" });
}

self.onmessage = async (e: MessageEvent<WhisperRequest>) => {
  const { samples, model, language } = e.data;
  try {
    const { asr, device } = await load(model);
    post({ type: "ready", device });
    const chunks = planChunks(samples);
    for (let i = 0; i < chunks.length; i++) {
      const [a, b] = chunks[i];
      let cues: SubtitleCue[] = [];
      // 0.3초보다 짧은 끝자락은 건너뜁니다(Whisper가 없는 말을 지어내기 쉬움).
      if (b - a >= 0.3 * SAMPLE_RATE) {
        const out = (await asr(samples.subarray(a, b), {
          return_timestamps: true,
          task: "transcribe",
          ...(language === "auto" ? {} : { language }),
        })) as { chunks?: SpeechChunk[] };
        cues = chunkCues(out.chunks ?? [], a / SAMPLE_RATE, b / SAMPLE_RATE);
      }
      post({ type: "chunk", done: i + 1, total: chunks.length, cues });
    }
    post({ type: "done" });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
