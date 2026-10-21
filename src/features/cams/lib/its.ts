// 국가교통정보센터(ITS) CCTV Open API. 영상 주소는 24시간만 유효해서 Worker(worker/index.ts)가 주기적으로 새로 받아 나눠 줍니다.
// 호출 한도(월 100건, 개발용)를 아끼려고 도로 유형마다 우리 장소를 모두 덮는 범위로 한 번씩만 부릅니다.
// cctvType=4는 https 주소(HLS)를 돌려줍니다. 기술기준: "국가교통정보센터 CCTV API 제공 기술기준"(2026.08.07)
import type { Cam, ItsRoad } from "../types";

export const ITS_API = "https://openapi.its.go.kr:9443/cctvInfo";

const MARGIN = 0.02; // 위경도 범위 여유(약 2km)

// 도로 유형별 요청 주소
export function itsRequests(list: Cam[], apiKey: string): { type: ItsRoad; url: string }[] {
  const types = [...new Set(list.filter((c) => c.itsCctv).map((c) => c.itsCctv!.type))];
  return types.map((type) => {
    const sel = list.filter((c) => c.itsCctv?.type === type);
    const lng = sel.map((c) => c.lng), lat = sel.map((c) => c.lat);
    const q = new URLSearchParams({
      apiKey, type, cctvType: "4",
      minX: (Math.min(...lng) - MARGIN).toFixed(4), maxX: (Math.max(...lng) + MARGIN).toFixed(4),
      minY: (Math.min(...lat) - MARGIN).toFixed(4), maxY: (Math.max(...lat) + MARGIN).toFixed(4),
      getType: "json",
    });
    return { type, url: `${ITS_API}?${q}` };
  });
}

export interface ItsItem {
  cctvname: string;
  cctvurl: string;
  coordx: number | string;
  coordy: number | string;
}

// 응답에서 CCTV 목록을 꺼냅니다. 오류 응답(4001 한도 초과, 4005 인증키 오류 등)은 내용을 담아 던집니다.
export function parseIts(body: unknown): ItsItem[] {
  const data = (body as { response?: { data?: unknown } })?.response?.data;
  if (!Array.isArray(data)) throw new Error(`ITS 응답 오류: ${JSON.stringify(body).slice(0, 300)}`);
  return data as ItsItem[];
}

// 장소 ID → 영상 주소. 이름이 같은 CCTV를 고르고, 이름이 바뀌었으면 300m 안에서 가장 가까운 것을 씁니다.
export function matchStreams(list: Cam[], type: ItsRoad, items: ItsItem[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of list) {
    if (c.itsCctv?.type !== type) continue;
    const exact = items.find((i) => i.cctvname === c.itsCctv!.name);
    const near = items
      .map((i) => ({ i, d: Math.hypot((Number(i.coordx) - c.lng) * 88, (Number(i.coordy) - c.lat) * 111) }))
      .filter((x) => x.d <= 0.3)
      .sort((a, b) => a.d - b.d)[0]?.i;
    const hit = exact ?? near;
    if (hit?.cctvurl) out[c.id] = hit.cctvurl.replace(/^http:\/\//, "https://");
  }
  return out;
}
