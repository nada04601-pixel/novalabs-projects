// 실시간 CCTV 목록을 고르고 찾는 순수 함수들. 화면 코드와 분리해 테스트하고, 도메인을 옮길 때 이 폴더째 가져갑니다.
import data from "../data/cams.json";
import type { Cam, CamCategory } from "../types";

export const cams = data as Cam[];

// 페이지 주소의 시작 부분. 별도 도메인으로 옮기면 ""로 바꿉니다.
export const CAMS_BASE = "/cams";
export const camHref = (c: Cam) => `${CAMS_BASE}/${c.id}`;

export const CATEGORIES: { id: CamCategory | "all"; label: string; emoji: string }[] = [
  { id: "all", label: "전체", emoji: "📍" },
  { id: "beaches", label: "바다·해변", emoji: "🌊" },
  { id: "mountains", label: "산·자연", emoji: "⛰️" },
  { id: "city", label: "도심·랜드마크", emoji: "🏙️" },
  { id: "traffic", label: "교통·도로", emoji: "🚗" },
];

export const categoryOf = (c: CamCategory) => CATEGORIES.find((x) => x.id === c)!;

export const getCam = (id: string) => cams.find((c) => c.id === id);

// 띄어쓰기·대소문자와 상관없이 이름·제목·지역·소개에서 찾습니다.
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

export function filterCams(list: Cam[], category: CamCategory | "all", query = ""): Cam[] {
  const q = norm(query);
  return list.filter(
    (c) =>
      (category === "all" || c.category === category) &&
      (!q || [c.name, c.title, c.region, c.description].some((s) => norm(s).includes(q))),
  );
}

// 두 지점 사이 거리(km, 하버사인 공식)
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// "함께 보면 좋은 라이브": 가까운 곳 절반, 같은 분류의 다른 지역 절반을 겹치지 않게 섞습니다.
export function relatedCams(cam: Cam, list: Cam[] = cams, limit = 4): Cam[] {
  const others = list.filter((c) => c.id !== cam.id);
  const near = [...others].sort((a, b) => distanceKm(cam, a) - distanceKm(cam, b));
  const sameKind = others.filter((c) => c.category === cam.category && c.region !== cam.region);
  const picked: Cam[] = [];
  const take = (c?: Cam) => c && !picked.includes(c) && picked.length < limit && picked.push(c);
  near.slice(0, Math.ceil(limit / 2)).forEach(take);
  sameKind.forEach(take);
  near.forEach(take);
  return picked;
}

export const hasSource = (c: Cam) => Boolean(c.youtubeId || c.youtubeChannelId || c.hlsUrl);

// HLS 주소. 우리 페이지가 https라 http 주소는 브라우저가 막으므로 https로 바꿉니다(ITS CCTV 서버는 https도 응답).
export const hlsSrc = (c: Cam) => (c.hlsUrl ? c.hlsUrl.replace(/^http:\/\//, "https://") : null);

// 영상이 연결된 곳을 앞으로 보냅니다. 같은 무리 안에서는 자료 순서를 지킵니다.
export const sourceFirst = (list: Cam[]) => [...list].sort((a, b) => Number(hasSource(b)) - Number(hasSource(a)));

// 소리는 끈 채 자동 재생합니다(브라우저는 소리 있는 자동 재생을 막음). 채널 ID는 그 채널에서 지금 방송 중인 라이브를 띄웁니다.
export function embedUrl(c: Cam): string | null {
  if (c.youtubeId) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(c.youtubeId)}?autoplay=1&mute=1&playsinline=1`;
  if (c.youtubeChannelId) return `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(c.youtubeChannelId)}&autoplay=1&mute=1&playsinline=1`;
  return null;
}

// 영상 ID가 있을 때만 유튜브 썸네일을 씁니다(채널 ID로는 썸네일 주소를 알 수 없음).
// hqdefault_live.jpg는 방송 중일 때만 있어 끝난 방송이면 깨진 그림이 되므로, 늘 있는 hqdefault.jpg를 씁니다.
export const thumbnailUrl = (c: Cam) => (c.youtubeId ? `https://i.ytimg.com/vi/${encodeURIComponent(c.youtubeId)}/hqdefault.jpg` : null);

// 출처 링크: 직접 넣은 주소가 없으면 유튜브의 해당 영상(채널 라이브) 페이지
export function sourceHref(c: Cam): string | null {
  if (c.sourceUrl) return c.sourceUrl;
  if (c.youtubeId) return `https://www.youtube.com/watch?v=${encodeURIComponent(c.youtubeId)}`;
  if (c.youtubeChannelId) return `https://www.youtube.com/channel/${encodeURIComponent(c.youtubeChannelId)}/live`;
  return null;
}

export const searchUrl = (c: Cam) => `https://www.youtube.com/results?search_query=${encodeURIComponent(c.searchQuery)}&sp=EgJAAQ%253D%253D`;

// Open-Meteo 날씨 코드(WMO) → 한국어
export function weatherLabel(code: number): string {
  if (code === 0) return "☀️ 맑음";
  if (code <= 2) return "🌤️ 구름 조금";
  if (code === 3) return "☁️ 흐림";
  if (code === 45 || code === 48) return "🌫️ 안개";
  if (code >= 51 && code <= 57) return "🌦️ 이슬비";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "🌧️ 비";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "🌨️ 눈";
  if (code >= 95) return "⛈️ 뇌우";
  return "날씨 정보";
}
