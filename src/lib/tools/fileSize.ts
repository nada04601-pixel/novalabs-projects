// 파일 크기 표시와 압축률 계산

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// 줄어든 비율(0~1). 커졌으면 음수입니다.
export const reduction = (before: number, after: number) => (before > 0 ? 1 - after / before : 0);

// PDF 1pt = 1/72인치. 원하는 해상도(dpi)로 그리려면 72로 나눈 배율을 씁니다.
export const renderScale = (dpi: number) => dpi / 72;

export const PDF_PRESETS = {
  low: { label: "최대 압축", dpi: 96, quality: 0.55 },
  medium: { label: "권장", dpi: 130, quality: 0.7 },
  high: { label: "고화질", dpi: 170, quality: 0.82 },
} as const;
export type PdfPreset = keyof typeof PDF_PRESETS;

// 압축 결과 파일 이름: 보고서.pdf → 보고서-압축.pdf
export const compressedName = (name: string) => `${name.replace(/\.pdf$/i, "") || "문서"}-압축.pdf`;
