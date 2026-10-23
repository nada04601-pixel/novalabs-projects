// HWPX(한글 2014 이후의 OWPML, ZIP 안에 XML)를 HTML 한 파일로 바꿉니다. 브라우저 안에서만 돌며 문서는 밖으로 나가지 않습니다.
// 문단·글자 모양, 문단 번호·글머리표, 표(셀 합치기·테두리·배경·대각선), 그림(자르기 포함), 도형·글상자, 글맵시, 수식, 차트,
// 각주·미주, 머리말·꼬리말, 덧말, 하이퍼링크를 옮깁니다. 쪽 나누기는 문서의 '쪽 나누기'와 구역에서만 하고 줄 배치는 브라우저에 맡깁니다.
// 단위: HWPUNIT = 1/7200인치(1pt = 100), 글자 크기 height 1000 = 10pt.
import { unzip, ZipError } from "./unzip";
import { attr, children, desc, first, localName, num, parseXml, textOf } from "./xml";
import { EQUATION_CSS, equationHtml } from "./hwpxEquation";
import { chartHtml } from "./hwpxChart";

export class HwpxError extends Error {
  constructor(public code: "notHwpx" | "encrypted" | "broken", message: string) {
    super(message);
  }
}

const mm = (hu: number) => +((hu * 25.4) / 7200).toFixed(2);
const pt = (hu: number) => +(hu / 100).toFixed(2);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => esc(s).replace(/"/g, "&quot;");
const NONE_ID = "4294967295";
// 문서에서 온 글꼴 이름을 CSS에 넣기 전에 따옴표·괄호 등을 지웁니다(스타일 밖으로 빠져나가지 않게).
const fontName = (s: string) => s.replace(/["'<>\\;{}()]/g, "").trim();

const color = (c: string | undefined): string | undefined => {
  if (!c || c === "none") return undefined;
  // #AARRGGBB(알파 포함)는 뒤 6자리만 씁니다
  const m = /^#?([0-9a-f]{2})?([0-9a-f]{6})$/i.exec(c);
  return m ? `#${m[2]}` : undefined;
};

// ---------------------------------------------------------------------------
// 번호 모양
// ---------------------------------------------------------------------------

const HANGUL_SYL = "가나다라마바사아자차카타파하";
const HANGUL_JAMO = "ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ";
const IDEO = "一二三四五六七八九十";
const HANGUL_NUM = ["일", "이", "삼", "사", "오", "육", "칠", "팔", "구", "십"];

function roman(n: number): string {
  const map: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

const cycle = (chars: string, n: number) => chars[(n - 1) % chars.length];

export function formatNumber(n: number, f = "DIGIT"): string {
  if (n < 1) return String(n);
  switch (f) {
    case "CIRCLED_DIGIT": return n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : String(n);
    case "ROMAN_CAPITAL": return roman(n);
    case "ROMAN_SMALL": return roman(n).toLowerCase();
    case "LATIN_CAPITAL": return String.fromCharCode(65 + ((n - 1) % 26));
    case "LATIN_SMALL": return String.fromCharCode(97 + ((n - 1) % 26));
    case "CIRCLED_LATIN_CAPITAL": return String.fromCodePoint(0x24b6 + ((n - 1) % 26));
    case "CIRCLED_LATIN_SMALL": return String.fromCodePoint(0x24d0 + ((n - 1) % 26));
    case "HANGUL_SYLLABLE": return cycle(HANGUL_SYL, n);
    case "CIRCLED_HANGUL_SYLLABLE": return String.fromCodePoint(0x326e + ((n - 1) % 14));
    case "HANGUL_JAMO": return cycle(HANGUL_JAMO, n);
    case "CIRCLED_HANGUL_JAMO": return String.fromCodePoint(0x3260 + ((n - 1) % 14));
    case "HANGUL_PHONETIC": return n <= 10 ? HANGUL_NUM[n - 1] : String(n);
    case "IDEOGRAPH": return n <= 10 ? IDEO[n - 1] : String(n);
    case "CIRCLED_IDEOGRAPH": return n <= 10 ? String.fromCodePoint(0x3280 + n - 1) : String(n);
    default: return String(n);
  }
}

// ---------------------------------------------------------------------------
// header.xml: 글꼴·글자 모양·문단 모양·테두리/배경·번호
// ---------------------------------------------------------------------------

type ParaHead = { start: number; fmt: string; text: string; charPr?: string };
type Heading = { type: string; idRef: string; level: number };

const BORDER: Record<string, string> = {
  SOLID: "solid", DASH: "dashed", DOT: "dotted", DASH_DOT: "dashed", DASH_DOT_DOT: "dashed", LONG_DASH: "dashed",
  CIRCLE: "dotted", DOUBLE_SLIM: "double", SLIM_THICK: "double", THICK_SLIM: "double", SLIM_THICK_SLIM: "double",
  WAVE: "solid", DOUBLE_WAVE: "double", THICK_3D: "ridge", THICK_3D_REVERS: "groove", "3D": "ridge", "3D_REVERS": "groove",
};
const SERIF = /바탕|명조|궁서|batang|myeongjo|gungsuh|serif|times|georgia|garamond/i;

// <hp:switch>가 있으면 <hp:case>(없으면 <hp:default>) 안에서 찾습니다(문단 여백·줄 간격이 이렇게 들어 있음).
function pick(el: Element, name: string): Element | undefined {
  const direct = first(el, name);
  if (direct) return direct;
  for (const sw of children(el, "switch")) {
    for (const branch of [...children(sw, "case"), ...children(sw, "default")]) {
      const found = first(branch, name);
      if (found) return found;
    }
  }
  return undefined;
}

type Binary = (id: string) => string | undefined; // binaryItemIDRef → data URI

class Header {
  fonts = new Map<string, string[]>(); // 언어(HANGUL·LATIN…) → 글꼴 이름(id 순서)
  charPr = new Map<string, Element>();
  paraPr = new Map<string, Element>();
  borderFill = new Map<string, Element>();
  numberings = new Map<string, ParaHead[]>();
  bullets = new Map<string, string>();
  css: string[] = [];

  constructor(doc: Document, private binary: Binary) {
    const root = doc.documentElement;
    for (const ff of desc(root, "fontface")) {
      const faces: string[] = [];
      for (const f of children(ff, "font")) faces[num(f, "id")] = attr(f, "face") ?? "";
      this.fonts.set(attr(ff, "lang") ?? "", faces);
    }
    for (const el of desc(root, "charPr")) this.charPr.set(attr(el, "id") ?? "", el);
    for (const el of desc(root, "paraPr")) this.paraPr.set(attr(el, "id") ?? "", el);
    for (const el of desc(root, "borderFill")) this.borderFill.set(attr(el, "id") ?? "", el);
    for (const el of desc(root, "numbering")) {
      const heads: ParaHead[] = [];
      for (const h of children(el, "paraHead")) {
        const ref = attr(h, "charPrIDRef");
        heads[num(h, "level", 1) - 1] = { start: num(h, "start", 1), fmt: attr(h, "numFormat") ?? "DIGIT", text: textOf(h), charPr: ref && ref !== NONE_ID ? ref : undefined };
      }
      this.numberings.set(attr(el, "id") ?? "", heads);
    }
    for (const el of desc(root, "bullet")) this.bullets.set(attr(el, "id") ?? "", attr(el, "char") ?? "•");

    for (const [id, el] of this.charPr) this.css.push(`.c${id}{${this.charCss(el)}}`);
    for (const [id, el] of this.paraPr) this.css.push(`.p${id}{${this.paraCss(el)}}`);
    for (const [id, el] of this.borderFill) this.css.push(`.b${id}{${this.fillCss(el, true)}}`);
  }

  fontFamily(fontRef: Element | undefined): string {
    if (!fontRef) return "";
    const face = (lang: string, key: string) => this.fonts.get(lang)?.[num(fontRef, key)];
    const names = [face("LATIN", "latin"), face("HANGUL", "hangul")].filter((f): f is string => !!f);
    if (!names.length) return "";
    const generic = SERIF.test(names[names.length - 1]) ? "serif" : "sans-serif";
    return `font-family:${[...new Set(names)].map((n) => `'${fontName(n)}'`).join(",")},${generic};`;
  }

  charCss(el: Element): string {
    let css = "";
    const relSz = num(first(el, "relSz"), "hangul", 100);
    css += `font-size:${pt((num(el, "height", 1000) * relSz) / 100)}pt;`;
    css += this.fontFamily(first(el, "fontRef"));
    const fg = color(attr(el, "textColor"));
    if (fg && fg !== "#000000") css += `color:${fg};`;
    const shade = color(attr(el, "shadeColor"));
    if (shade && shade.toUpperCase() !== "#FFFFFF") css += `background-color:${shade};`;
    if (first(el, "bold")) css += "font-weight:bold;";
    if (first(el, "italic")) css += "font-style:italic;";
    const deco: string[] = [];
    const ul = first(el, "underline");
    const ulType = attr(ul, "type") ?? "NONE";
    if (ulType === "BOTTOM" || ulType === "CENTER") deco.push(ulType === "CENTER" ? "line-through" : "underline");
    if (ulType === "TOP") deco.push("overline");
    const so = first(el, "strikeout");
    if (so && (attr(so, "shape") ?? "NONE") !== "NONE") deco.push("line-through");
    if (deco.length) {
      css += `text-decoration:${[...new Set(deco)].join(" ")};`;
      const dc = color(attr(ul, "color"));
      if (dc && dc !== "#000000" && ulType !== "NONE") css += `text-decoration-color:${dc};`;
    }
    if (first(el, "supscript")) css += "vertical-align:super;font-size:smaller;";
    if (first(el, "subscript")) css += "vertical-align:sub;font-size:smaller;";
    const spacing = num(first(el, "spacing"), "hangul");
    if (spacing) css += `letter-spacing:${spacing / 100}em;`;
    const offset = num(first(el, "offset"), "hangul");
    if (offset) css += `position:relative;top:${-offset / 100}em;`;
    const sh = first(el, "shadow");
    if (sh && (attr(sh, "type") ?? "NONE") !== "NONE") css += `text-shadow:${num(sh, "offsetX") / 100}em ${num(sh, "offsetY") / 100}em 0 ${color(attr(sh, "color")) ?? "#b2b2b2"};`;
    if (first(el, "outline") && (attr(first(el, "outline"), "type") ?? "NONE") !== "NONE") css += "-webkit-text-stroke:.03em currentColor;";
    if (first(el, "emboss") || first(el, "engrave")) css += "text-shadow:1px 1px 0 #999;";
    const sym = attr(el, "symMark") ?? "NONE";
    if (sym !== "NONE") css += `text-emphasis:${/CIRCLE/.test(sym) ? "open circle" : /TILDE/.test(sym) ? '"~"' : /CARON|V/.test(sym) ? '"ˇ"' : "filled dot"};text-emphasis-position:over;`;
    return css;
  }

  paraCss(el: Element): string {
    let css = "";
    const align = attr(first(el, "align"), "horizontal") ?? "JUSTIFY";
    const ta: Record<string, string> = { JUSTIFY: "justify", LEFT: "left", RIGHT: "right", CENTER: "center", DISTRIBUTE: "justify", DISTRIBUTE_SPACE: "justify" };
    css += `text-align:${ta[align] ?? "justify"};`;
    if (align.startsWith("DISTRIBUTE")) css += "text-align-last:justify;";
    const margin = pick(el, "margin");
    if (margin) {
      const v = (n: string) => num(first(margin, n), "value");
      const indent = v("intent"), left = v("left");
      if (indent < 0) css += `padding-left:${pt(left - indent)}pt;text-indent:${pt(indent)}pt;`;
      else {
        if (left) css += `padding-left:${pt(left)}pt;`;
        if (indent) css += `text-indent:${pt(indent)}pt;`;
      }
      if (v("right")) css += `padding-right:${pt(v("right"))}pt;`;
      if (v("prev")) css += `margin-top:${pt(v("prev"))}pt;`;
      if (v("next")) css += `margin-bottom:${pt(v("next"))}pt;`;
    }
    const ls = pick(el, "lineSpacing");
    if (ls) {
      const type = attr(ls, "type") ?? "PERCENT", value = num(ls, "value", 160);
      if (type === "PERCENT") css += `line-height:${value / 100};`;
      else if (type === "FIXED" || type === "AT_LEAST") css += `line-height:${pt(value)}pt;`;
      else if (type === "BETWEEN_LINES") css += `line-height:calc(1em + ${pt(value)}pt);`;
    }
    const brk = first(el, "breakSetting");
    if ((attr(brk, "breakNonLatinWord") ?? "KEEP_WORD") === "KEEP_WORD") css += "word-break:keep-all;";
    const border = first(el, "border");
    const bf = border && this.borderFill.get(attr(border, "borderFillIDRef") ?? "");
    if (bf) {
      const fill = this.fillCss(bf, false);
      if (fill) css += fill + `padding:${pt(num(border, "offsetTop"))}pt ${pt(num(border, "offsetRight"))}pt ${pt(num(border, "offsetBottom"))}pt ${pt(num(border, "offsetLeft"))}pt;`;
    }
    return css;
  }

  heading(paraPrId: string): Heading | undefined {
    const h = first(this.paraPr.get(paraPrId), "heading");
    const type = attr(h, "type") ?? "NONE";
    return type === "NONE" ? undefined : { type, idRef: attr(h, "idRef") ?? "0", level: num(h, "level") };
  }

  // 테두리/배경. cell이면 대각선도 그립니다.
  fillCss(el: Element, cell: boolean): string {
    let css = "";
    for (const side of ["left", "right", "top", "bottom"]) {
      const b = first(el, `${side}Border`);
      const type = attr(b, "type") ?? "NONE";
      if (!b || type === "NONE") { if (cell) css += `border-${side}:none;`; continue; }
      const style = BORDER[type] ?? "solid";
      let w = parseFloat(attr(b, "width") ?? "0.1") || 0.1;
      if (style === "double") w = Math.max(w, 0.8);
      css += `border-${side}:${w}mm ${style} ${color(attr(b, "color")) ?? "#000"};`;
    }
    const brush = first(el, "fillBrush");
    const bg: string[] = [];
    if (brush) {
      const win = first(brush, "winBrush");
      const face = color(attr(win, "faceColor"));
      if (face) css += `background-color:${face};`;
      const grad = first(brush, "gradation");
      if (grad) {
        const colors = children(grad, "color").map((c) => color(attr(c, "value"))).filter(Boolean);
        if (colors.length > 1) {
          const type = attr(grad, "type") ?? "LINEAR";
          bg.push(type === "RADIAL" || type === "CONICAL" ? `radial-gradient(${colors.join(",")})` : `linear-gradient(${(num(grad, "angle") + 90) % 360}deg,${colors.join(",")})`);
        }
      }
      const imgBrush = first(brush, "imgBrush");
      const img = imgBrush && first(imgBrush, "img");
      const uri = img && this.binary(attr(img, "binaryItemIDRef") ?? "");
      if (uri) bg.push(`url("${uri}")`);
    }
    if (cell) {
      const diag = first(el, "diagonal");
      const stroke = `stroke="${color(attr(diag, "color")) ?? "#000"}" stroke-width="${Math.max(1, (parseFloat(attr(diag, "width") ?? "0.1") || 0.1) * 3.78)}" vector-effect="non-scaling-stroke"`;
      const lines: string[] = [];
      if ((attr(first(el, "slash"), "type") ?? "NONE") !== "NONE") lines.push(`<line x1="0" y1="100" x2="100" y2="0" ${stroke}/>`);
      if ((attr(first(el, "backSlash"), "type") ?? "NONE") !== "NONE") lines.push(`<line x1="0" y1="0" x2="100" y2="100" ${stroke}/>`);
      if (lines.length) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${lines.join("")}</svg>`;
        bg.unshift(`url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
      }
    }
    if (bg.length) css += `background-image:${bg.join(",")};background-size:${bg.map((b) => (b.startsWith("url(\"data:image/svg") ? "100% 100%" : "cover")).join(",")};background-repeat:no-repeat;`;
    return css;
  }

}

// ---------------------------------------------------------------------------
// 본문
// ---------------------------------------------------------------------------

type Page = { body: string[]; layer: string[]; notes: string[] };
type SectionInfo = { width: number; height: number; left: number; right: number; top: number; bottom: number; header: number; footer: number; outline: string };

type Geometry = { w: number; h: number }; // HWPUNIT

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", svg: "image/svg+xml", webp: "image/webp", tif: "image/tiff", tiff: "image/tiff" };

function base64(data: Uint8Array): string {
  let s = "";
  for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode(...data.subarray(i, i + 0x8000));
  return btoa(s);
}

class Renderer {
  pages: Page[] = [];
  page!: Page;
  sec!: SectionInfo;
  headerHtml = "";
  footerHtml = "";
  endnotes: string[] = [];
  noteCount = 0;
  numState = new Map<string, number[]>();
  autoNums = new Map<string, number>();
  link: string | null = null;
  linkIds = new Set<string>();
  markpen: string | null = null;
  out: string[] = [];

  constructor(private head: Header, private files: Map<string, Uint8Array>, private binary: Binary) {}

  // ---- 구역·쪽 -------------------------------------------------------------

  section(doc: Document) {
    const root = doc.documentElement;
    const secPr = desc(root, "secPr")[0];
    const pagePr = first(secPr, "pagePr");
    const margin = first(pagePr, "margin");
    let width = num(pagePr, "width", 59528), height = num(pagePr, "height", 84186);
    if (attr(pagePr, "landscape") === "NARROWLY" && width < height) [width, height] = [height, width];
    this.sec = {
      width, height,
      left: num(margin, "left", 8504), right: num(margin, "right", 8504), top: num(margin, "top", 5668), bottom: num(margin, "bottom", 4252),
      header: num(margin, "header", 4252), footer: num(margin, "footer", 4252),
      outline: attr(secPr, "outlineShapeIDRef") ?? "1",
    };
    this.headerHtml = this.footerHtml = "";
    this.pages = [];
    this.newPage();
    for (const p of children(root, "p")) {
      if (attr(p, "pageBreak") === "1" && this.page.body.length) this.newPage();
      this.page.body.push(this.paragraph(p));
    }
    const s = this.sec;
    const style = `width:${mm(s.width)}mm;min-height:${mm(s.height)}mm;padding:${mm(s.top + s.header)}mm ${mm(s.right)}mm ${mm(s.bottom + s.footer)}mm ${mm(s.left)}mm`;
    for (const pg of this.pages) {
      const hd = this.headerHtml ? `<div class="hdr" style="top:${mm(s.header)}mm;left:${mm(s.left)}mm;right:${mm(s.right)}mm">${this.headerHtml}</div>` : "";
      const ft = this.footerHtml ? `<div class="ftr" style="bottom:${mm(s.footer)}mm;left:${mm(s.left)}mm;right:${mm(s.right)}mm">${this.footerHtml}</div>` : "";
      const notes = pg.notes.length ? `<div class="notes">${pg.notes.join("")}</div>` : "";
      this.out.push(`<div class="page" style="${style}">${hd}${pg.body.join("")}${notes}${pg.layer.join("")}${ft}</div>`);
    }
  }

  newPage() {
    this.page = { body: [], layer: [], notes: [] };
    this.pages.push(this.page);
  }

  // ---- 문단 -----------------------------------------------------------------

  paragraphs(container: Element | undefined): string {
    return children(container, "p").map((p) => this.paragraph(p)).join("");
  }

  paragraph(p: Element): string {
    const paraPr = attr(p, "paraPrIDRef") ?? "0";
    const parts: string[] = [];
    let hasText = false;
    let lastChar = "0";
    for (const run of children(p, "run")) {
      const cp = attr(run, "charPrIDRef") ?? "0";
      lastChar = cp;
      for (const el of children(run)) {
        const r = this.runItem(el, cp);
        if (r.text) hasText = true;
        if (r.html) parts.push(r.html);
      }
    }
    const prefix = this.numberPrefix(paraPr, lastChar);
    if (!hasText && !prefix) parts.push(`<span class="c${lastChar}">​</span>`);
    return `<div class="p p${paraPr}">${prefix}${parts.join("")}</div>`;
  }

  numberPrefix(paraPrId: string, charPr: string): string {
    const h = this.head.heading(paraPrId);
    if (!h) return "";
    if (h.type === "BULLET") return `<span class="c${charPr}">${esc(this.head.bullets.get(h.idRef) ?? "•")} </span>`;
    const id = h.type === "OUTLINE" ? this.sec.outline : h.idRef;
    const heads = this.head.numberings.get(id);
    const level = h.level;
    const ph = heads?.[level];
    if (!heads || !ph) return "";
    const state = this.numState.get(id) ?? [];
    state[level] = (state[level] ?? ph.start - 1) + 1;
    state.length = level + 1; // 아래 수준은 다시 처음부터
    this.numState.set(id, state);
    const text = ph.text.replace(/\^(\d+)/g, (_, k) => {
      const i = Number(k) - 1;
      return formatNumber(state[i] ?? heads[i]?.start ?? 1, heads[i]?.fmt);
    });
    if (!text) return "";
    return `<span class="c${ph.charPr ?? charPr}">${esc(text)} </span>`;
  }

  // 글자 덩어리를 링크·형광펜 상태에 맞춰 감쌉니다(태그가 엇갈리지 않도록 덩어리마다 따로 감쌈).
  wrap(html: string): string {
    if (this.markpen) html = `<mark style="background:${this.markpen}">${html}</mark>`;
    if (this.link) html = `<a href="${escAttr(this.link)}">${html}</a>`;
    return html;
  }

  runItem(el: Element, cp: string): { html: string; text?: boolean } {
    const name = localName(el);
    switch (name) {
      case "t": {
        const html = this.text(el);
        return { html: html ? `<span class="c${cp}">${html}</span>` : "", text: !!html };
      }
      case "ctrl":
        return { html: children(el).map((c) => this.control(c, cp)).join("") };
      case "secPr":
      case "linesegarray":
        return { html: "" };
      case "switch": {
        const branch = children(el, "case")[0] ?? first(el, "default");
        const out = children(branch).map((c) => this.runItem(c, cp));
        return { html: out.map((o) => o.html).join(""), text: out.some((o) => o.text) };
      }
      case "dutmal": {
        const pos = attr(el, "posType") === "BOTTOM" ? ' style="ruby-position:under"' : "";
        return { html: `<span class="c${cp}">${this.wrap(`<ruby${pos}>${esc(textOf(first(el, "mainText")))}<rt>${esc(textOf(first(el, "subText")))}</rt></ruby>`)}</span>`, text: true };
      }
      case "compose":
        return { html: `<span class="c${cp}">${this.wrap(esc(attr(el, "composeText") ?? ""))}</span>`, text: true };
      case "equation":
        return { html: this.equation(el), text: true };
      default:
        return { html: this.object(el) };
    }
  }

  text(t: Element): string {
    let out = "";
    for (let n = t.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { if (n.nodeValue) out += this.wrap(esc(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      const el = n as Element;
      switch (localName(el)) {
        case "tab": {
          const leader = num(el, "leader") ? "border-bottom:1px dotted;" : "";
          out += `<span class="tab" style="width:${pt(num(el, "width", 4000))}pt;${leader}"></span>`;
          break;
        }
        case "lineBreak": out += "<br>"; break;
        case "nbSpace": out += "&nbsp;"; break;
        case "fwSpace": out += "　"; break;
        case "hyphen": out += "-"; break;
        case "markpenBegin": this.markpen = color(attr(el, "color")) ?? "#ffff00"; break;
        case "markpenEnd": this.markpen = null; break;
        default: break; // titleMark, 변경 추적 표시 등
      }
    }
    return out;
  }

  control(el: Element, cp: string): string {
    switch (localName(el)) {
      case "header":
      case "footer": {
        const html = this.paragraphs(first(el, "subList"));
        if (localName(el) === "header") this.headerHtml = html;
        else this.footerHtml = html;
        return "";
      }
      case "footNote":
      case "endNote": {
        const n = ++this.noteCount;
        const inner = desc(el, "autoNum")[0];
        const label = this.autoNumLabel(inner, num(el, "number", n));
        const body = this.paragraphs(first(el, "subList"));
        const note = `<div class="note" id="note${n}">${body}</div>`;
        if (localName(el) === "footNote") this.page.notes.push(note);
        else this.endnotes.push(note);
        return `<sup class="note-ref c${cp}"><a href="#note${n}">${esc(label)}</a></sup>`;
      }
      case "autoNum": {
        const type = attr(el, "numType") ?? "PAGE";
        const n = type === "FOOTNOTE" || type === "ENDNOTE" ? num(el, "num", 1) : (this.autoNums.get(type) ?? 0) + 1;
        if (type !== "FOOTNOTE" && type !== "ENDNOTE") this.autoNums.set(type, n);
        return `<span class="c${cp}">${esc(this.autoNumLabel(el, n))}</span>`;
      }
      case "fieldBegin": {
        if (attr(el, "type") !== "HYPERLINK") return "";
        const cmd = desc(el, "stringParam").find((s) => attr(s, "name") === "Command");
        const url = textOf(cmd).replace(/\\(.)/g, "$1").split(";")[0];
        if (/^(https?:|mailto:|ftp:)/i.test(url)) {
          this.link = url;
          this.linkIds.add(attr(el, "id") ?? "");
        }
        return "";
      }
      case "fieldEnd":
        if (this.linkIds.has(attr(el, "beginIDRef") ?? "") || this.link) { this.link = null; this.linkIds.clear(); }
        return "";
      default:
        return ""; // 단 정의, 쪽 번호, 책갈피, 숨김 등은 HTML에서 의미가 없음
    }
  }

  autoNumLabel(el: Element | undefined, n: number): string {
    const fmt = el && first(el, "autoNumFormat");
    const type = attr(fmt, "type") ?? "DIGIT";
    const user = attr(fmt, "userChar");
    const core = type === "USER_CHAR" && user ? user : formatNumber(n, type);
    return `${attr(fmt, "prefixChar") ?? ""}${core}${attr(fmt, "suffixChar") ?? ""}`;
  }

  // ---- 개체 배치 --------------------------------------------------------------

  geometry(el: Element): Geometry {
    const sz = first(el, "sz");
    const cur = first(el, "curSz");
    let w = num(sz, "width"), h = num(sz, "height");
    if (!w) w = num(cur, "width");
    if (!h) h = num(cur, "height");
    return { w, h };
  }

  // 글자처럼 취급·위아래·어울림(float)·글 앞/뒤(절대 위치)로 나눠 놓습니다.
  place(el: Element, inner: string, g: Geometry, extra = ""): string {
    const pos = first(el, "pos");
    const om = first(el, "outMargin");
    const margin = `margin:${mm(num(om, "top"))}mm ${mm(num(om, "right"))}mm ${mm(num(om, "bottom"))}mm ${mm(num(om, "left"))}mm;`;
    const size = `width:${mm(g.w)}mm;height:${mm(g.h)}mm;`;
    const base = `${size}${extra}`;
    if (!pos || attr(pos, "treatAsChar") === "1") return `<span class="obj inl" style="${base}${margin}">${inner}</span>`;
    const wrap = attr(el, "textWrap") ?? "TOP_AND_BOTTOM";
    const s = this.sec;
    const horzRel = attr(pos, "horzRelTo") ?? "COLUMN", vertRel = attr(pos, "vertRelTo") ?? "PARA";
    const horzAlign = attr(pos, "horzAlign") ?? "LEFT", vertAlign = attr(pos, "vertAlign") ?? "TOP";
    const ho = num(pos, "horzOffset"), vo = num(pos, "vertOffset");
    const textW = s.width - s.left - s.right;
    // 본문 영역 왼쪽 기준 가로 위치(HWPUNIT)
    const refW = horzRel === "PAPER" ? s.width : textW;
    let x = horzAlign === "CENTER" ? (refW - g.w) / 2 + ho : horzAlign === "RIGHT" || horzAlign === "OUTSIDE" ? refW - g.w - ho : ho;
    if (horzRel === "PAPER") x -= s.left;

    if (wrap === "TOP_AND_BOTTOM") {
      const top = vertRel === "PARA" ? vo : 0;
      return `<div class="obj blk" style="${base}${margin}margin-left:${mm(Math.max(0, x))}mm;margin-top:${mm(top + num(om, "top"))}mm">${inner}</div>`;
    }
    if (wrap === "SQUARE" || wrap === "TIGHT" || wrap === "THROUGH") {
      const right = horzAlign === "RIGHT" || horzAlign === "OUTSIDE" || x + g.w / 2 > textW / 2 + textW / 4;
      const side = right ? `float:right;margin-right:${mm(Math.max(0, textW - x - g.w))}mm;` : `float:left;margin-left:${mm(Math.max(0, x))}mm;`;
      const top = vertRel === "PARA" ? vo : 0;
      return `<div class="obj flt" style="${base}${margin}${side}margin-top:${mm(top)}mm">${inner}</div>`;
    }
    // 글 앞·글 뒤: 절대 위치
    const z = wrap === "BEHIND_TEXT" ? "z-index:-1;" : `z-index:${1 + num(el, "zOrder")};`;
    if (vertRel === "PARA") {
      return `<div class="obj abs" style="${base}${z}left:${mm(x)}mm;top:${mm(vo)}mm">${inner}</div>`;
    }
    const pageX = x + s.left;
    const refH = vertRel === "PAPER" ? s.height : s.height - s.top - s.bottom - s.header - s.footer;
    let y = vertAlign === "CENTER" ? (refH - g.h) / 2 + vo : vertAlign === "BOTTOM" ? refH - g.h - vo : vo;
    if (vertRel !== "PAPER") y += s.top + s.header;
    this.page.layer.push(`<div class="obj abs" style="${base}${z}left:${mm(pageX)}mm;top:${mm(y)}mm">${inner}</div>`);
    return "";
  }

  // ---- 개체 ---------------------------------------------------------------------

  object(el: Element): string {
    const name = localName(el);
    const g = this.geometry(el);
    switch (name) {
      case "tbl": return this.table(el);
      case "pic": return this.place(el, this.picture(el, g), g, this.lineCss(el));
      case "rect":
      case "ellipse":
      case "arc":
        return this.place(el, this.drawText(el), g, this.shapeCss(el, g));
      case "line":
      case "polygon":
      case "curve":
      case "connectLine":
        return this.place(el, this.vector(el, g), g);
      case "textart": return this.place(el, this.textart(el, g), g);
      case "container": return this.place(el, this.group(el, g), g);
      case "chart": {
        const path = attr(el, "chartIDRef") ?? "";
        const data = this.files.get(path);
        let inner = `<div class="obj-ph">차트</div>`;
        if (data) {
          try { inner = chartHtml(parseXml(new TextDecoder().decode(data)), g.w, g.h); } catch { /* 해석 실패 시 자리 표시 */ }
        }
        return this.place(el, inner, g, "border:1px solid #999;background:#fff;");
      }
      case "ole": return this.place(el, `<div class="obj-ph">OLE 개체</div>`, g);
      case "video": return this.place(el, `<div class="obj-ph">동영상</div>`, g);
      case "formObject":
      case "checkBtn":
      case "radioBtn":
      case "btn":
      case "comboBox":
      case "edit":
      case "listBox":
      case "scrollBar":
        return this.place(el, `<div class="obj-ph">${esc(attr(el, "caption") ?? "")}</div>`, g);
      default: return "";
    }
  }

  lineCss(el: Element): string {
    const ls = first(el, "lineShape");
    const style = attr(ls, "style") ?? "NONE";
    const w = num(ls, "width");
    if (!ls || style === "NONE" || w <= 0) return "";
    const css = style.includes("DOT") ? "dotted" : style.includes("DASH") ? "dashed" : style.includes("DOUBLE") ? "double" : "solid";
    return `border:${Math.max(0.1, mm(w))}mm ${css} ${color(attr(ls, "color")) ?? "#000"};`;
  }

  fillCss(el: Element): string {
    const brush = first(el, "fillBrush");
    if (!brush) return "";
    let css = "";
    const face = color(attr(first(brush, "winBrush"), "faceColor"));
    if (face) css += `background-color:${face};`;
    const grad = first(brush, "gradation");
    if (grad) {
      const colors = children(grad, "color").map((c) => color(attr(c, "value"))).filter(Boolean);
      if (colors.length > 1) css += `background-image:linear-gradient(${(num(grad, "angle") + 90) % 360}deg,${colors.join(",")});`;
    }
    const img = first(first(brush, "imgBrush"), "img");
    const uri = img && this.binary(attr(img, "binaryItemIDRef") ?? "");
    if (uri) css += `background-image:url('${uri}');background-size:100% 100%;`;
    return css;
  }

  shapeCss(el: Element, g: Geometry): string {
    let css = this.lineCss(el) + this.fillCss(el);
    if (localName(el) === "ellipse") css += "border-radius:50%;";
    const ratio = num(el, "ratio");
    if (localName(el) === "rect" && ratio) css += `border-radius:${mm((Math.min(g.w, g.h) * ratio) / 200)}mm;`;
    return css;
  }

  drawText(el: Element): string {
    const dt = first(el, "drawText");
    if (!dt) return "";
    const sub = first(dt, "subList");
    const tm = first(dt, "textMargin");
    const va: Record<string, string> = { TOP: "flex-start", CENTER: "center", BOTTOM: "flex-end" };
    return `<div class="dt" style="padding:${mm(num(tm, "top"))}mm ${mm(num(tm, "right"))}mm ${mm(num(tm, "bottom"))}mm ${mm(num(tm, "left"))}mm;justify-content:${va[attr(sub, "vertAlign") ?? "TOP"] ?? "flex-start"}">${this.paragraphs(sub)}</div>`;
  }

  picture(el: Element, g: Geometry): string {
    const img = desc(el, "img")[0];
    const uri = img && this.binary(attr(img, "binaryItemIDRef") ?? "");
    if (!uri) return `<div class="obj-ph">그림</div>`;
    const clip = first(el, "imgClip");
    const dim = first(el, "imgDim");
    const dw = num(dim, "dimwidth"), dh = num(dim, "dimheight");
    const l = num(clip, "left"), r = num(clip, "right", dw), t = num(clip, "top"), b = num(clip, "bottom", dh);
    if (clip && dw && dh && r > l && b > t && (l > 0 || t > 0 || r < dw || b < dh)) {
      const sx = g.w / (r - l), sy = g.h / (b - t);
      return `<span class="crop"><img src="${uri}" alt="" style="width:${mm(dw * sx)}mm;height:${mm(dh * sy)}mm;margin-left:${mm(-l * sx)}mm;margin-top:${mm(-t * sy)}mm"></span>`;
    }
    return `<img src="${uri}" alt="" style="width:100%;height:100%">`;
  }

  vector(el: Element, g: Geometry): string {
    const org = first(el, "orgSz");
    const vw = num(org, "width") || g.w || 1, vh = num(org, "height") || g.h || 1;
    const ls = first(el, "lineShape");
    const stroke = `stroke="${color(attr(ls, "color")) ?? "#000"}" stroke-width="${Math.max(1, mm(num(ls, "width", 33)) * 3.78)}" vector-effect="non-scaling-stroke" fill="none"`;
    let shape = "";
    const name = localName(el);
    if (name === "line" || name === "connectLine") {
      const a = first(el, "startPt"), b = first(el, "endPt");
      shape = `<line x1="${num(a, "x")}" y1="${num(a, "y")}" x2="${num(b, "x")}" y2="${num(b, "y")}" ${stroke}/>`;
    } else if (name === "polygon") {
      const pts = children(el, "pt").map((p) => `${num(p, "x")},${num(p, "y")}`).join(" ");
      const face = color(attr(first(first(el, "fillBrush"), "winBrush"), "faceColor"));
      shape = `<polygon points="${pts}" ${stroke.replace('fill="none"', `fill="${face ?? "none"}"`)}/>`;
    } else {
      const pts = children(el, "seg").flatMap((s) => [`${num(s, "x1")},${num(s, "y1")}`, `${num(s, "x2")},${num(s, "y2")}`]).join(" ");
      shape = `<polyline points="${pts}" ${stroke}/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="none" width="100%" height="100%" overflow="visible">${shape}</svg>`;
  }

  textart(el: Element, g: Geometry): string {
    const pr = first(el, "textartPr");
    const face = color(attr(first(first(el, "fillBrush"), "winBrush"), "faceColor")) ?? "#000";
    const font = fontName(attr(pr, "fontName") ?? "");
    const text = attr(el, "text") ?? "";
    // 글자가 상자 폭에 대강 맞도록 높이와 글자 수 중 작은 쪽으로 크기를 정합니다.
    const size = Math.min(mm(g.h) * 0.8, (mm(g.w) / Math.max(1, [...text].length)) * 1.1);
    return `<div class="textart" style="color:${face};font-family:${font ? `'${font}',` : ""}sans-serif;font-size:${size.toFixed(2)}mm">${esc(text)}</div>`;
  }

  group(el: Element, g: Geometry): string {
    const org = first(el, "orgSz");
    const sx = num(org, "width") ? g.w / num(org, "width") : 1, sy = num(org, "height") ? g.h / num(org, "height") : 1;
    const items: string[] = [];
    for (const c of children(el)) {
      const name = localName(c);
      if (!["rect", "ellipse", "arc", "line", "polygon", "curve", "connectLine", "pic", "textart", "container"].includes(name)) continue;
      const off = first(c, "offset");
      const cur = first(c, "curSz");
      const cg = { w: num(cur, "width") || num(first(c, "orgSz"), "width"), h: num(cur, "height") || num(first(c, "orgSz"), "height") };
      const inner =
        name === "pic" ? this.picture(c, cg) :
        name === "textart" ? this.textart(c, cg) :
        name === "container" ? this.group(c, cg) :
        ["line", "polygon", "curve", "connectLine"].includes(name) ? this.vector(c, cg) : this.drawText(c);
      const extra = ["rect", "ellipse", "arc"].includes(name) ? this.shapeCss(c, cg) : name === "pic" ? this.lineCss(c) : "";
      items.push(`<div class="obj" style="position:absolute;left:${mm(num(off, "x") * sx)}mm;top:${mm(num(off, "y") * sy)}mm;width:${mm(cg.w * sx)}mm;height:${mm(cg.h * sy)}mm;${extra}">${inner}</div>`);
    }
    return `<div style="position:relative;width:100%;height:100%">${items.join("")}</div>`;
  }

  equation(el: Element): string {
    const fg = color(attr(el, "textColor"));
    const size = num(el, "baseUnit", 1000);
    const html = equationHtml(textOf(first(el, "script")));
    const pos = first(el, "pos");
    const span = `<span class="eq" style="font-size:${pt(size)}pt;${fg && fg !== "#000000" ? `color:${fg};` : ""}">${html}</span>`;
    if (!pos || attr(pos, "treatAsChar") === "1") return span;
    return this.place(el, span, this.geometry(el));
  }

  // ---- 표 ---------------------------------------------------------------------

  table(el: Element): string {
    const g = this.geometry(el);
    const colCnt = num(el, "colCnt");
    const inMargin = first(el, "inMargin");
    type Cell = { el: Element; col: number; row: number; cs: number; rs: number; w: number; h: number };
    const rows: Cell[][] = children(el, "tr").map((tr) =>
      children(tr, "tc").map((tc) => {
        const addr = first(tc, "cellAddr"), span = first(tc, "cellSpan"), sz = first(tc, "cellSz");
        return { el: tc, col: num(addr, "colAddr"), row: num(addr, "rowAddr"), cs: Math.max(1, num(span, "colSpan", 1)), rs: Math.max(1, num(span, "rowSpan", 1)), w: num(sz, "width"), h: num(sz, "height") };
      }),
    );
    const cols = Math.max(colCnt, ...rows.flat().map((c) => c.col + c.cs));
    // 열 너비: 한 칸짜리 셀에서 먼저 정하고, 남은 열은 여러 칸 셀에서 나눠 정합니다.
    const widths: (number | undefined)[] = Array(cols).fill(undefined);
    for (const c of rows.flat()) if (c.cs === 1 && widths[c.col] === undefined && c.w) widths[c.col] = c.w;
    for (const c of rows.flat()) {
      if (c.cs === 1) continue;
      const span = widths.slice(c.col, c.col + c.cs);
      const unknown = span.filter((w) => w === undefined).length;
      if (!unknown) continue;
      const known = span.reduce<number>((a, w) => a + (w ?? 0), 0);
      const each = Math.max(0, c.w - known) / unknown;
      for (let i = c.col; i < c.col + c.cs; i++) if (widths[i] === undefined) widths[i] = each;
    }
    const total = g.w || widths.reduce<number>((a, w) => a + (w ?? 0), 0);
    const fallback = total / Math.max(cols, 1);
    const colgroup = widths.map((w) => `<col style="width:${mm(w ?? fallback)}mm">`).join("");
    const tableW = widths.reduce<number>((a, w) => a + (w ?? fallback), 0);

    const body = rows.map((cells) => {
      const height = Math.max(0, ...cells.filter((c) => c.rs === 1).map((c) => c.h));
      const tds = cells.map((c) => {
        const tc = c.el;
        const sub = first(tc, "subList");
        const m = attr(tc, "hasMargin") === "1" ? first(tc, "cellMargin") : inMargin;
        const va: Record<string, string> = { TOP: "top", CENTER: "middle", BOTTOM: "bottom" };
        const span = `${c.cs > 1 ? ` colspan="${c.cs}"` : ""}${c.rs > 1 ? ` rowspan="${c.rs}"` : ""}`;
        const style = `padding:${mm(num(m, "top"))}mm ${mm(num(m, "right"))}mm ${mm(num(m, "bottom"))}mm ${mm(num(m, "left"))}mm;vertical-align:${va[attr(sub, "vertAlign") ?? "CENTER"] ?? "middle"}`;
        return `<td class="b${attr(tc, "borderFillIDRef") ?? ""}"${span} style="${style}">${this.paragraphs(sub)}</td>`;
      });
      return `<tr${height ? ` style="height:${mm(height)}mm"` : ""}>${tds.join("")}</tr>`;
    }).join("");

    const cap = first(el, "caption");
    const caption = cap ? `<caption style="caption-side:${attr(cap, "side") === "BOTTOM" ? "bottom" : "top"}">${this.paragraphs(first(cap, "subList"))}</caption>` : "";
    const bf = attr(el, "borderFillIDRef");
    const html = `<table class="tbl${bf ? ` b${bf}` : ""}" style="width:${mm(tableW)}mm">${caption}<colgroup>${colgroup}</colgroup>${body}</table>`;
    // 표 크기는 내용에 따라 늘어나야 하므로 place의 고정 높이를 쓰지 않습니다.
    const pos = first(el, "pos");
    if (!pos || attr(pos, "treatAsChar") === "1") {
      const om = first(el, "outMargin");
      return `<span class="obj inl tblwrap" style="margin:${mm(num(om, "top"))}mm ${mm(num(om, "right"))}mm ${mm(num(om, "bottom"))}mm ${mm(num(om, "left"))}mm">${html}</span>`;
    }
    const placed = this.place(el, html, { w: tableW, h: g.h });
    return placed.replace(/height:[\d.]+mm;/, "");
  }
}

// ---------------------------------------------------------------------------
// 문서 전체
// ---------------------------------------------------------------------------

const BASE_CSS = `
html{background:#e9e9e9}
body{margin:0;padding:8px 0;color:#000;font-family:"함초롬바탕","바탕",Batang,serif;-webkit-text-size-adjust:100%}
.page{position:relative;isolation:isolate;box-sizing:border-box;background:#fff;margin:0 auto 16px;box-shadow:0 1px 4px rgba(0,0,0,.25);overflow-wrap:break-word}
.p{margin:0;white-space:pre-wrap;position:relative}
.tab{display:inline-block}
.obj{box-sizing:border-box;text-indent:0}
.inl{display:inline-block;vertical-align:bottom}
.tblwrap{width:auto;height:auto}
.blk{display:block}
.abs{position:absolute}
.obj img{display:block;max-width:none}
.crop{display:block;width:100%;height:100%;overflow:hidden}
.dt{box-sizing:border-box;width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden}
.textart{width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;font-weight:bold;line-height:1}
.obj-ph{width:100%;height:100%;min-height:1.5em;display:flex;align-items:center;justify-content:center;border:1px dashed #999;color:#666;font:12px sans-serif;box-sizing:border-box}
.tbl{border-collapse:collapse;table-layout:fixed;text-indent:0}
.tbl td{box-sizing:border-box;overflow-wrap:anywhere}
.tbl caption{text-align:left}
.hdr,.ftr{position:absolute}
.notes{border-top:1px solid #000;width:30%;margin-top:4mm;padding-top:1mm}
.notes .note{width:333%;font-size:9pt}
.note-ref{font-size:.7em;line-height:0}
.note-ref a,.p a{color:inherit}
.endnotes{max-width:180mm;margin:0 auto 16px;background:#fff;padding:10mm}
.chart-tbl{border-collapse:collapse;font:11px sans-serif;margin:4px auto}
.chart-tbl td,.chart-tbl th{border:1px solid #999;padding:2px 6px}
mark{color:inherit}
@media print{html{background:#fff}body{padding:0}.page{box-shadow:none;margin:0;break-after:page}}
`;

export async function hwpxToHtml(data: ArrayBuffer | Uint8Array, fallbackTitle = ""): Promise<string> {
  let files: Map<string, Uint8Array>;
  try {
    files = await unzip(data);
  } catch (e) {
    if (e instanceof ZipError) throw new HwpxError("notHwpx", "HWPX(ZIP) 파일이 아닙니다");
    throw e;
  }
  const dec = new TextDecoder();
  const read = (path: string) => {
    const d = files.get(path);
    return d ? dec.decode(d) : undefined;
  };
  const manifestXml = read("META-INF/manifest.xml") ?? "";
  if (/encryption-data|EncryptionData/i.test(manifestXml)) throw new HwpxError("encrypted", "암호가 걸린 문서입니다");
  const headerXml = read("Contents/header.xml");
  if (!headerXml) throw new HwpxError("notHwpx", "HWPX 문서가 아닙니다(Contents/header.xml 없음)");

  // content.hpf: 구역 순서와 그림 파일 목록
  const items = new Map<string, string>();
  const spine: string[] = [];
  let title = fallbackTitle;
  const hpf = read("Contents/content.hpf");
  if (hpf) {
    try {
      const doc = parseXml(hpf);
      for (const it of desc(doc.documentElement, "item")) items.set(attr(it, "id") ?? "", attr(it, "href") ?? "");
      for (const ref of desc(doc.documentElement, "itemref")) spine.push(attr(ref, "idref") ?? "");
      title = textOf(desc(doc.documentElement, "title")[0]).trim() || title;
    } catch { /* 목록이 깨졌으면 파일 이름으로 찾음 */ }
  }
  const sectionPaths = spine.map((id) => items.get(id) ?? "").filter((p) => /section\d+\.xml$/i.test(p));
  const sections = sectionPaths.length
    ? sectionPaths
    : [...files.keys()].filter((p) => /^Contents\/section\d+\.xml$/i.test(p)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (!sections.length) throw new HwpxError("broken", "본문(section)이 없습니다");

  const uriCache = new Map<string, string | undefined>();
  const binary: Binary = (id) => {
    if (uriCache.has(id)) return uriCache.get(id);
    let path = items.get(id);
    if (!path || !files.has(path)) path = [...files.keys()].find((p) => p.startsWith(`BinData/${id}.`));
    const ext = path?.split(".").pop()?.toLowerCase() ?? "";
    const d = path ? files.get(path) : undefined;
    const uri = d && MIME[ext] ? `data:${MIME[ext]};base64,${base64(d)}` : undefined;
    uriCache.set(id, uri);
    return uri;
  };

  let head: Header;
  try {
    head = new Header(parseXml(headerXml), binary);
  } catch {
    throw new HwpxError("broken", "문서 정보(header.xml)를 읽지 못했습니다");
  }
  const r = new Renderer(head, files, binary);
  for (const path of sections) {
    const xml = read(path);
    if (!xml) continue;
    try {
      r.section(parseXml(xml));
    } catch (e) {
      throw new HwpxError("broken", `${path}를 읽지 못했습니다: ${e instanceof Error ? e.message : e}`);
    }
  }
  const endnotes = r.endnotes.length ? `<div class="endnotes">${r.endnotes.join("")}</div>` : "";
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${BASE_CSS}${EQUATION_CSS}${head.css.join("\n")}</style></head><body>${r.out.join("")}${endnotes}</body></html>`;
}
