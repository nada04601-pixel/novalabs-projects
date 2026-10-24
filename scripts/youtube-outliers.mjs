// 해외반응 쇼츠 주제 찾기: 구독자는 적은데 조회수가 큰 쇼츠를 YouTube Data API로 찾아 CSV로 저장합니다.
// 사용: YOUTUBE_API_KEY=... node scripts/youtube-outliers.mjs [옵션] [검색어 ...]
//   --days 30         최근 며칠 안에 올라온 영상만 (기본 30)
//   --max-subs 10000  구독자가 이 수 이하인 채널만 (기본 1만)
//   --min-views 100000 조회수가 이 수 이상인 영상만 (기본 10만)
//   --min-ratio 10    조회수 ÷ 구독자가 이 배수 이상인 영상만 (기본 10배)
//   --sort views      정렬 기준: views(조회수 높은 순, 기본) 또는 ratio(배수 큰 순)
//   --pages 2         검색어마다 검색 결과를 몇 쪽(쪽당 50개)까지 볼지 (기본 2)
//   --out outlier-shorts.csv
// 검색어를 안 주면 DEFAULT_QUERIES를 씁니다.
// API 사용량: 검색 1쪽에 100단위, 영상·채널 조회는 50개에 1단위. 하루 기본 한도는 10,000단위입니다.
// 쇼츠 여부는 API가 알려 주지 않아 길이 3분(180초) 이하인 영상을 쇼츠로 봅니다.
import { appendFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const API = "https://www.googleapis.com/youtube/v3";
const DEFAULT_QUERIES = ["해외반응", "외국인 반응", "외국 반응"];
const SHORTS_MAX_SEC = 180;

// "PT1M5S" 같은 ISO 8601 길이를 초로 바꿉니다. 읽을 수 없으면 null
export function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? "");
  if (!m) return null;
  const [, d = 0, h = 0, min = 0, s = 0] = m;
  return Number(d) * 86400 + Number(h) * 3600 + Number(min) * 60 + Number(s);
}

// 영상·채널 자료를 합쳐 기준에 맞는 것만 sort 기준(views: 조회수, ratio: 배수)으로 큰 순서대로 돌려줍니다.
// 구독자 수를 숨긴 채널은 배수를 셀 수 없어 뺍니다.
export function pickOutliers(videos, channels, { maxSubs, minViews, minRatio, sort = "views" }) {
  const rows = [];
  for (const v of videos) {
    const ch = channels.get(v.snippet.channelId);
    if (!ch || ch.statistics.hiddenSubscriberCount) continue;
    const sec = parseDuration(v.contentDetails.duration);
    if (sec === null || sec > SHORTS_MAX_SEC) continue;
    const subs = Number(ch.statistics.subscriberCount ?? 0);
    const views = Number(v.statistics.viewCount ?? 0);
    const ratio = views / Math.max(subs, 1);
    if (subs > maxSubs || views < minViews || ratio < minRatio) continue;
    rows.push({
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      subs,
      views,
      ratio: Math.round(ratio * 10) / 10,
      published: v.snippet.publishedAt.slice(0, 10),
      seconds: sec,
      url: `https://www.youtube.com/shorts/${v.id}`,
      query: v.query,
    });
  }
  return rows.sort((a, b) => b[sort] - a[sort]);
}

function csvCell(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

// 엑셀·구글 시트에서 한글이 깨지지 않게 BOM을 붙입니다.
export function toCsv(rows, today) {
  const head = ["찾은 날짜", "영상 제목", "채널", "구독자", "조회수", "배수", "올린 날짜", "길이(초)", "링크", "검색어"];
  const lines = rows.map((r) =>
    [today, r.title, r.channel, r.subs, r.views, r.ratio, r.published, r.seconds, r.url, r.query].map(csvCell).join(","),
  );
  return "﻿" + [head.join(","), ...lines].join("\n") + "\n";
}

// GitHub Actions 실행 결과 화면에 보여 줄 표 (rows 순서대로 limit개)
export function toMarkdown(rows, limit = 30) {
  const cell = (s) => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
  const lines = rows
    .slice(0, limit)
    .map((r) => `| ${r.ratio}배 | ${r.views.toLocaleString("ko-KR")} | ${r.subs.toLocaleString("ko-KR")} | [${cell(r.title)}](${r.url}) | ${cell(r.channel)} | ${r.published} |`);
  return ["| 배수 | 조회수 | 구독자 | 영상 | 채널 | 올린 날짜 |", "|---:|---:|---:|---|---|---|", ...lines].join("\n") + "\n";
}

function parseArgs(argv) {
  const opts = { days: 30, maxSubs: 10000, minViews: 100000, minRatio: 10, sort: "views", pages: 2, out: "outlier-shorts.csv" };
  const names = { "--days": "days", "--max-subs": "maxSubs", "--min-views": "minViews", "--min-ratio": "minRatio", "--sort": "sort", "--pages": "pages", "--out": "out" };
  const queries = [];
  for (let i = 0; i < argv.length; i++) {
    const key = names[argv[i]];
    if (!key) {
      queries.push(argv[i]);
      continue;
    }
    const value = argv[++i];
    if (value === undefined) throw new Error(`${argv[i - 1]} 다음에 값이 없습니다`);
    const isText = key === "out" || key === "sort";
    opts[key] = isText ? value : Number(value);
    if (key === "sort" && !["views", "ratio"].includes(value)) throw new Error(`--sort는 views 또는 ratio입니다: ${value}`);
    if (!isText && !Number.isFinite(opts[key])) throw new Error(`${argv[i - 1]} 값이 숫자가 아닙니다: ${value}`);
  }
  return { opts, queries: queries.length ? queries : DEFAULT_QUERIES };
}

async function api(path, params, key) {
  const url = `${API}/${path}?${new URLSearchParams({ ...params, key })}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${body.error?.message ?? ""}`);
  return body;
}

// ids를 50개씩 나눠 조회합니다 (API 한 번에 최대 50개)
async function listByIds(path, part, ids, key) {
  const items = [];
  for (let i = 0; i < ids.length; i += 50) {
    const body = await api(path, { part, id: ids.slice(i, i + 50).join(","), maxResults: "50" }, key);
    items.push(...body.items);
  }
  return items;
}

async function main() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY 환경 변수가 없습니다");
  const { opts, queries } = parseArgs(process.argv.slice(2));
  const after = new Date(Date.now() - opts.days * 86400000).toISOString();

  const queryOf = new Map(); // 영상 id → 처음 찾은 검색어
  for (const q of queries) {
    let pageToken;
    for (let p = 0; p < opts.pages; p++) {
      const body = await api(
        "search",
        {
          part: "id",
          q,
          type: "video",
          videoDuration: "short",
          order: "viewCount",
          publishedAfter: after,
          regionCode: "KR",
          relevanceLanguage: "ko",
          maxResults: "50",
          ...(pageToken && { pageToken }),
        },
        key,
      );
      for (const item of body.items) if (!queryOf.has(item.id.videoId)) queryOf.set(item.id.videoId, q);
      pageToken = body.nextPageToken;
      if (!pageToken) break;
    }
  }

  const videos = await listByIds("videos", "snippet,statistics,contentDetails", [...queryOf.keys()], key);
  for (const v of videos) v.query = queryOf.get(v.id);
  const channelIds = [...new Set(videos.map((v) => v.snippet.channelId))];
  const channels = new Map((await listByIds("channels", "statistics", channelIds, key)).map((c) => [c.id, c]));

  const rows = pickOutliers(videos, channels, opts);
  const today = new Date().toISOString().slice(0, 10);
  await writeFile(opts.out, toCsv(rows, today));
  const summary = `영상 ${videos.length}개 중 ${rows.length}개가 기준에 맞습니다`;
  console.log(`${summary} → ${opts.out}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const criteria = `최근 ${opts.days}일 · 구독자 ${opts.maxSubs.toLocaleString("ko-KR")} 이하 · 조회수 ${opts.minViews.toLocaleString("ko-KR")} 이상 · ${opts.minRatio}배 이상 · ${opts.sort === "views" ? "조회수" : "배수"} 높은 순 · 검색어: ${queries.join(", ")}`;
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## 해외반응 쇼츠 후보\n\n${criteria}\n\n${summary}.\n\n${rows.length ? toMarkdown(rows) : ""}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
