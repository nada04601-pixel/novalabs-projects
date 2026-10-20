import type { Metadata } from "next";
import TtsCompare from "@/components/TtsCompare";

// 혼자 쓰는 음성 합성 비교 페이지. 메뉴·사이트맵에 넣지 않고 검색엔진에도 올리지 않습니다.
export const metadata: Metadata = { title: "음성 합성 비교", robots: { index: false, follow: false } };

export default function TtsLab() {
  return (
    <div className="w page">
      <h1>음성 합성 비교</h1>
      <p>같은 쇼츠 대본을 여러 서비스 목소리로 만들어 들어 보고 고르는 페이지입니다.</p>
      <TtsCompare />
    </div>
  );
}
