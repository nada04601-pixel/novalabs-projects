// PDF 합치기·나누기·페이지 정리의 쪽 번호 계산과 파일 이름 등 pdf-lib 없이 쓰는 공통 로직

export const PDF_MAX_BYTES = 200 * 1024 * 1024;

export const isEncryptedError = (e: unknown) => {
  const n = (e as { name?: string })?.name ?? "";
  const m = (e as { message?: string })?.message ?? "";
  return n === "PasswordException" || /encrypt/i.test(n + m);
};

export const pdfErrorMessage = (e: unknown) =>
  isEncryptedError(e)
    ? "암호가 걸린 PDF는 처리할 수 없습니다. 암호를 해제한 파일로 다시 시도해 주세요."
    : "PDF를 처리하지 못했습니다. 손상된 파일이거나 이 브라우저에서 열 수 없는 형식일 수 있습니다.";

const baseName = (name: string) => name.replace(/\.pdf$/i, "") || "문서";

// 보고서.pdf + "1-3쪽" → 보고서-1-3쪽.pdf
export const pdfName = (name: string, suffix: string) => `${baseName(name)}-${suffix}.pdf`;

export type PageRangeResult = { ok: true; groups: number[][] } | { ok: false; error: string };

// "1-3, 5, 8-" 같은 입력을 쪽 번호(1부터) 묶음으로 바꿉니다. 쉼표로 나눈 묶음마다 결과 파일 하나가 됩니다.
// "8-"은 8쪽부터 끝까지, "-3"은 처음부터 3쪽까지입니다. 거꾸로 쓴 범위(5-3)는 역순으로 뽑습니다.
export function parsePageRanges(input: string, total: number): PageRangeResult {
  const parts = input.replace(/[~–—]/g, "-").split(/[,，]/).map((s) => s.replace(/\s+/g, "")).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "쪽 번호를 입력하세요. 예: 1-3, 5, 8-" };
  const groups: number[][] = [];
  for (const part of parts) {
    const m = part.match(/^(\d*)(-?)(\d*)$/);
    if (!m || (!m[1] && !m[3])) return { ok: false, error: `'${part}'은(는) 쪽 번호 형식이 아닙니다. 예: 1-3, 5, 8-` };
    const from = m[1] ? Number(m[1]) : 1;
    const to = m[2] ? (m[3] ? Number(m[3]) : total) : from;
    for (const v of [from, to]) {
      if (v < 1 || v > total) return { ok: false, error: `${v}쪽은 없습니다. 이 파일은 1~${total}쪽입니다.` };
    }
    const step = from <= to ? 1 : -1;
    const g: number[] = [];
    for (let i = from; i !== to + step; i += step) g.push(i);
    groups.push(g);
  }
  return { ok: true, groups };
}

// 전체 쪽을 n쪽씩 나눈 묶음. 마지막 묶음은 n쪽보다 적을 수 있습니다.
export function chunkPages(total: number, size: number): number[][] {
  const n = Math.max(1, Math.floor(size));
  const groups: number[][] = [];
  for (let i = 1; i <= total; i += n) groups.push(Array.from({ length: Math.min(n, total - i + 1) }, (_, k) => i + k));
  return groups;
}

// 묶음의 이름표: [1,2,3] → "1-3쪽", [5] → "5쪽", [1,3] → "1,3쪽"
export function groupLabel(g: number[]): string {
  if (g.length === 1) return `${g[0]}쪽`;
  const consecutive = g.every((v, i) => i === 0 || v === g[i - 1] + 1);
  return consecutive ? `${g[0]}-${g[g.length - 1]}쪽` : `${g.join(",")}쪽`;
}

// 페이지 정리: 원본 쪽 번호(0부터)와 추가로 돌릴 각도를 받은 순서대로 새 PDF를 만듭니다. 빠진 쪽은 삭제됩니다.
export type PagePlan = { index: number; rotate: number };

export const normalizeAngle = (a: number) => ((Math.round(a / 90) * 90) % 360 + 360) % 360;

// 배열에서 i번째 항목을 d칸(-1 앞으로, +1 뒤로) 옮긴 새 배열
export function move<T>(list: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const pdfBlob = (bytes: Uint8Array) => new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
