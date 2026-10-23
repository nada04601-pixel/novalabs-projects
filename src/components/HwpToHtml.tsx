"use client";
import { useEffect, useRef, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { formatBytes } from "@/lib/tools/fileSize";
import type { HwpMessage, HwpRequest } from "@/lib/tools/hwp.worker";

// HWP는 웹 워커의 pyhwp(Pyodide)로, HWPX는 화면 쪽 hwpxToHtml(DOMParser가 워커에 없음)로 바꿉니다.
const MAX_BYTES = 100 * 1024 * 1024;

type Kind = "hwp" | "hwpx";
type Result = { html: string; url: string; name: string; size: number };

// 확장자가 틀린 파일도 있어 내용 첫 바이트로 형식을 가립니다(HWP는 OLE 복합 문서, HWPX는 ZIP).
async function detect(file: File): Promise<Kind | null> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return "hwp";
  if (head[0] === 0x50 && head[1] === 0x4b) return "hwpx";
  return null;
}

const stem = (name: string) => name.replace(/\.(hwpx?|zip)$/i, "") || "문서";

export default function HwpToHtml() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [detail, setDetail] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const worker = useRef<Worker | null>(null);
  const run = useRef(0);

  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const fail = (message: string, why = "") => {
    setError(message);
    setDetail(why);
    setBusy("");
  };

  const finish = (html: string, name: string) => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    setResult({ html, url: URL.createObjectURL(blob), name: `${stem(name)}.html`, size: blob.size });
    setBusy("");
  };

  const convertHwp = (f: File, data: ArrayBuffer, id: number) => {
    if (!worker.current) {
      const w = new Worker(new URL("../lib/tools/hwp.worker.ts", import.meta.url), { type: "module" });
      w.onerror = () => {
        worker.current = null;
        fail("변환기를 시작하지 못했습니다. 최신 크롬·엣지·사파리에서 다시 해 보세요.");
      };
      worker.current = w;
    }
    worker.current.onmessage = (e: MessageEvent<HwpMessage>) => {
      const m = e.data;
      if (m.id !== run.current) return; // 앞서 고른 파일의 결과
      if (m.type === "load") setBusy("HWP 변환기를 준비하는 중… 처음 한 번 약 15MB를 내려받습니다.");
      else if (m.type === "convert") setBusy("변환하는 중…");
      else if (m.type === "done") finish(m.html, f.name);
      else if (m.code === "unsupported") fail("HWP 5.0(한글 2002) 이후 형식만 바꿀 수 있습니다. 한글 97 이전 문서는 한글에서 HWP나 HWPX로 다시 저장해 주세요.", m.message);
      else if (m.message.startsWith("load:")) fail("변환기를 내려받지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.", m.message);
      else fail("변환하지 못했습니다. 배포용(읽기 전용)·암호 문서이거나 파일이 손상됐을 수 있습니다. 한글에서 HWPX로 저장해 다시 해 보세요.", m.message);
    };
    const req: HwpRequest = { id, data, title: stem(f.name) };
    worker.current.postMessage(req, [data]);
  };

  const convertHwpx = async (f: File, data: ArrayBuffer, id: number) => {
    try {
      const { hwpxToHtml, HwpxError } = await import("@/lib/tools/hwpx");
      try {
        const html = await hwpxToHtml(data, stem(f.name));
        if (run.current === id) finish(html, f.name);
      } catch (e) {
        if (run.current !== id) return;
        const why = e instanceof Error ? e.message : String(e);
        if (e instanceof HwpxError && e.code === "encrypted") fail("암호가 걸린 문서는 바꿀 수 없습니다. 한글에서 암호를 풀고 저장한 뒤 다시 해 보세요.", why);
        else if (e instanceof HwpxError && e.code === "notHwpx") fail("HWPX 문서가 아닙니다. 한글에서 만든 .hwpx 파일인지 확인해 주세요.", why);
        else fail("변환하지 못했습니다. 파일이 손상됐을 수 있습니다.", why);
      }
    } catch (e) {
      if (run.current === id) fail("변환기를 불러오지 못했습니다. 페이지를 새로 고친 뒤 다시 해 보세요.", String(e));
    }
  };

  const pick = async (f: File | null) => {
    const id = ++run.current;
    setResult(null);
    setError("");
    setDetail("");
    setFile(f);
    if (!f) return;
    if (f.size > MAX_BYTES) return fail(`파일이 너무 큽니다. ${formatBytes(MAX_BYTES)} 이하의 문서만 바꿀 수 있습니다.`);
    setBusy("파일을 읽는 중…");
    const kind = await detect(f);
    if (run.current !== id) return;
    if (!kind) return fail("HWP·HWPX 문서가 아닙니다. 한글(.hwp, .hwpx) 파일을 골라 주세요.");
    const data = await f.arrayBuffer();
    if (run.current !== id) return;
    if (kind === "hwp") convertHwp(f, data, id);
    else {
      setBusy("변환하는 중…");
      await convertHwpx(f, data, id);
    }
  };

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept=".hwp,.hwpx,application/x-hwp,application/haansofthwp,application/hwp+zip" onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <span>{file ? `${file.name} (${formatBytes(file.size)}) · 다른 문서 고르기` : "HTML로 바꿀 한글 문서를 고르세요 (.hwp, .hwpx)"}</span>
      </label>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}</p>}
        {error && (
          <p className="warn">
            {error}
            {detail && <><br /><small className="note-sm">({detail.slice(0, 300)})</small></>}
          </p>
        )}
        {result && (
          <>
            <div className="actions">
              <a className="btn sm" href={result.url} download={result.name}>HTML 내려받기 ({formatBytes(result.size)})</a>
              <CopyButton text={() => result.html} label="HTML 코드 복사" />
            </div>
            {/* 스크립트를 막은 틀 안에서 미리보기 */}
            <iframe
              title="변환 결과 미리보기"
              sandbox=""
              srcDoc={result.html}
              style={{ width: "100%", height: "75vh", border: "1px solid var(--line)", borderRadius: 8, background: "#e9e9e9", marginTop: 12 }}
            />
          </>
        )}
        <p className="note">파일은 서버로 올라가지 않고 이 브라우저 안에서만 바뀝니다. 그림은 HTML 파일 안에 함께 들어가므로 HTML 파일 하나만 있으면 됩니다.</p>
      </div>
    </div>
  );
}
