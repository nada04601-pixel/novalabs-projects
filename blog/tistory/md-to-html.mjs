// 티스토리 원고(.md)를 HTML 모드용 .html로 바꿉니다. 01번 HTML과 같은 인라인 스타일을 씁니다.
// 사용법: node blog/tistory/md-to-html.mjs blog/tistory/02-resignation-money.md [...]
// 원고에 쓰인 문법만 다룹니다: ##/### 제목, 문단, 굵게, 링크, `코드`, 표, 목록(체크박스 포함), > 인용(공식),
// 👉 로 시작하는 문단(계산기 안내 상자), --- 뒤 "함께 보면 좋은 도구"(카드), ※ 문단(작은 안내문), HTML 주석.
import { readFileSync, writeFileSync } from "node:fs";

const BLUE = "#2f6fed";
const S = {
  h2: `margin:40px 0 16px; padding-bottom:8px; border-bottom:2px solid ${BLUE}; font-size:22px;`,
  h3: "margin:28px 0 12px; font-size:19px;",
  cta: `margin:20px 0; padding:16px 20px; background:#eef4ff; border-left:4px solid ${BLUE}; border-radius:6px; color:#1f2a44;`,
  ctaLink: "color:#1d4ed8; font-weight:bold;",
  quote: "margin:16px 0; padding:14px 20px; background:#f5f7fb; border:1px solid #d0d7e2; border-radius:6px; color:#1f2a44; font-weight:bold;",
  table: "width:100%; border-collapse:collapse; margin:16px 0; font-size:15px;",
  th: `padding:10px; border:1px solid ${BLUE}; text-align:left;`,
  td: "padding:10px; border:1px solid #d0d7e2;",
  code: "padding:1px 6px; background:#f0f2f6; border-radius:4px; color:#1f2a44; font-family:monospace;",
  card: "margin:40px 0 20px; padding:20px 24px; background:#f5f7fb; border:1px solid #d0d7e2; border-radius:10px; color:#1f2a44;",
  cardLink: "color:#1d4ed8;",
  note: "font-size:14px; color:#6b7280;",
};
const LINK_ATTR = 'target="_blank" rel="noopener"';

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inline(s, linkStyle = "") {
  const style = linkStyle ? ` style="${linkStyle}"` : "";
  return esc(s)
    .replace(/`([^`]+)`/g, `<code style="${S.code}">$1</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" ${LINK_ATTR}${style}>$1</a>`);
}

function convert(md) {
  const meta = md.match(/> \*\*올리기 정보\*\*\n((?:>.*\n)+)/)?.[1].replace(/^> - /gm, "").replace(/^>\s?/gm, "").trim() ?? "";
  const body = md.split("<!-- 본문 시작 -->")[1].split("<!-- 본문 끝 -->")[0].trim();
  const lines = body.split("\n");
  const out = [];
  let i = 0;
  let inCard = false;
  let cardLink = "";

  const isBlockStart = (l) => /^(#{2,3} |\||[-*] |\d+\. |> |---$|<!--)/.test(l) || l.trim() === "";

  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === "") { i++; continue; }

    if (l.startsWith("<!--")) { out.push(l); i++; continue; }

    if (l === "---") {
      inCard = true;
      cardLink = S.cardLink;
      out.push(`<div style="${S.card}">`);
      i++;
      continue;
    }

    if (l.startsWith("### ")) { out.push(`<h3 style="${S.h3}">${inline(l.slice(4))}</h3>`); i++; continue; }
    if (l.startsWith("## ")) { out.push(`<h2 style="${S.h2}">${inline(l.slice(3))}</h2>`); i++; continue; }

    if (l.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const [head, , ...rest] = rows;
      out.push(`<table style="${S.table}">`);
      out.push(`  <thead><tr style="background:${BLUE}; color:#ffffff;">${cells(head).map((c) => `<th style="${S.th}">${inline(c)}</th>`).join("")}</tr></thead>`);
      out.push("  <tbody>");
      for (const r of rest) out.push(`    <tr>${cells(r).map((c) => `<td style="${S.td}">${inline(c)}</td>`).join("")}</tr>`);
      out.push("  </tbody>\n</table>");
      continue;
    }

    if (/^([-*] |\d+\. )/.test(l)) {
      const ordered = /^\d+\. /.test(l);
      const items = [];
      while (i < lines.length && (ordered ? /^\d+\. / : /^[-*] /).test(lines[i])) {
        items.push(lines[i++].replace(/^([-*]|\d+\.) /, "").replace(/^\[ \] /, "☐ "));
      }
      const tag = ordered ? "ol" : "ul";
      const listStyle = inCard ? ' style="margin:0; padding-left:20px;"' : "";
      out.push(`<${tag}${listStyle}>`);
      for (const it of items) out.push(`  <li>${inline(it, cardLink)}</li>`);
      out.push(`</${tag}>`);
      continue;
    }

    if (l.startsWith("> ")) {
      const q = [];
      while (i < lines.length && lines[i].startsWith(">")) q.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<div style="${S.quote}">${q.map((x) => inline(x)).join("<br>")}</div>`);
      continue;
    }

    // 문단: 다음 블록이 시작될 때까지 이어진 줄을 모읍니다.
    const para = [];
    while (i < lines.length && (para.length === 0 || !isBlockStart(lines[i]))) para.push(lines[i++]);
    const text = para.join("\n");

    if (text.startsWith("※")) {
      if (inCard) { out.push("</div>"); inCard = false; cardLink = ""; }
      out.push(`<p style="${S.note}">${inline(text)}</p>`);
    } else if (text.startsWith("👉")) {
      out.push(`<div style="${S.cta}">\n  ${inline(text, S.ctaLink)}\n</div>`);
    } else if (inCard && text.startsWith("**")) {
      // "**함께 보면 좋은 도구** (부연)" → 카드 제목
      const m = text.match(/^\*\*([^*]+)\*\*\s*(.*)$/s);
      const sub = m[2] ? ` <span style="font-weight:normal; font-size:14px; color:#5b6478;">${inline(m[2])}</span>` : "";
      out.push(`<p style="margin:0 0 10px; font-weight:bold; font-size:17px;">${inline(m[1])}${sub}</p>`);
    } else {
      out.push(`<p>${inline(text, cardLink)}</p>`);
    }
  }
  if (inCard) out.push("</div>");

  const header = [
    `<!--`,
    `  티스토리 HTML 모드용 (원본: 같은 이름의 .md 파일, md-to-html.mjs로 생성)`,
    `  사용법: 글쓰기 → 오른쪽 위 '기본모드'를 'HTML'로 바꾼 뒤, 아래 <div>부터 끝까지 전부 붙여넣기`,
    ...meta.split("\n").map((m) => `  ${m.replace(/\*\*/g, "").replace(/--/g, "–")}`),
    `  스킨에 상관없이 모양이 유지되도록 <style> 없이 인라인 스타일만 썼습니다.`,
    `-->`,
  ].join("\n");
  return `${header}\n<div style="line-height:1.8; font-size:16px; word-break:keep-all;">\n\n${out.join("\n\n")}\n\n</div>\n`;
}

for (const file of process.argv.slice(2)) {
  const target = file.replace(/\.md$/, ".html");
  writeFileSync(target, convert(readFileSync(file, "utf8")));
  console.log(`${file} → ${target}`);
}
