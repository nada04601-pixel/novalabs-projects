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
