// 연결된 유튜브 라이브가 아직 방송 중인지 판단하는 순수 함수들. 매일 GitHub Actions가 scripts/check-live.mjs로 실행합니다.
// 라이브는 방송이 끊겼다가 다시 열리면 새 영상 ID를 받으므로, 예전 ID는 "방송 종료"가 됩니다.
// (Node가 타입만 지우고 바로 실행하므로 TS 전용 문법(enum 등)과 값 import는 쓰지 않습니다.)
import type { Cam } from "../types";

export interface VideoInfo {
  id: string;
  title: string;
  channelTitle: string;
  live: "live" | "upcoming" | "none";
  embeddable: boolean;
  privacy: string;
}

export interface CamStatus {
  cam: Cam;
  ok: boolean;
  problem?: string;
  title?: string;
}

// YouTube Data API videos.list(part=snippet,status) 응답 → 영상 ID별 정보
export function parseVideos(json: { items?: unknown[] }): Map<string, VideoInfo> {
  const map = new Map<string, VideoInfo>();
  for (const raw of json.items ?? []) {
    const v = raw as { id: string; snippet?: Record<string, string>; status?: { embeddable?: boolean; privacyStatus?: string } };
    const live = v.snippet?.liveBroadcastContent;
    map.set(v.id, {
      id: v.id,
      title: v.snippet?.title ?? "",
      channelTitle: v.snippet?.channelTitle ?? "",
      live: live === "live" || live === "upcoming" ? live : "none",
      embeddable: v.status?.embeddable !== false,
      privacy: v.status?.privacyStatus ?? "public",
    });
  }
  return map;
}

// 영상 ID로 연결한 장소
export function judgeVideo(cam: Cam, v: VideoInfo | undefined): CamStatus {
  const bad = (problem: string): CamStatus => ({ cam, ok: false, problem, title: v?.title });
  if (!v) return bad("영상을 찾을 수 없음 (삭제 또는 비공개)");
  if (v.privacy === "private") return bad("비공개로 바뀜");
  if (!v.embeddable) return bad("다른 사이트에서 재생이 막힘");
  if (v.live === "upcoming") return bad("방송 예정 (아직 시작 전)");
  if (v.live === "none") return bad("방송 종료");
  return { cam, ok: true, title: v.title };
}

// 채널 ID로 연결한 장소: 그 채널에 진행 중인 라이브가 있는지만 봅니다.
export function judgeChannel(cam: Cam, liveVideoTitle: string | null): CamStatus {
  return liveVideoTitle === null
    ? { cam, ok: false, problem: "채널에 진행 중인 라이브 없음" }
    : { cam, ok: true, title: liveVideoTitle };
}

const youtubeLink = (c: Cam) =>
  c.youtubeId ? `https://www.youtube.com/watch?v=${c.youtubeId}` : `https://www.youtube.com/channel/${c.youtubeChannelId}/live`;

// 점검 결과를 GitHub 이슈·실행 요약에 넣을 마크다운으로 만듭니다.
export function report(statuses: CamStatus[], siteUrl: string, base: string): string {
  const bad = statuses.filter((s) => !s.ok);
  const lines = [
    bad.length
      ? `영상이 연결된 ${statuses.length}곳 중 **${bad.length}곳**의 영상을 확인해야 합니다.`
      : `영상이 연결된 ${statuses.length}곳 모두 방송 중입니다.`,
  ];
  if (bad.length) {
    lines.push(
      "",
      "| 장소 | 상태 | 영상 | 출처 |",
      "|---|---|---|---|",
      ...bad.map((s) => `| [${s.cam.name}](${siteUrl}${base}/${s.cam.id}) | ${s.problem} | [${s.cam.youtubeId ?? s.cam.youtubeChannelId}](${youtubeLink(s.cam)}) | ${s.cam.sourceName ?? "-"} |`),
      "",
      "같은 채널에서 새 라이브 주소를 찾아 `src/features/cams/data/cams.json`의 `youtubeId`를 바꾸거나, 당분간 영상을 뺄 곳은 `youtubeId`를 지우고 `isLive`를 `false`로 바꾸세요.",
    );
  }
  return lines.join("\n") + "\n";
}
