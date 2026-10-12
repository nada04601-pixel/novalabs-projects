// 이미지 ↔ PDF 변환에 쓰는 계산: 이미지 형식 판별, JPEG 회전 정보, 쪽 배치, 파일 이름

export const IMAGE_MAX_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGES = 100;
// 휴대폰에서 메모리가 모자라지 않도록 캔버스 크기를 제한합니다.
export const MAX_SIDE = 4096;
export const MAX_PIXELS = 12_000_000;

export type ImageKind = "jpg" | "png" | "other";

export function sniffImage(b: Uint8Array): ImageKind {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  return "other";
}

// JPEG의 EXIF 회전 값(1~8). 휴대폰 사진은 픽셀을 눕혀 저장하고 이 값으로 바로 세우라고 표시하는 경우가 많습니다.
// PDF는 이 값을 모르므로 1이 아니면 그대로 넣으면 사진이 옆으로 누워 보입니다. 값이 없으면 1입니다.
export function jpegOrientation(b: Uint8Array): number {
  if (sniffImage(b) !== "jpg") return 1;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 2;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) return 1;
    const marker = b[p + 1];
    if (marker === 0xd9 || marker === 0xda) return 1; // 이미지 끝 또는 픽셀 데이터 시작
    const len = v.getUint16(p + 2);
    if (marker === 0xe1 && len >= 16 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) {
      const tiff = p + 10; // "Exif\0\0" 다음
      if (tiff + 8 > b.length) return 1;
      const le = b[tiff] === 0x49; // II = 리틀엔디언, MM = 빅엔디언
      const ifd = tiff + v.getUint32(tiff + 4, le);
      if (ifd + 2 > b.length) return 1;
      const count = v.getUint16(ifd, le);
      for (let i = 0; i < count; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 10 > b.length) return 1;
        if (v.getUint16(e, le) === 0x0112) {
          const o = v.getUint16(e + 8, le);
          return o >= 1 && o <= 8 ? o : 1;
        }
      }
      return 1;
    }
    p += 2 + len;
  }
  return 1;
}

export type PageMode = "a4" | "image";
export type Placement = { pageW: number; pageH: number; x: number; y: number; w: number; h: number };

const A4 = { short: 595.28, long: 841.89 }; // pt
// 이미지 1px을 96dpi로 보았을 때의 크기(pt). 작은 이미지를 억지로 키워 흐려지지 않게 할 때 씁니다.
const PX_TO_PT = 72 / 96;

// 이미지 한 장을 놓을 쪽 크기와 위치(pt, 왼쪽 아래 기준)를 정합니다.
// a4: 이미지 방향에 맞춰 A4 세로·가로를 고르고 여백 안에 비율을 유지해 가운데 놓습니다. 원래 크기보다 키우지 않습니다.
// image: 쪽을 이미지 비율과 똑같이 만들어 여백 없이 꽉 채웁니다(긴 변은 A4 긴 변 길이).
export function placeImage(imgW: number, imgH: number, mode: PageMode, margin = 0): Placement {
  if (mode === "image") {
    const s = A4.long / Math.max(imgW, imgH);
    const w = imgW * s, h = imgH * s;
    return { pageW: w, pageH: h, x: 0, y: 0, w, h };
  }
  const landscape = imgW > imgH;
  const pageW = landscape ? A4.long : A4.short;
  const pageH = landscape ? A4.short : A4.long;
  const boxW = pageW - margin * 2, boxH = pageH - margin * 2;
  const s = Math.min(boxW / imgW, boxH / imgH, PX_TO_PT);
  const w = imgW * s, h = imgH * s;
  return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}

export const MARGINS = [
  { key: "none", label: "없음", pt: 0 },
  { key: "small", label: "좁게", pt: 20 },
  { key: "large", label: "넓게", pt: 40 },
] as const;
export type MarginKey = (typeof MARGINS)[number]["key"];

export const RENDER_PRESETS = {
  screen: { label: "보통", dpi: 100 },
  sharp: { label: "선명하게", dpi: 150 },
  print: { label: "인쇄용", dpi: 300 },
} as const;
export type RenderPreset = keyof typeof RENDER_PRESETS;

const stripExt = (name: string) => name.replace(/\.[^./\\]+$/, "") || "문서";

// 사진.jpg 한 장 → 사진.pdf, 여러 장 → 사진-합본.pdf
export const imagesPdfName = (names: string[]) =>
  names.length === 0 ? "이미지.pdf" : `${stripExt(names[0])}${names.length > 1 ? "-합본" : ""}.pdf`;

// 보고서.pdf의 3쪽(전체 12쪽) → 보고서-03.jpg. 쪽 번호 자릿수를 맞춰 파일 정렬이 흐트러지지 않게 합니다.
export const pageImageName = (pdf: string, page: number, total: number, ext: "jpg" | "png") =>
  `${stripExt(pdf)}-${String(page).padStart(String(total).length, "0")}.${ext}`;

export const pagesZipName = (pdf: string) => `${stripExt(pdf)}-이미지.zip`;
