// 실시간 관광지 CCTV 자료 형식. 나중에 해외로 넓힐 때를 대비해 국가 코드와 지역을 함께 둡니다.
export type CamCategory = "beaches" | "mountains" | "city" | "traffic";

export interface Cam {
  id: string; // 국가-지역-장소 (예: kr-busan-haeundae), 상세 페이지 주소로 씀
  name: string; // 짧은 장소 이름
  title: string; // 페이지 제목
  countryCode: string; // ISO 3166-1 alpha-2
  region: string;
  category: CamCategory;
  lat: number;
  lng: number;
  description: string;
  // 영상 소스. 라이브 영상 ID나, 방송이 다시 시작돼도 그 채널의 현재 라이브를 보여 주는 채널 ID(UC…) 중 하나를 넣습니다.
  youtubeId?: string;
  youtubeChannelId?: string;
  searchQuery: string; // 소스를 찾을 때 쓰는 유튜브 검색어
  isLive: boolean;
}
