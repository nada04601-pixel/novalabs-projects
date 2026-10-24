// 유튜브 자막(WebVTT)을 "[분:초] 문장" 줄로 바꿉니다. 해외반응 쇼츠 대본에 원본 대사와 시간을 옮길 때 씁니다.
// 사용: node scripts/vtt-to-text.mjs 자막.vtt
// 자동 생성 자막은 같은 문장이 다음 자막에 겹쳐 다시 나오므로, 바로 앞 줄과 같은 줄은 한 번만 남깁니다.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// "00:01:05.320" 또는 "01:05.320"을 초로 바꿉니다.
function toSeconds(stamp) {
  const parts = stamp.split(":").map(Number);
  return parts.reduce((sum, n) => sum * 60 + n, 0);
}

function formatTime(sec) {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// 단어별 시간 표시(<00:00:01.200>)와 <c> 같은 꾸밈 태그를 지우고, 자주 쓰는 HTML 문자를 되돌립니다.
function cleanText(line) {
  return line
    .replace(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function vttToLines(vtt) {
  const out = [];
  let last = "";
  for (const block of vtt.replace(/\r/g, "").split(/\n{2,}/)) {
    const rows = block.split("\n");
    const timeRow = rows.findIndex((r) => r.includes("-->"));
    if (timeRow === -1) continue;
    const start = toSeconds(rows[timeRow].split("-->")[0].trim().split(/\s/)[0]);
    for (const raw of rows.slice(timeRow + 1)) {
      const text = cleanText(raw);
      if (!text || text === last) continue;
      out.push({ time: formatTime(start), text });
      last = text;
    }
  }
  return out;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("자막 파일(.vtt) 경로를 넣어 주세요");
  for (const { time, text } of vttToLines(await readFile(file, "utf8"))) console.log(`[${time}] ${text}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
