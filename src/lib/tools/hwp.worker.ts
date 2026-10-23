// HWP(5.x)를 HTML로 바꾸는 웹 워커. 브라우저용 Python(Pyodide)에서 pyhwp(hwp5html)를 돌립니다.
// Pyodide 본체(public/pyodide/)와 휠·변환 코드(public/hwp/)는 사이트에서 내려주고(scripts/copy-models.mjs),
// 처음 한 번 받은 뒤에는 브라우저 캐시를 씁니다. 문서는 이 브라우저 밖으로 나가지 않습니다.
// 변환 코드는 PC용 도구와 같은 tools/hwp2html/hwp2html.py의 hwp5_to_dir·inline_html입니다.

export type HwpRequest = { id: number; data: ArrayBuffer; title: string };
export type HwpMessage =
  | { type: "load"; id: number } // Python과 pyhwp를 준비하는 중(처음에만)
  | { type: "convert"; id: number }
  | { type: "done"; id: number; html: string }
  | { type: "error"; id: number; code: "unsupported" | "failed"; message: string };

type Pyodide = {
  loadPackage(urls: string[]): Promise<unknown>;
  runPython(code: string): unknown;
  FS: { writeFile(path: string, data: Uint8Array | string): void; unlink(path: string): void };
  globals: { get(name: string): (...args: unknown[]) => unknown };
};

const post = (m: HwpMessage) => (self as unknown as Worker).postMessage(m);
const base = self.location.origin;
const WHEELS = [
  "lxml-5.2.1-cp312-cp312-pyodide_2024_0_wasm32.whl",
  "six-1.16.0-py2.py3-none-any.whl",
  "olefile-0.47-py2.py3-none-any.whl",
  "pyhwp-0.1b15-py3-none-any.whl",
];

const SETUP = `
import shutil, sys
from pathlib import Path
sys.path.insert(0, "/home/pyodide/hwp")
import hwp2html

def convert(path, title):
    out = Path("/tmp/hwp-out")
    shutil.rmtree(out, ignore_errors=True)
    try:
        return hwp2html.inline_html(hwp2html.hwp5_to_dir(Path(path), out), title=title)
    finally:
        shutil.rmtree(out, ignore_errors=True)
`;

let ready: Promise<Pyodide> | null = null;

async function load(): Promise<Pyodide> {
  const { loadPyodide } = (await import(/* webpackIgnore: true */ `${base}/pyodide/pyodide.mjs`)) as {
    loadPyodide(o: { indexURL: string }): Promise<Pyodide>;
  };
  const py = await loadPyodide({ indexURL: `${base}/pyodide/` });
  await py.loadPackage(WHEELS.map((w) => `${base}/hwp/${w}`));
  const src = await fetch(`${base}/hwp/hwp2html.py`).then((r) => {
    if (!r.ok) throw new Error(`hwp2html.py ${r.status}`);
    return r.text();
  });
  py.runPython(`import os; os.makedirs("/home/pyodide/hwp", exist_ok=True)`);
  py.FS.writeFile("/home/pyodide/hwp/hwp2html.py", src);
  py.runPython(SETUP);
  return py;
}

self.onmessage = async (e: MessageEvent<HwpRequest>) => {
  const { id, data, title } = e.data;
  let py: Pyodide;
  try {
    if (!ready) post({ type: "load", id });
    ready ??= load();
    py = await ready;
  } catch (err) {
    ready = null; // 내려받기가 끊겼으면 다음에 다시 시도
    post({ type: "error", id, code: "failed", message: `load: ${String(err)}` });
    return;
  }
  post({ type: "convert", id });
  const path = "/tmp/input.hwp";
  try {
    py.FS.writeFile(path, new Uint8Array(data));
    const html = py.globals.get("convert")(path, title) as string;
    post({ type: "done", id, html });
  } catch (err) {
    const message = String(err);
    // UnsupportedHwp: OLE 파일이 아니거나 HWP 5.x가 아님(HWP 3.x, HWPX를 .hwp로 저장한 파일 등)
    post({ type: "error", id, code: /UnsupportedHwp/.test(message) ? "unsupported" : "failed", message });
  } finally {
    try { py.FS.unlink(path); } catch { /* 없으면 그만 */ }
  }
};
