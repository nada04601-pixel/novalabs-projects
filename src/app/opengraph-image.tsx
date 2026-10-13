import { site } from "@/data/site";
import { ogContentType, ogImage, ogSize } from "@/lib/og";

export const dynamic = "force-static";
export const alt = site.name;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogImage({ label: "계산기 · 문서 도구 모음", title: site.tagline, description: "연봉 실수령액, 퇴직금, 대출이자부터 PDF 합치기·용량 줄이기까지" });
}
