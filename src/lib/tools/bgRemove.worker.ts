// 배경 제거 모델을 화면과 분리된 스레드에서 돌립니다. 모델은 처음 한 번 Hugging Face에서 내려받아 브라우저에 저장되고,
// 이미지는 이 브라우저 밖으로 나가지 않습니다. 결과는 피사체 마스크(화소마다 0~255)만 돌려줍니다.
import { pipeline, RawImage, type BackgroundRemovalPipeline } from "@huggingface/transformers";
import { BG_MODELS, type BgModel } from "./bgRemove";
import { gpuInfo, setupOrt } from "./ortEnv";

// rgb: 화소마다 R·G·B 3바이트
export type BgRequest = { rgb: Uint8ClampedArray; width: number; height: number; model: BgModel };
export type BgMessage =
  | { type: "load"; loaded: number; total: number; device: "webgpu" | "wasm" }
  | { type: "run"; device: "webgpu" | "wasm" } // 내려받기를 마치고 모델을 올려 실행하는 중
  | { type: "retry"; from: "webgpu" | "wasm"; message: string } // 이 방식이 실패해 다음 방식으로 다시 시도
  | { type: "done"; mask: Uint8Array; width: number; height: number; device: "webgpu" | "wasm" }
  | { type: "error"; message: string };

const post = (m: BgMessage, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);

setupOrt();

let loaded: { key: string; run: BackgroundRemovalPipeline; device: "webgpu" | "wasm" } | null = null;

type Attempt = { device: "webgpu" | "wasm"; options: Record<string, unknown> };

// 그래픽 카드가 있으면 16비트(지원할 때)로, 아니면 CPU에서 32비트로 돌립니다.
// CPU 실행 엔진은 16비트 모델을 제대로 돌리지 못하는 연산이 있어 32비트 파일을 씁니다.
async function attempts(): Promise<Attempt[]> {
  const gpu = await gpuInfo();
  const list: Attempt[] = [];
  if (gpu) list.push({ device: "webgpu", options: { device: "webgpu", dtype: gpu.f16 ? "fp16" : "fp32" } });
  list.push({ device: "wasm", options: { device: "wasm", dtype: "fp32" } });
  return list;
}

async function segment(image: RawImage, model: BgModel) {
  let lastError: unknown = null;
  const list = loaded?.key === model ? [{ device: loaded.device, options: {} }] : await attempts();
  for (const a of list) {
    let run = loaded?.key === model ? loaded.run : null;
    try {
      if (!run) {
        const progress_callback = (p: { status: string; loaded?: number; total?: number }) => {
          if (p.status === "progress_total") post({ type: "load", loaded: p.loaded ?? 0, total: p.total ?? 0, device: a.device });
        };
        post({ type: "load", loaded: 0, total: 0, device: a.device });
        run = (await pipeline("background-removal", BG_MODELS[model].id, { ...a.options, progress_callback })) as BackgroundRemovalPipeline;
      }
      post({ type: "run", device: a.device });
      const out = (await run(image)) as RawImage;
      loaded = { key: model, run, device: a.device };
      return { out, device: a.device };
    } catch (err) {
      lastError = err;
      post({ type: "retry", from: a.device, message: err instanceof Error ? err.message : String(err) });
      await run?.dispose().catch(() => {});
      loaded = null;
    }
  }
  throw lastError;
}

self.onmessage = async (e: MessageEvent<BgRequest>) => {
  const { rgb, width, height, model } = e.data;
  try {
    if (loaded && loaded.key !== model) {
      await loaded.run.dispose().catch(() => {});
      loaded = null;
    }
    const { out, device } = await segment(new RawImage(rgb, width, height, 3), model);
    // 결과는 RGBA이고 투명도 자리에 마스크가 들어 있습니다.
    const mask = new Uint8Array(out.width * out.height);
    for (let i = 0; i < mask.length; i++) mask[i] = out.data[i * 4 + 3];
    post({ type: "done", mask, width: out.width, height: out.height, device }, [mask.buffer]);
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
