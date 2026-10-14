// 티스토리 대표 이미지(1200×750 PNG)를 만듭니다. 글자는 사이트와 같은 Pretendard 글꼴을 씁니다.
// 사용법: node blog/tistory/thumbnails/make-thumbnails.mjs   (npm install 후, Chromium 필요)
// 내용을 고치려면 아래 POSTS를 고친 뒤 다시 실행하세요. CHROME 환경 변수로 Chromium 경로를 바꿀 수 있습니다.
// 일반 Chrome의 headless 모드는 화면 높이가 창보다 작게 잡혀 아래가 비므로 chrome-headless-shell을 먼저 씁니다.
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
  ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"].find(existsSync);

// accent: 글마다 다른 강조색. hook(후킹 문구 두 줄)의 **굵게**는 강조색으로 칠합니다.
const POSTS = [
  {
    file: "01-year-end-tax",
    tag: "연말정산",
    accent: "#2f6fed",
    title: ["연말정산,", "10월부터 바꿀 수 있는 3가지"],
    hook: ["아는 사람만 돌려받는", "**13월의 월급**"],
  },
  {
    file: "02-resignation-money",
    tag: "퇴사·이직",
    accent: "#0f9d76",
    title: ["퇴사 전에", "꼭 계산해 볼 돈 4가지"],
    hook: ["단 하루 차이로", "퇴직금이 **0원**이 될 수도"],
  },
  {
    file: "03-part-time-paycheck",
    tag: "알바 월급",
    accent: "#e8590c",
    title: ["2026 최저시급 10,320원", "알바 월급 직접 계산하기"],
    hook: ["딱 1시간 더 일했을 뿐인데", "주휴수당 **월 13만 원**"],
  },
  {
    file: "04-browser-pdf-video",
    tag: "PDF·동영상",
    accent: "#7048e8",
    title: ["설치 없이", "PDF·동영상 정리하기"],
    hook: ["아직도 프로그램 깔고 계세요?", "**브라우저면 충분합니다**"],
  },
  {
    file: "05-loan-savings",
    tag: "대출·적금",
    accent: "#1c7ed6",
    title: ["1억 대출, 상환 방식만 바꿔도", "이자 1,000만 원 넘게 차이"],
    hook: ["같은 1억, 같은 금리인데", "이자가 **2배**"],
  },
  {
    file: "06-work-time-tools",
    tag: "시간 관리",
    accent: "#c2255c",
    title: ["회의·하루·마감까지", "시간 나누는 5가지 방법"],
    hook: ["계획이 무너지는 건", "**의지 탓이 아닙니다**"],
  },
  {
    file: "07-moving-rent",
    tag: "이사·전월세",
    accent: "#2b8a3e",
    title: ["전월세 계약 전에", "계산해 볼 4가지"],
    hook: ["복비, 부르는 대로", "**다 내셨나요?**"],
  },
  {
    file: "08-college-semester",
    tag: "대학생활",
    accent: "#f08c00",
    title: ["기말고사 몇 점 받아야", "A가 나올까?"],
    hook: ["중간고사 망쳤어도", "**아직 늦지 않았습니다**"],
  },
  {
    file: "09-year-end-party",
    tag: "송년회 정산",
    accent: "#d6336c",
    title: ["송년회 N빵,", "공평하게 나누는 법"],
    hook: ["\"나 2차 안 갔는데?\"", "**이 말 나오기 전에**"],
  },
  {
    file: "10-site-intro",
    tag: "무료 도구 모음",
    accent: "#2f6fed",
    title: ["회원가입 없이 쓰는", "무료 생활 도구 45가지"],
    hook: ["매번 검색하던 그 계산,", "**이제 한곳에서**"],
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const mark = (s, c) => esc(s).replace(/\*\*([^*]+)\*\*/g, `<b style="color:${c}">$1</b>`);

const W = 1200;
const H = 750; // 16:10. 티스토리 목록 카드(약 1.6:1)에 맞춘 가로형

// 목록 카드에서는 이미지가 작게 보이므로 주제 태그와 후킹 문구만 크게 넣습니다(글 제목은 카드 아래에 따로 표시됨).
// 글자 크기는 가장 긴 줄이 안전 영역 너비에 맞을 때까지 줄여서 정합니다.
function html(p) {
  const face = (w, f) =>
    `@font-face{font-family:P;font-weight:${w};src:url("${pathToFileURL(path.join(fontDir, f))}") format("woff2");}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${face(700, "Pretendard-Bold.woff2")}${face(800, "Pretendard-ExtraBold.woff2")}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px}
body{font-family:P,sans-serif;background:#f6f8fc;color:#141a2a;word-break:keep-all;position:relative;overflow:hidden}
.band{position:absolute;inset:0 auto 0 0;width:18px;background:${p.accent}}
.blob{position:absolute;right:-140px;bottom:-200px;width:520px;height:520px;border-radius:50%;background:${p.accent};opacity:.1}
.wrap{position:absolute;inset:60px 100px;display:flex;flex-direction:column;justify-content:center}
.tag{align-self:flex-start;font-weight:800;font-size:40px;color:#fff;background:${p.accent};padding:12px 32px;border-radius:999px;margin-bottom:40px}
.hook{font-weight:800;font-size:130px;line-height:1.24;letter-spacing:-0.035em;color:#141a2a;white-space:nowrap}
.hook b{color:${p.accent}}
</style></head><body><div class="band"></div><div class="blob"></div><div class="wrap">
<div class="tag">${esc(p.tag)}</div>
<div class="hook">${p.hook.map((t) => `<div>${mark(t, p.accent)}</div>`).join("")}</div>
</div><script>
const h = document.querySelector(".hook"), max = h.parentElement.clientWidth;
document.fonts.ready.then(() => {
  let size = 130;
  while (size > 40 && [...h.children].some((l) => l.scrollWidth > max)) h.style.fontSize = (size -= 2) + "px";
  [...h.children].forEach((l) => (l.style.display = "block"));
});
</script></body></html>`;
}

if (!chrome) throw new Error("Chromium을 찾지 못했습니다. CHROME 환경 변수로 경로를 지정하세요.");
const tmp = mkdtempSync(path.join(tmpdir(), "thumb-"));
const only = process.argv.slice(2);
for (const p of POSTS.filter((p) => only.length === 0 || only.some((o) => p.file.startsWith(o)))) {
  const src = path.join(tmp, `${p.file}.html`);
  writeFileSync(src, html(p));
  const out = path.join(here, `${p.file}.png`);
  execFileSync(chrome, ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--window-size=${W},${H}`, "--virtual-time-budget=3000", `--screenshot=${out}`, pathToFileURL(src).href], { stdio: "ignore" });
  console.log(`→ ${path.relative(root, out)}`);
}
