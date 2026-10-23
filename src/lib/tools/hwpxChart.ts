// HWPX에 들어 있는 차트(Chart/chart1.xml, OOXML DrawingML 차트)를 SVG로 그립니다.
// 막대(세로·가로)·꺾은선·원형만 그리고, 그 밖의 차트는 값 표로 보여 줍니다. 값은 차트에 저장된 캐시(numCache·strCache)를 씁니다.
import { attr, children, desc, first, textOf } from "./xml";

type Series = { name: string; cats: string[]; vals: number[]; color?: string };
type Chart = { title: string; kind: "col" | "bar" | "line" | "pie" | "other"; series: Series[] };

const PALETTE = ["#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47", "#264478", "#9e480e", "#636363", "#997300"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function cache(el: Element | undefined): string[] {
  if (!el) return [];
  const cacheEl = desc(el, "strCache")[0] ?? desc(el, "numCache")[0];
  if (!cacheEl) return [];
  const out: string[] = [];
  for (const pt of children(cacheEl, "pt")) out[Number(attr(pt, "idx") ?? out.length)] = textOf(first(pt, "v"));
  return Array.from(out, (v) => v ?? "");
}

function seriesColor(ser: Element): string | undefined {
  const spPr = first(ser, "spPr");
  const fill = spPr && first(spPr, "solidFill");
  const rgb = fill && first(fill, "srgbClr");
  return rgb ? `#${attr(rgb, "val")}` : undefined;
}

export function parseChart(doc: Document): Chart {
  const root = doc.documentElement;
  const chart = desc(root, "chart")[0] ?? root;
  const titleEl = first(chart, "title");
  const title = titleEl ? desc(titleEl, "t").map(textOf).join("") : "";
  const plot = first(chart, "plotArea");
  const kinds: [string, Chart["kind"]][] = [["barChart", "col"], ["bar3DChart", "col"], ["lineChart", "line"], ["line3DChart", "line"], ["pieChart", "pie"], ["pie3DChart", "pie"], ["doughnutChart", "pie"]];
  for (const [tag, kind] of kinds) {
    const el = plot && first(plot, tag);
    if (!el) continue;
    const dir = attr(first(el, "barDir"), "val");
    const series = children(el, "ser").map((ser) => ({
      name: cache(first(ser, "tx")).join(" "),
      cats: cache(first(ser, "cat")),
      vals: cache(first(ser, "val")).map(Number),
      color: seriesColor(ser),
    }));
    return { title, kind: kind === "col" && dir === "bar" ? "bar" : kind, series };
  }
  return { title, kind: "other", series: [] };
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : String(+n.toFixed(2)));

export function chartSvg(c: Chart, w: number, h: number): string {
  const W = 600, H = Math.max(200, Math.round((600 * h) / Math.max(w, 1)));
  const color = (s: Series, i: number) => s.color ?? PALETTE[i % PALETTE.length];
  const parts: string[] = [];
  const titleH = c.title ? 34 : 8;
  if (c.title) parts.push(`<text x="${W / 2}" y="22" text-anchor="middle" font-size="16" font-weight="bold">${esc(c.title)}</text>`);
  const legendW = 120;
  const legend = (labels: string[], colors: string[]) =>
    labels.map((l, i) => `<rect x="${W - legendW + 4}" y="${titleH + 10 + i * 20}" width="10" height="10" fill="${colors[i]}"/><text x="${W - legendW + 18}" y="${titleH + 19 + i * 20}" font-size="12">${esc(l)}</text>`).join("");

  if (c.kind === "pie") {
    const s = c.series[0];
    const total = s.vals.reduce((a, b) => a + Math.max(0, b || 0), 0) || 1;
    const cx = (W - legendW) / 2, cy = titleH + (H - titleH) / 2, r = Math.min(cx, (H - titleH) / 2) - 10;
    let a0 = -Math.PI / 2;
    const colors = s.vals.map((_, i) => PALETTE[i % PALETTE.length]);
    s.vals.forEach((v, i) => {
      const a1 = a0 + (Math.max(0, v || 0) / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      parts.push(`<path d="M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z" fill="${colors[i]}" stroke="#fff"/>`);
      a0 = a1;
    });
    parts.push(legend(s.cats.length ? s.cats : s.vals.map((_, i) => String(i + 1)), colors));
  } else {
    const cats = c.series[0]?.cats ?? [];
    const n = Math.max(cats.length, ...c.series.map((s) => s.vals.length));
    const max = niceMax(Math.max(0, ...c.series.flatMap((s) => s.vals.filter(Number.isFinite))));
    const left = 60, right = W - legendW - 10, top = titleH + 10, bottom = H - 30;
    const horiz = c.kind === "bar";
    const ticks = 5;
    for (let k = 0; k <= ticks; k++) {
      const v = (max * k) / ticks;
      if (horiz) {
        const x = left + ((right - left) * k) / ticks;
        parts.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="#ddd"/><text x="${x}" y="${bottom + 16}" font-size="11" text-anchor="middle">${fmt(v)}</text>`);
      } else {
        const y = bottom - ((bottom - top) * k) / ticks;
        parts.push(`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#ddd"/><text x="${left - 6}" y="${y + 4}" font-size="11" text-anchor="end">${fmt(v)}</text>`);
      }
    }
    parts.push(`<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#000"/><line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="#000"/>`);
    const span = ((horiz ? bottom - top : right - left) / Math.max(n, 1));
    for (let i = 0; i < n; i++) {
      const label = esc(cats[i] ?? String(i + 1));
      if (horiz) parts.push(`<text x="${left - 6}" y="${top + span * (i + 0.5) + 4}" font-size="12" text-anchor="end">${label}</text>`);
      else parts.push(`<text x="${left + span * (i + 0.5)}" y="${bottom + 18}" font-size="12" text-anchor="middle">${label}</text>`);
    }
    if (c.kind === "line") {
      c.series.forEach((s, si) => {
        const pts = s.vals.map((v, i) => `${left + span * (i + 0.5)},${bottom - ((bottom - top) * (v || 0)) / max}`).join(" ");
        parts.push(`<polyline points="${pts}" fill="none" stroke="${color(s, si)}" stroke-width="2"/>`);
      });
    } else {
      const k = Math.max(c.series.length, 1);
      const bw = (span * 0.7) / k;
      c.series.forEach((s, si) => s.vals.forEach((v, i) => {
        const len = ((horiz ? right - left : bottom - top) * Math.max(0, v || 0)) / max;
        const off = span * (i + 0.15) + bw * si;
        parts.push(horiz
          ? `<rect x="${left}" y="${top + off}" width="${len}" height="${bw}" fill="${color(s, si)}"/>`
          : `<rect x="${left + off}" y="${bottom - len}" width="${bw}" height="${len}" fill="${color(s, si)}"/>`);
      }));
    }
    parts.push(legend(c.series.map((s) => s.name), c.series.map(color)));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" font-family="sans-serif">${parts.join("")}</svg>`;
}

// 그릴 수 없는 차트는 값 표로
export function chartTable(c: Chart): string {
  if (!c.series.length) return `<div class="obj-ph">차트${c.title ? `: ${esc(c.title)}` : ""}</div>`;
  const cats = c.series[0].cats;
  const head = `<tr><th></th>${c.series.map((s) => `<th>${esc(s.name)}</th>`).join("")}</tr>`;
  const rows = cats.map((cat, i) => `<tr><th>${esc(cat)}</th>${c.series.map((s) => `<td>${fmt(s.vals[i])}</td>`).join("")}</tr>`).join("");
  return `<table class="chart-tbl"><caption>${esc(c.title)}</caption>${head}${rows}</table>`;
}

export function chartHtml(doc: Document, w: number, h: number): string {
  const c = parseChart(doc);
  return c.kind === "other" || !c.series.length ? chartTable(c) : chartSvg(c, w, h);
}
