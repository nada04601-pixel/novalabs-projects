import { describe, expect, it } from "vitest";
import { itsRequests, matchStreams, parseIts } from "./its";
import { cams, getCam } from "./cams";

describe("국가교통정보센터 CCTV", () => {
  const cam = getCam("kr-gangneung-tollgate")!;

  it("도로 유형마다 한 번씩, 장소를 모두 덮는 범위로 요청한다", () => {
    const reqs = itsRequests(cams, "KEY");
    expect(reqs.map((r) => r.type)).toEqual(["its"]);
    const q = new URL(reqs[0].url).searchParams;
    expect(q.get("apiKey")).toBe("KEY");
    expect(q.get("cctvType")).toBe("4");
    expect(Number(q.get("minX"))).toBeLessThan(cam.lng);
    expect(Number(q.get("maxX"))).toBeGreaterThan(cam.lng);
    expect(Number(q.get("minY"))).toBeLessThan(cam.lat);
    expect(Number(q.get("maxY"))).toBeGreaterThan(cam.lat);
    expect(itsRequests([], "KEY")).toEqual([]);
  });

  it("응답을 읽고 오류는 알린다", () => {
    expect(parseIts({ response: { data: [], datacount: 0 } })).toEqual([]);
    expect(() => parseIts({ response: { resultCode: "4001", resultMsg: "사용량 제한" } })).toThrow(/4001/);
    expect(() => parseIts(null)).toThrow(/ITS 응답 오류/);
  });

  it("이름으로, 없으면 가까운 CCTV로 짝을 짓는다", () => {
    const items = [
      { cctvname: "[국도35] 강릉 성산교차로", cctvurl: "https://x/1", coordx: 128.8329, coordy: 37.720474 },
      { cctvname: "[국도35] 강릉 강릉IC", cctvurl: "http://x/2", coordx: 128.854423, coordy: 37.737599 },
    ];
    expect(matchStreams(cams, "its", items)).toEqual({ "kr-gangneung-tollgate": "https://x/2" });
    // 이름이 바뀌어도 300m 안이면 같은 CCTV로 본다
    expect(matchStreams(cams, "its", [{ ...items[1], cctvname: "강릉IC(변경)" }])).toEqual({ "kr-gangneung-tollgate": "https://x/2" });
    // 멀리 있는 다른 CCTV는 쓰지 않는다
    expect(matchStreams(cams, "its", [items[0]])).toEqual({});
    expect(matchStreams(cams, "ex", items)).toEqual({});
  });
});
