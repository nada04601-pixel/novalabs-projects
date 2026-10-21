// 웹 워커에서 transformers.js를 쓸 때의 공통 설정. 실행 엔진(ONNX Runtime) 파일은 사이트에서 직접 내려줍니다(scripts/copy-models.mjs).
import { env } from "@huggingface/transformers";

export function setupOrt() {
  const ort = `${self.location.origin}/models/ort/`;
  const safari = /^((?!chrome|android).)*safari/i.test(self.navigator.userAgent);
  env.allowLocalModels = false;
  env.backends.onnx.wasm!.wasmPaths = safari
    ? { mjs: `${ort}ort-wasm-simd-threaded.mjs`, wasm: `${ort}ort-wasm-simd-threaded.wasm` }
    : { mjs: `${ort}ort-wasm-simd-threaded.asyncify.mjs`, wasm: `${ort}ort-wasm-simd-threaded.asyncify.wasm` };
}

type GpuAdapter = { features: Set<string> };
// WebGPU를 쓸 수 있으면 16비트 연산(shader-f16) 지원 여부를, 없으면 null을 돌려줍니다.
export async function gpuInfo(): Promise<{ f16: boolean } | null> {
  const gpu = (self.navigator as Navigator & { gpu?: { requestAdapter(): Promise<GpuAdapter | null> } }).gpu;
  const adapter = await gpu?.requestAdapter().catch(() => null);
  return adapter ? { f16: adapter.features.has("shader-f16") } : null;
}
