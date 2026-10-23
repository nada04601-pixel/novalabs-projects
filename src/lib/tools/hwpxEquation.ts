// 한글 수식 스크립트(예: "{1} over {6} n(n+1)", "sum _{k=1} ^{n} k ^{2}")를 HTML로 대강 그립니다.
// 분수·위첨자·아래첨자·근호·큰 연산자·그리스 문자·관계 기호·행렬(pile·matrix·cases)을 다루고, 모르는 명령어는 글자 그대로 둡니다.

const SYMBOLS: Record<string, string> = {
  times: "×", div: "÷", cdot: "·", pm: "±", "+-": "±", mp: "∓", "-+": "∓",
  le: "≤", leq: "≤", "<=": "≤", ge: "≥", geq: "≥", ">=": "≥", ne: "≠", neq: "≠", "!=": "≠",
  approx: "≈", sim: "∼", simeq: "≃", equiv: "≡", "==": "≡", propto: "∝",
  inf: "∞", infinity: "∞", partial: "∂", nabla: "∇", angle: "∠", triangle: "△", deg: "°", prime: "′",
  rarrow: "→", larrow: "←", lrarrow: "↔", "->": "→", uarrow: "↑", darrow: "↓",
  therefore: "∴", because: "∵", in: "∈", notin: "∉", owns: "∋", subset: "⊂", supset: "⊃", subseteq: "⊆", supseteq: "⊇",
  cup: "∪", cap: "∩", emptyset: "∅", forall: "∀", exist: "∃", exists: "∃", not: "¬", and: "∧", or: "∨",
  dots: "…", ldots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱", circ: "∘", bullet: "∙", star: "⋆", perp: "⊥", "|": "|",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", omicron: "ο", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
};
// 대문자로 쓰면 대문자 그리스 문자가 되는 이름(ALPHA → Α)
const GREEK_UPPER: Record<string, string> = {
  alpha: "Α", beta: "Β", gamma: "Γ", delta: "Δ", epsilon: "Ε", zeta: "Ζ", eta: "Η", theta: "Θ", iota: "Ι", kappa: "Κ",
  lambda: "Λ", mu: "Μ", nu: "Ν", xi: "Ξ", omicron: "Ο", pi: "Π", rho: "Ρ", sigma: "Σ", tau: "Τ", upsilon: "Υ",
  phi: "Φ", chi: "Χ", psi: "Ψ", omega: "Ω",
};
const BIG_OPS: Record<string, string> = {
  sum: "∑", prod: "∏", coprod: "∐", int: "∫", iint: "∬", iiint: "∭", oint: "∮", bigcup: "⋃", bigcap: "⋂", lim: "lim", "lim_": "lim",
};
const FUNCS = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "sinh", "cosh", "tanh", "log", "ln", "lg", "exp", "max", "min", "det", "mod", "arcsin", "arccos", "arctan", "gcd", "lcm"]);
const ACCENTS: Record<string, string> = { vec: "⃗", hat: "̂", tilde: "̃", dot: "̇", ddot: "̈", acute: "́", grave: "̀", check: "̌", arch: "̑" };
const IGNORE = new Set(["rm", "it", "bold", "left", "right", "big", "scale", "color", "under", "atop"]);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Tok = { t: "word" | "num" | "sym" | "{" | "}" | "^" | "_" | "sp" | "#" | "&"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s+|[{}^_#&~`]|[A-Za-z]+|\d+(?:\.\d+)?|<=|>=|!=|==|\+-|-\+|->|[\s\S]/g;
  for (const m of src.matchAll(re)) {
    const v = m[0];
    if (/^\s+$/.test(v)) continue; // 수식에서 공백은 구분용일 뿐
    if (v === "~") out.push({ t: "sp", v: " " });
    else if (v === "`") out.push({ t: "sp", v: " " });
    else if (v === "{" || v === "}" || v === "^" || v === "_" || v === "#" || v === "&") out.push({ t: v, v });
    else if (/^[A-Za-z]+$/.test(v)) out.push({ t: "word", v });
    else if (/^\d/.test(v)) out.push({ t: "num", v });
    else out.push({ t: "sym", v });
  }
  return out;
}

class Parser {
  i = 0;
  constructor(private toks: Tok[]) {}
  peek() { return this.toks[this.i]; }
  next() { return this.toks[this.i++]; }

  // 닫는 괄호(또는 끝)까지 읽어 HTML 조각 목록으로 돌려줍니다. rows가 true면 # 로 나뉜 줄 목록을 돌려줍니다.
  seq(stopAtBrace: boolean): string[][] {
    const rows: string[][] = [[]];
    let atoms = rows[0];
    while (this.i < this.toks.length) {
      const tk = this.peek();
      if (tk.t === "}") { if (stopAtBrace) { this.next(); break; } this.next(); continue; }
      if (tk.t === "#") { this.next(); atoms = []; rows.push(atoms); continue; }
      if (tk.t === "&") { this.next(); atoms.push(" "); continue; }
      if (tk.t === "word" && tk.v.toLowerCase() === "over" && atoms.length) {
        this.next();
        const num = atoms.pop()!;
        const den = this.atom() ?? "";
        atoms.push(`<span class="eq-frac"><span>${num}</span><span>${den}</span></span>`);
        continue;
      }
      if (tk.t === "^" || tk.t === "_") {
        this.next();
        const arg = this.atom() ?? "";
        const base = atoms.pop() ?? "";
        atoms.push(base + (tk.t === "^" ? `<sup>${arg}</sup>` : `<sub>${arg}</sub>`));
        continue;
      }
      const a = this.atom();
      if (a !== null) atoms.push(a);
    }
    return rows;
  }

  group(): string {
    return this.seq(true).map((r) => r.join("")).join("<br>");
  }

  // 하나의 덩어리(글자, {묶음}, 명령어와 그 인자)를 읽습니다.
  atom(): string | null {
    const tk = this.next();
    if (!tk) return null;
    if (tk.t === "{") return this.group();
    if (tk.t === "sp") return tk.v;
    if (tk.t === "num") return tk.v;
    if (tk.t === "sym") return esc(SYMBOLS[tk.v] ?? tk.v);
    if (tk.t !== "word") return null;
    const w = tk.v;
    const lw = w.toLowerCase();
    if (IGNORE.has(lw)) {
      if (lw === "color" || lw === "scale") this.atom(); // 색·크기 값은 버림
      return "";
    }
    if (lw === "sqrt") return `√<span class="eq-sqrt">${this.atom() ?? ""}</span>`;
    if (lw === "root") {
      const n = this.atom() ?? "";
      if (this.peek()?.t === "word" && this.peek().v.toLowerCase() === "of") this.next();
      return `<sup class="eq-rootn">${n}</sup>√<span class="eq-sqrt">${this.atom() ?? ""}</span>`;
    }
    if (lw === "bar" || lw === "overline") return `<span class="eq-bar">${this.atom() ?? ""}</span>`;
    if (lw === "underline") return `<u>${this.atom() ?? ""}</u>`;
    if (ACCENTS[lw]) return `${this.atom() ?? ""}${ACCENTS[lw]}`;
    if (lw === "pile" || lw === "lpile" || lw === "rpile" || lw === "matrix" || lw === "pmatrix" || lw === "bmatrix" || lw === "dmatrix" || lw === "cases") {
      if (this.peek()?.t !== "{") return esc(w);
      this.next();
      const rows = this.seq(true);
      const body = rows.map((r) => `<span>${r.join("")}</span>`).join("");
      const align = lw === "lpile" || lw === "cases" ? " eq-left" : lw === "rpile" ? " eq-right" : "";
      const stack = `<span class="eq-stack${align}">${body}</span>`;
      if (lw === "cases") return `<span class="eq-brace">{</span>${stack}`;
      if (lw === "pmatrix") return `(${stack})`;
      if (lw === "bmatrix") return `[${stack}]`;
      if (lw === "dmatrix") return `|${stack}|`;
      return stack;
    }
    if (BIG_OPS[lw]) return `<span class="${lw.startsWith("lim") ? "eq-fn" : "eq-big"}">${BIG_OPS[lw]}</span>`;
    if (FUNCS.has(lw)) return `<span class="eq-fn">${lw}</span>`;
    if (w === w.toUpperCase() && GREEK_UPPER[lw]) return GREEK_UPPER[lw];
    if (SYMBOLS[lw] && (w === lw || w === w.toUpperCase())) return SYMBOLS[lw];
    return `<i>${esc(w)}</i>`;
  }
}

export function equationHtml(script: string): string {
  const rows = new Parser(tokenize(script)).seq(false);
  return rows.map((r) => r.join("")).join("<br>");
}

export const EQUATION_CSS = `
.eq{font-family:"Times New Roman",serif;white-space:nowrap;display:inline-block;vertical-align:middle}
.eq i{font-style:italic}
.eq-frac{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;margin:0 .1em}
.eq-frac>span:first-child{border-bottom:1px solid currentColor;padding:0 .15em}
.eq-frac>span:last-child{padding:0 .15em}
.eq-sqrt{border-top:1px solid currentColor;padding:0 .1em}
.eq-rootn{font-size:.6em;margin-right:-.4em}
.eq-bar{text-decoration:overline}
.eq-big{font-size:1.4em;vertical-align:-.15em}
.eq-fn{font-style:normal;margin:0 .1em}
.eq-stack{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center}
.eq-left{text-align:left}.eq-right{text-align:right}
.eq-brace{font-size:2em;vertical-align:middle;font-weight:200}
`;
