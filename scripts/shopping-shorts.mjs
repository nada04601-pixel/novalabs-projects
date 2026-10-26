// 쇼핑 쇼츠 영상 템플릿: 상품 영상 클립과 대본(JSON)으로 9:16 쇼츠를 만듭니다.
// 사용: node scripts/shopping-shorts.mjs 설정.json
// 화면 구성(1080×1920):
//   위쪽     훅 제목 2줄 (영상 내내)
//   가운데   상품 영상 (세로 화면에 꽉 차게 자름, 클립이 짧으면 처음부터 반복)
//   아래쪽   대본 자막 띠 (원본 영상에 박힌 자막을 덮는 어두운 띠 위에 한 줄씩)
//   맨 아래  구매 안내(마지막 몇 초)와 광고 표시 문구(영상 내내, 넣었을 때만)
// 내레이션 음성 파일을 주면 그 길이에 맞춰 대본 자막을 글자 수 비율로 나누고,
// 없으면 글자 수로 줄마다 시간을 정합니다.
// 설정 예시는 scripts/shopping-shorts.example.json, 글꼴은 Pretendard(node_modules/pretendard).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const W = 1080;
const H = 1920;
const FPS = 30;
const FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../node_modules/pretendard/dist/public/static");

// 내레이션 없이 자막만 넘길 때 한 줄의 길이: 글자당 0.15초 + 0.3초, 최소 1.2초
export function lineSeconds(text) {
  const chars = text.replace(/\s/g, "").length;
  return Math.max(1.2, Math.round((chars * 0.15 + 0.3) * 100) / 100);
}

// 줄마다 시작·끝 시간을 정합니다. total(내레이션 길이)이 있으면 글자 수 비율로 나눕니다.
export function planLines(lines, total) {
  const weights = lines.map((t) => (total ? Math.max(1, t.replace(/\s/g, "").length) : lineSeconds(t)));
  const scale = total ? total / weights.reduce((a, b) => a + b, 0) : 1;
  let t = 0;
  return lines.map((text, i) => {
    const start = t;
    t = i === lines.length - 1 && total ? total : t + weights[i] * scale;
    return { text, start, end: t };
  });
}

// "0:00:01.50" 같은 ASS 시간 표기
export function assTime(sec) {
  const cs = Math.round(sec * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

// 대본 글자 중 ASS가 명령으로 읽는 { } \ 를 그대로 보이게 바꿉니다.
function assText(text) {
  return text.replaceAll("\\", "＼").replaceAll("{", "｛").replaceAll("}", "｝");
}

// 자막 띠의 세로 가운데에 대본 자막이 오도록 아래 여백을 계산합니다.
function bandMargin(band) {
  return Math.round(H - (band.y + band.height / 2) - 36);
}

export function buildAss(spec, timeline, total) {
  const band = spec.coverBand ?? { y: 1400, height: 200 };
  const ctaSeconds = spec.ctaSeconds ?? 3;
  const style = (name, size, primary, outline, borderStyle, align, marginV, bold = 1) =>
    `Style: ${name},Pretendard,${size},${primary},&H000000FF,${outline},&H00000000,${bold},0,0,0,100,100,0,0,${borderStyle},6,0,${align},60,60,${marginV},1`;
  const events = [];
  const add = (style, start, end, text) => events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},${style},,0,0,0,,${text}`);

  const [title1 = "", title2 = ""] = spec.title ?? [];
  // 제목 둘째 줄은 노란색으로 강조합니다.
  add("Title", 0, total, `${assText(title1)}${title2 ? `\\N{\\c&H00F0FF&}${assText(title2)}` : ""}`);
  for (const line of timeline) add("Caption", line.start, line.end, assText(line.text));
  if (spec.cta) add("Cta", Math.max(0, total - ctaSeconds), total, assText(spec.cta));
  if (spec.disclosure) add("Note", 0, total, assText(spec.disclosure));

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    style("Title", 92, "&H00FFFFFF", "&H00000000", 1, 8, 170),
    style("Caption", 66, "&H00FFFFFF", "&H00000000", 1, 2, bandMargin(band)),
    // 구매 안내는 노란 상자에 검은 글씨
    style("Cta", 58, "&H00000000", "&H0000E1FF", 3, 2, 150),
    style("Note", 30, "&H00DDDDDD", "&H00000000", 1, 2, 60, 0),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events,
    "",
  ].join("\n");
}

export function probeDuration(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return Number(out.trim());
}

// 클립을 차례로 이어 total초가 될 때까지 반복할 목록을 만듭니다.
export function fillClips(clips, total) {
  const lengths = clips.map((c) => c.end - c.start);
  if (lengths.some((l) => !(l > 0))) throw new Error("클립의 end는 start보다 커야 합니다");
  const out = [];
  let sum = 0;
  for (let i = 0; sum < total; i = (i + 1) % clips.length) {
    out.push(clips[i]);
    sum += lengths[i];
  }
  return out;
}

export function buildArgs(spec, total, assFile, base) {
  const resolve = (f) => path.resolve(base, f);
  const parts = fillClips(spec.clips, total);
  const args = ["-y"];
  for (const c of parts) args.push("-ss", String(c.start), "-t", String(c.end - c.start), "-i", resolve(c.file));
  const filters = parts.map(
    (_, i) => `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1[v${i}]`,
  );
  const band = spec.coverBand ?? { y: 1400, height: 200 };
  const assPath = assFile.replaceAll("\\", "/").replaceAll(":", "\\:");
  filters.push(
    `${parts.map((_, i) => `[v${i}]`).join("")}concat=n=${parts.length}:v=1:a=0,trim=duration=${total},setpts=PTS-STARTPTS,` +
      `drawbox=x=0:y=${band.y}:w=${W}:h=${band.height}:color=black@0.85:t=fill,` +
      `ass='${assPath}':fontsdir='${FONTS_DIR}'[vout]`,
  );

  // 소리: 내레이션, 배경 음악(-18dB 정도), 원본 소리(originalAudio 배율) 중 있는 것을 섞고, 하나도 없으면 무음
  const audio = [];
  let next = parts.length;
  if (spec.narration) {
    args.push("-i", resolve(spec.narration));
    audio.push(`[${next++}:a]volume=1[n]`);
  }
  if (spec.bgm) {
    args.push("-stream_loop", "-1", "-i", resolve(spec.bgm));
    audio.push(`[${next++}:a]volume=${spec.bgmVolume ?? 0.12}[b]`);
  }
  if (spec.originalAudio) audio.push(`[0:a]volume=${spec.originalAudio}[o]`);
  const labels = audio.map((f) => f.slice(f.lastIndexOf("[")));
  if (labels.length) {
    filters.push(...audio, `${labels.join("")}amix=inputs=${labels.length}:duration=longest:normalize=0,atrim=duration=${total}[aout]`);
  } else {
    args.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=44100:cl=stereo");
    filters.push(`[${next}:a]anull[aout]`);
  }
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[vout]", "-map", "[aout]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-t", String(total), "-movflags", "+faststart",
    resolve(spec.out ?? "shopping-short.mp4"),
  );
  return args;
}

function main() {
  const specFile = process.argv[2];
  if (!specFile) throw new Error("설정 파일(.json) 경로를 넣어 주세요");
  const spec = JSON.parse(readFileSync(specFile, "utf8"));
  const base = path.dirname(path.resolve(specFile));
  if (!spec.clips?.length) throw new Error("clips에 상품 영상을 하나 이상 넣어 주세요");
  if (!spec.lines?.length) throw new Error("lines에 대본을 한 줄 이상 넣어 주세요");

  const total = spec.narration ? probeDuration(path.resolve(base, spec.narration)) : undefined;
  const timeline = planLines(spec.lines, total);
  const length = total ?? timeline.at(-1).end;
  const assFile = path.join(mkdtempSync(path.join(tmpdir(), "shorts-")), "subs.ass");
  writeFileSync(assFile, buildAss(spec, timeline, length));
  execFileSync("ffmpeg", ["-v", "error", ...buildArgs(spec, length, assFile, base)], { stdio: "inherit" });
  console.log(`${Math.round(length * 10) / 10}초 쇼츠를 만들었습니다 → ${path.resolve(base, spec.out ?? "shopping-short.mp4")}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
