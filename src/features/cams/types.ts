// 실시간 관광지 CCTV 자료 형식. 나중에 해외로 넓힐 때를 대비해 국가 코드와 지역을 함께 둡니다.
export type CamCategory = "beaches" | "mountains" | "city" | "traffic";
export type ItsRoad = "its" | "ex"; // 국가교통정보센터 도로 유형: 국도, 고속도로

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
  // 유튜브가 아닌 실시간 영상(HLS, .m3u8). 국가교통정보센터(ITS) CCTV처럼 http로 받은 주소도 https로 바꿔 재생합니다.
  hlsUrl?: string;
  // 국가교통정보센터(ITS) CCTV. 주소가 24시간마다 바뀌므로 이름만 적어 두고 Worker(/api/cams/streams)에서 그때그때 받습니다.
  // CCTV가 장소 표시 위치에서 떨어져 있으면 lat·lng에 CCTV 좌표를 적습니다(이름이 바뀌었을 때 이 좌표 근처에서 찾음).
  itsCctv?: { type: ItsRoad; name: string; lat?: number; lng?: number };
  // 영상 출처. 플레이어 아래와 카드에 "○○ 제공"으로 표시합니다. 링크가 없으면 유튜브 영상(채널) 주소로 연결합니다.
  sourceName?: string;
  sourceUrl?: string;
  searchQuery: string; // 소스를 찾을 때 쓰는 유튜브 검색어
  isLive: boolean;
}
