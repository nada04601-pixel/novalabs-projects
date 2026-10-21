import type { Metadata } from "next";
import CamBrowser from "@/features/cams/components/CamBrowser";
import s from "@/features/cams/cams.module.css";

// 실시간 관광지 CCTV(시험 운영). 나중에 별도 도메인으로 옮길 예정이라 메뉴·사이트맵에 넣지 않고 검색엔진에도 올리지 않습니다.
export const metadata: Metadata = {
  title: "실시간 관광지 CCTV",
  description: "전국 바다·산·도심·도로의 실시간 라이브 영상을 지도와 목록으로 봅니다.",
  robots: { index: false, follow: false },
};

export default function CamsPage() {
  return (
    <div className={s.wrap}>
      <h1>실시간 관광지 CCTV</h1>
      <p className={s.lead}>전국 바다·산·도심·도로의 지금 모습을 지도와 목록으로 둘러보세요.</p>
      <CamBrowser />
      <p className={s.note}>영상은 각 방송사·지자체가 유튜브에 올린 라이브를 그대로 보여 줍니다. 지도 © OpenStreetMap, 날씨 Open-Meteo.</p>
    </div>
  );
}
