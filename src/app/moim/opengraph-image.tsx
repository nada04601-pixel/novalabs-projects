import { ogContentType, ogImage, ogSize } from "@/lib/og";

export const dynamic = "force-static";
export const alt = "모임 정산 계산기";
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogImage({ label: "모임 정산", title: "모임 정산 계산기 (차수별 N빵)", description: "1차·2차 참석 여부까지 나눠 계산하고, 링크 하나로 정산 결과를 공유하세요." });
}
