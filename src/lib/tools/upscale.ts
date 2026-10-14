// 이미지 업스케일링. AI 모드(ESRGAN, 브라우저에서 TensorFlow.js로 실행)와
// 빠른 모드(Lanczos3 보간 + 언샤프 마스크)의 크기 한도와 화소 계산을 둡니다.

export type UpscaleMode = "ai" | "fast";
export type Scale = 2 | 4;

// 결과 이미지 한도. 브라우저 캔버스가 안정적으로 다루는 크기에 맞춥니다.
export const OUT_MAX_SIDE = 8192;
export const OUT_MAX_PIXELS = 16_000_000;
// AI 모드 입력 한도(화소 수). 넘으면 오래 걸리거나 그래픽 메모리가 모자랄 수 있어 빠른 모드를 권합니다.
export const AI_MAX_INPUT: Record<Scale, number> = { 2: 1_500_000, 4: 500_000 };
export const UPSCALE_MAX_BYTES = 30 * 1024 * 1024;

export function checkUpscale(w: number, h: number, scale: Scale, mode: UpscaleMode): string | null {
  const ow = w * scale;
  const oh = h * scale;
  if (ow > OUT_MAX_SIDE || oh > OUT_MAX_SIDE || ow * oh > OUT_MAX_PIXELS) {
    return `결과가 ${ow.toLocaleString("ko-KR")}×${oh.toLocaleString("ko-KR")}px로 너무 큽니다. 배율을 낮추거나 더 작은 이미지를 쓰세요.`;
  }
  if (mode === "ai" && w * h > AI_MAX_INPUT[scale]) {
    return `AI 모드 ${scale}배는 ${(AI_MAX_INPUT[scale] / 1e6).toLocaleString("ko-KR")}백만 화소 이하 이미지까지 처리합니다(지금 ${((w * h) / 1e6).toFixed(1)}백만 화소). 빠른 모드를 쓰거나 2배로 낮춰 보세요.`;
  }
  return null;
}

// 결과 파일 이름: 사진.jpg → 사진-4x.png
export const upscaledName = (name: string, scale: Scale, ext: "png" | "jpg") =>
  `${name.replace(/\.[^.]+$/, "") || "이미지"}-${scale}x.${ext}`;

type Pixels = { data: Uint8ClampedArray; width: number; height: number };

const sinc = (x: number) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const lanczos3 = (x: number) => (x > -3 && x < 3 ? sinc(x) * sinc(x / 3) : 0);

// 한 방향(가로 또는 세로)으로 늘리는 Lanczos3 보간. 늘릴 때만 쓰므로 커널 폭은 고정입니다.
function resample1d(src: Float32Array, sw: number, sh: number, dw: number, horizontal: boolean): Float32Array {
  const [inLen, lines] = horizontal ? [sw, sh] : [sh, sw];
  const outLen = dw;
  const out = new Float32Array((horizontal ? dw * sh : sw * dw) * 4);
  const ratio = inLen / outLen;
  // 출력 위치마다 가중치를 미리 계산합니다.
  const starts = new Int32Array(outLen);
  const weights: Float32Array[] = [];
  for (let o = 0; o < outLen; o++) {
    const center = (o + 0.5) * ratio - 0.5;
    const start = Math.floor(center) - 2;
    const w = new Float32Array(6);
    let sum = 0;
    for (let k = 0; k < 6; k++) sum += w[k] = lanczos3(center - (start + k));
    for (let k = 0; k < 6; k++) w[k] /= sum;
    starts[o] = start;
    weights.push(w);
  }
  for (let line = 0; line < lines; line++) {
    for (let o = 0; o < outLen; o++) {
      const w = weights[o];
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < 6; k++) {
        const i = Math.min(inLen - 1, Math.max(0, starts[o] + k));
        const si = (horizontal ? line * sw + i : i * sw + line) * 4;
        r += src[si] * w[k];
        g += src[si + 1] * w[k];
        b += src[si + 2] * w[k];
        a += src[si + 3] * w[k];
      }
      const di = (horizontal ? line * dw + o : o * sw + line) * 4;
      out[di] = r;
      out[di + 1] = g;
      out[di + 2] = b;
      out[di + 3] = a;
    }
  }
  return out;
}

// 빠른 모드: Lanczos3로 scale배 늘린 뒤 언샤프 마스크로 경계를 살립니다.
export function fastUpscale(src: Pixels, scale: number, sharpen = 0.6): Pixels {
  const { width: sw, height: sh } = src;
  const dw = sw * scale;
  const dh = sh * scale;
  const f = Float32Array.from(src.data);
  const h = resample1d(f, sw, sh, dw, true);
  const v = resample1d(h, dw, sh, dh, false);
  const data = new Uint8ClampedArray(dw * dh * 4);
  // 언샤프 마스크: 원래 값 + (원래 값 - 주변 3×3 평균) × 세기. 흐린 사본을 따로 만들지 않아 메모리를 아낍니다.
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const i = (y * dw + x) * 4;
      for (let c = 0; c < 3; c++) {
        if (sharpen <= 0) {
          data[i + c] = v[i + c];
          continue;
        }
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const row = Math.min(dh - 1, Math.max(0, y + dy)) * dw;
          for (let dx = -1; dx <= 1; dx++) sum += v[(row + Math.min(dw - 1, Math.max(0, x + dx))) * 4 + c];
        }
        data[i + c] = v[i + c] + (v[i + c] - sum / 9) * sharpen;
      }
      data[i + 3] = v[i + 3];
    }
  }
  return { data, width: dw, height: dh };
}
