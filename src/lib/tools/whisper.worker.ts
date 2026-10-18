// 음성 인식(Whisper)을 화면과 분리된 스레드에서 돌립니다. 모델은 처음 한 번 Hugging Face에서 내려받아 브라우저에 저장되고,
// 소리는 이 브라우저 밖으로 나가지 않습니다. 실행 엔진(ONNX Runtime) 파일은 사이트에서 직접 내려줍니다(scripts/copy-models.mjs).
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import { chunkCues, planChunks, SAMPLE_RATE, WHISPER_MODELS, type SpeechChunk, type SpeechLanguage, type WhisperModel } from "./transcribe";
import type { SubtitleCue } from "./subtitles";

export type WhisperRequest = { samples: Float32Array; model: WhisperModel; language: SpeechLanguage };
export type WhisperMessage =
  | { type: "load"; loaded: number; total: number; device: "webgpu" | "wasm" }
  | { type: "prepare"; device: "webgpu" | "wasm" } // 내려받기를 마치고 모델을 올려 시험 실행하는 중
  | { type: "retry"; from: "webgpu" | "wasm"; message: string } // 이 방식이 실패해 다음 방식으로 다시 시도
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

type Attempt = { device: "webgpu" | "wasm"; options: Record<string, unknown> };

// 실행 방식 후보를 순서대로 시도합니다.
// - 4비트(q4) 디코더는 지금 쓰는 ONNX Runtime이 불러오다 실패해(TransposeDQWeightsForMatMulNBits) 쓰지 않습니다.
// - 디코더는 어느 방식이든 같은 8비트(q8) 파일을 써서, 그래픽 카드 방식이 실패해도 다시 받지 않습니다.
// - 마지막 후보는 그래프 최적화를 끄고 CPU로 돌려, 최적화 단계에서 나는 오류를 피합니다.
async function attempts(): Promise<Attempt[]> {
  const list: Attempt[] = [];
  const gpu = (self.navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  const adapter = await gpu?.requestAdapter().catch(() => null);
  if (adapter) {
    // 인코더를 줄이면 인식 품질이 크게 떨어져 16·32비트로 둡니다. 인식 시간 대부분이 인코더라 여기만 그래픽 카드로 돌려도 빨라집니다.
    const encoder = adapter.features.has("shader-f16") ? "fp16" : "fp32";
    list.push({ device: "webgpu", options: { device: "webgpu", dtype: { encoder_model: encoder, decoder_model_merged: "q8" } } });
  }
  list.push({ device: "wasm", options: { device: "wasm", dtype: "q8" } });
  list.push({ device: "wasm", options: { device: "wasm", dtype: "q8", session_options: { graphOptimizationLevel: "disabled" } } });
  return list;
}

// 라이브러리가 모델을 처음 실행할 때에야 오류를 내는 경우가 있어, 1초짜리 무음으로 한 번 돌려 보고 통과한 방식을 씁니다.
async function load(model: WhisperModel) {
  if (loaded?.key === model) return loaded;
  const id = WHISPER_MODELS[model].id;
  let lastError: unknown = null;
  for (const a of await attempts()) {
    const progress_callback = (p: { status: string; loaded?: number; total?: number }) => {
      if (p.status === "progress_total") post({ type: "load", loaded: p.loaded ?? 0, total: p.total ?? 0, device: a.device });
    };
    let asr: AutomaticSpeechRecognitionPipeline | null = null;
    try {
      post({ type: "load", loaded: 0, total: 0, device: a.device });
      asr = (await pipeline("automatic-speech-recognition", id, { ...a.options, progress_callback })) as AutomaticSpeechRecognitionPipeline;
      post({ type: "prepare", device: a.device });
      await asr(new Float32Array(SAMPLE_RATE), { task: "transcribe" });
      return (loaded = { key: model, asr, device: a.device });
    } catch (err) {
      lastError = err;
      post({ type: "retry", from: a.device, message: err instanceof Error ? err.message : String(err) });
      await asr?.dispose().catch(() => {});
    }
  }
  throw lastError;
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
