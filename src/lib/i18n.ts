// 다국어(한국어 기본 + 영어). 영어 페이지는 /en 아래에 있고, 화면 문구는 한국어·영어를 나란히 적어 고릅니다.
export type Lang = "ko" | "en";

export const langOf = (path: string | null | undefined): Lang => (path === "/en" || path?.startsWith("/en/") ? "en" : "ko");
export const pick = (lang: Lang, ko: string, en: string) => (lang === "en" ? en : ko);
export const locale = (lang: Lang) => (lang === "en" ? "en-US" : "ko-KR");

// 영어 버전이 있는 도구(해외에서도 쓸 수 있는 PDF·이미지·동영상·유틸리티 도구). 한글 타자 연습·나이스 바이트 글자수 세기는 한국어만 둡니다.
export const EN_TOOLS = [
  "pdf-compress", "pdf-merge", "pdf-split", "pdf-organize", "jpg-to-pdf", "pdf-to-jpg",
  "image-upscaler", "watermark-remover",
  "video-trim", "video-compress", "video-to-gif", "video-to-mp3",
  "password-generator", "qr-code",
] as const;
export type EnTool = (typeof EN_TOOLS)[number];
export const hasEn = (slug: string): slug is EnTool => (EN_TOOLS as readonly string[]).includes(slug);

// 같은 페이지의 다른 언어 주소. 영어 버전이 없는 한국어 페이지는 영어 홈으로 보냅니다.
export function switchPath(path: string, to: Lang): string {
  if (to === "ko") {
    const ko = path.replace(/^\/en(?=\/|$)/, "");
    return ko || "/";
  }
  // 약관 페이지는 영어판이 따로 있습니다.
  if (/^\/(privacy|terms)\/?$/.test(path)) return `/en${path.replace(/\/$/, "")}`;
  const m = path.match(/^\/tools\/([^/]+)\/?$/);
  return m && hasEn(m[1]) ? `/en/tools/${m[1]}` : "/en";
}
