// 실시간 CCTV에 연결한 유튜브 라이브가 아직 방송 중인지 점검합니다. 매일 .github/workflows/check-cams.yml이 실행합니다.
// 사용: YOUTUBE_API_KEY=... node --experimental-strip-types src/features/cams/scripts/check-live.mjs
// 결과는 cams-report.md에 쓰고, GitHub Actions에서는 실행 요약과 출력값(problems)에도 남깁니다.
// 비용: 영상 50개당 1단위(videos.list), 채널 ID로 연결한 곳은 곳마다 100단위(search.list). 하루 무료 할당량은 10,000단위입니다.
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { parseVideos, judgeVideo, judgeChannel, report } from "../lib/liveCheck.ts";

const API = "https://www.googleapis.com/youtube/v3";
const SITE = "https://novalabs.co.kr";
const BASE = "/cams";
const key = process.env.YOUTUBE_API_KEY;

async function api(path, params) {
  const url = `${API}/${path}?${new URLSearchParams({ ...params, key })}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  // 키가 틀렸거나 할당량을 다 쓴 경우 등은 점검 실패로 끝내 Actions가 알리게 합니다.
  if (!res.ok) throw new Error(`YouTube API ${path}: HTTP ${res.status} ${body?.error?.message ?? ""}`);
  return body;
}

async function main() {
  if (!key) {
    console.log("YOUTUBE_API_KEY가 없어 점검을 건너뜁니다.");
    return;
  }
  const cams = JSON.parse(await readFile(new URL("../data/cams.json", import.meta.url), "utf8"));
  const byVideo = cams.filter((c) => c.youtubeId);
  const byChannel = cams.filter((c) => !c.youtubeId && c.youtubeChannelId);

  const videos = new Map();
  for (let i = 0; i < byVideo.length; i += 50) {
    const ids = byVideo.slice(i, i + 50).map((c) => c.youtubeId);
    for (const [id, v] of parseVideos(await api("videos", { part: "snippet,status", id: ids.join(","), maxResults: "50" }))) videos.set(id, v);
  }
  const statuses = byVideo.map((c) => judgeVideo(c, videos.get(c.youtubeId)));
  for (const c of byChannel) {
    const found = await api("search", { part: "snippet", channelId: c.youtubeChannelId, eventType: "live", type: "video", maxResults: "1" });
    statuses.push(judgeChannel(c, found.items?.[0]?.snippet?.title ?? null));
  }

  const md = report(statuses, SITE, BASE);
  const problems = statuses.filter((s) => !s.ok).length;
  for (const s of statuses) console.log(`${s.ok ? "OK  " : "FAIL"} ${s.cam.id}${s.problem ? ` — ${s.problem}` : ""}${s.title ? ` (${s.title})` : ""}`);
  await writeFile("cams-report.md", md);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `problems=${problems}\n`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
