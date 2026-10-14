// 티스토리 대표 이미지(1080×1080 PNG)를 만듭니다. 글자는 사이트와 같은 Pretendard 글꼴을 씁니다.
// 사용법: node blog/tistory/thumbnails/make-thumbnails.mjs   (npm install 후, Chromium 필요)
// 내용을 고치려면 아래 POSTS를 고친 뒤 다시 실행하세요. CHROME 환경 변수로 Chromium 경로를 바꿀 수 있습니다.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const fontDir = path.join(root, "node_modules/pretendard/dist/web/static/woff2");
const chrome =
  process.env.CHROME ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].find(existsSync);

// accent: 글마다 다른 강조색. points의 **굵게**는 강조색으로 칠합니다.
const POSTS = [
  {
    file: "01-year-end-tax",
    tag: "연말정산",
    accent: "#2f6fed",
    title: ["연말정산,", "10월부터 바꿀 수 있는 3가지"],
    points: ["카드 사용액이 총급여 25%를 넘었다면 **체크카드 30%**", "연금저축·IRP는 12월에 넣어도 **최대 16.5%**", "월세 사는 직장인은 **월세의 최대 17%** 공제"],
  },
  {
    file: "02-resignation-money",
    tag: "퇴사·이직",
    accent: "#0f9d76",
    title: ["퇴사 전에", "꼭 계산해 볼 돈 4가지"],
    points: ["퇴직금: 재직 **1년 + 하루**를 확인", "남은 연차는 **연차수당**으로", "실업급여 하루 **최소 66,048원**", "건강보험료: **임의계속가입** 비교"],
  },
  {
    file: "03-part-time-paycheck",
    tag: "알바 월급",
    accent: "#e8590c",
    title: ["2026 최저시급 10,320원", "알바 월급 직접 계산하기"],
    points: ["주 **15시간**부터 주휴수당", "밤 10시 이후 근무는 **1.5배**", "3.3% 뗀 세금은 **5월에 환급**"],
  },
  {
    file: "04-browser-pdf-video",
    tag: "PDF·동영상",
    accent: "#7048e8",
    title: ["설치 없이", "PDF·동영상 정리하기"],
    points: ["사진 → PDF → 합치기 → **압축은 마지막에**", "파일은 **서버로 보내지 않고** 브라우저에서", "동영상 **자르기·압축·GIF·MP3**"],
  },
  {
    file: "05-loan-savings",
    tag: "대출·적금",
    accent: "#1c7ed6",
    title: ["1억 대출, 상환 방식만 바꿔도", "이자 1,000만 원 넘게 차이"],
    points: ["총 이자: 원금균등 < 원리금균등 < **만기일시**", "적금 이자는 같은 금리 예금의 **절반쯤**", "이자에서는 **15.4%** 세금이 빠진다"],
  },
  {
    file: "06-work-time-tools",
    tag: "시간 관리",
    accent: "#c2255c",
    title: ["회의·하루·마감까지", "시간 나누는 5가지 방법"],
    points: ["회의는 **안건별 끝나는 시각**부터", "하루 계획은 **못 넣는 일**을 먼저 확인", "마감은 **거꾸로 시작일**을 계산"],
  },
  {
    file: "07-moving-rent",
    tag: "이사·전월세",
    accent: "#2b8a3e",
    title: ["전월세 계약 전에", "계산해 볼 4가지"],
    points: ["복비는 정해진 값이 아니라 **상한**", "보증금 ↔ 월세는 **전환율**로 비교", "전용 84㎡는 약 **25.4평**", "월세는 연말정산 **세액공제**까지"],
  },
  {
    file: "08-college-semester",
    tag: "대학생활",
    accent: "#f08c00",
    title: ["기말고사 몇 점 받아야", "A가 나올까?"],
    points: ["반영 비율로 **기말 목표 점수** 계산", "결석 **몇 번 더** 빠지면 F인지", "목표 평점까지 **남은 학기 평균**", "졸업은 **영역별 학점**까지 확인"],
  },
  {
    file: "09-year-end-party",
    tag: "송년회 정산",
    accent: "#d6336c",
    title: ["송년회 N빵,", "공평하게 나누는 법"],
    points: ["2차는 **간 사람끼리** 나누기", "술값은 **마신 사람끼리** 나누기", "송금은 6번 → **4번으로**"],
  },
  {
    file: "10-site-intro",
    tag: "무료 도구 모음",
    accent: "#2f6fed",
    title: ["회원가입 없이 쓰는", "무료 생활 도구 45가지"],
    points: ["연봉·퇴직금·대출 같은 **생활 계산**", "PDF·동영상 **변환과 압축**", "입력한 값은 **서버로 보내지 않아요**"],
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const mark = (s, c) => esc(s).replace(/\*\*([^*]+)\*\*/g, `<b style="color:${c}">$1</b>`);

function html(p) {
  const face = (w, f) =>
    `@font-face{font-family:P;font-weight:${w};src:url("${pathToFileURL(path.join(fontDir, f))}") format("woff2");}`;
  const titleSize = Math.max(...p.title.map((t) => t.length)) > 15 ? 66 : 80;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${face(500, "Pretendard-Medium.woff2")}${face(700, "Pretendard-Bold.woff2")}${face(800, "Pretendard-ExtraBold.woff2")}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1080px}
body{font-family:P,sans-serif;background:#f6f8fc;color:#141a2a;word-break:keep-all;position:relative;overflow:hidden}
.band{position:absolute;inset:0 0 auto 0;height:14px;background:${p.accent}}
.blob{position:absolute;right:-180px;top:-180px;width:560px;height:560px;border-radius:50%;background:${p.accent};opacity:.09}
.wrap{position:absolute;inset:90px 84px 84px 84px;display:flex;flex-direction:column}
.main{margin:auto 0;display:flex;flex-direction:column}
.tag{align-self:flex-start;font-weight:700;font-size:30px;color:#fff;background:${p.accent};padding:12px 28px;border-radius:999px}
h1{margin-top:44px;font-weight:800;font-size:${titleSize}px;line-height:1.22;letter-spacing:-0.03em}
.rule{width:96px;height:8px;border-radius:4px;background:${p.accent};margin:${p.points.length > 3 ? "36px 0 32px" : "44px 0 40px"}}
ul{list-style:none;display:flex;flex-direction:column;gap:${p.points.length > 3 ? 14 : 20}px}
li{display:flex;align-items:center;gap:24px;background:#fff;border:2px solid #e3e8f2;border-radius:20px;padding:${p.points.length > 3 ? "18px 28px" : "22px 28px"};font-weight:500;font-size:${p.points.length > 3 ? 32 : 35}px;line-height:1.3;letter-spacing:-0.02em}
li i{flex:none;font-style:normal;width:50px;height:50px;border-radius:50%;background:${p.accent};color:#fff;font-weight:800;font-size:27px;display:flex;align-items:center;justify-content:center}
li b{font-weight:800}
.foot{display:flex;justify-content:space-between;align-items:center;font-size:28px;color:#4a5468}
.foot b{font-weight:800;color:#141a2a;font-size:32px}
</style></head><body><div class="band"></div><div class="blob"></div><div class="wrap">
<div class="main"><div class="tag">${esc(p.tag)}</div>
<h1>${p.title.map(esc).join("<br>")}</h1>
<div class="rule"></div>
<ul>${p.points.map((t, i) => `<li><i>${i + 1}</i><span>${mark(t, p.accent)}</span></li>`).join("")}</ul></div>
<div class="foot"><span>무료 계산기 · 회원가입 없음</span><b>노바랩 공작소 · novalabs.co.kr</b></div>
</div></body></html>`;
}

if (!chrome) throw new Error("Chromium을 찾지 못했습니다. CHROME 환경 변수로 경로를 지정하세요.");
const tmp = mkdtempSync(path.join(tmpdir(), "thumb-"));
const only = process.argv.slice(2);
for (const p of POSTS.filter((p) => only.length === 0 || only.some((o) => p.file.startsWith(o)))) {
  const src = path.join(tmp, `${p.file}.html`);
  writeFileSync(src, html(p));
  const out = path.join(here, `${p.file}.png`);
  execFileSync(chrome, ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=1080,1080", "--virtual-time-budget=3000", `--screenshot=${out}`, pathToFileURL(src).href], { stdio: "ignore" });
  console.log(`→ ${path.relative(root, out)}`);
}
