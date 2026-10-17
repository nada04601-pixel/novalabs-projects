// AI 업스케일 모델(ESRGAN medium, MIT)을 node_modules에서 public/models로 복사합니다.
// 빌드·개발 서버 시작 전에 자동으로 실행되며, 사이트에서 직접 내려주므로 외부 CDN을 쓰지 않습니다.
import { cp, mkdir } from "node:fs/promises";

const from = new URL("../node_modules/@upscalerjs/esrgan-medium/models/", import.meta.url);
const to = new URL("../public/models/esrgan-medium/", import.meta.url);
for (const scale of ["x2", "x4"]) {
  await mkdir(new URL(`${scale}/`, to), { recursive: true });
  await cp(new URL(`${scale}/`, from), new URL(`${scale}/`, to), { recursive: true });
}
console.log("AI 업스케일 모델 복사 완료: public/models/esrgan-medium/{x2,x4}");

// 음성 인식(Whisper)을 돌리는 ONNX Runtime 실행 파일. transformers.js가 기본으로 받는 jsDelivr 대신 사이트에서 내려줍니다.
// 사파리는 asyncify가 없는 쪽을 씁니다(src/lib/tools/whisper.worker.ts). 가장 큰 파일도 Cloudflare 정적 파일 한도(25MiB) 안입니다.
const ortFrom = new URL("../node_modules/onnxruntime-web/dist/", import.meta.url);
const ortTo = new URL("../public/models/ort/", import.meta.url);
await mkdir(ortTo, { recursive: true });
for (const name of ["ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  await cp(new URL(name, ortFrom), new URL(name, ortTo));
}
console.log("음성 인식 실행 파일 복사 완료: public/models/ort/");
