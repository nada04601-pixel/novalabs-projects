"use client";
import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import { chunkPages, groupLabel, parsePageRanges, PDF_MAX_BYTES, pdfBlob, pdfErrorMessage, pdfName } from "@/lib/tools/pdfPlan";

type Mode = "ranges" | "every" | "extract";
type Output = { url: string; name: string; size: number; pages: number };

const MODES: { key: Mode; label: string }[] = [
  { key: "ranges", label: "범위별로 나누기" },
  { key: "every", label: "n쪽씩 나누기" },
  { key: "extract", label: "원하는 쪽만 뽑기" },
];

export default function PdfSplitter() {
  const [file, setFile] = useState<File | null>(null);
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState<Mode>("ranges");
  const [ranges, setRanges] = useState("");
  const [every, setEvery] = useState("1");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [outputs, setOutputs] = useState<Output[]>([]);

  useEffect(() => () => outputs.forEach((o) => URL.revokeObjectURL(o.url)), [outputs]);

  const pick = async (f: File | null) => {
    setOutputs([]);
    setError("");
    setFile(null);
    setTotal(0);
    if (!f) return;
    if (f.size > PDF_MAX_BYTES) {
      setError(`파일이 너무 큽니다. ${formatBytes(PDF_MAX_BYTES)} 이하의 PDF만 처리할 수 있습니다.`);
      return;
    }
    setBusy("파일을 읽는 중…");
    try {
      const { pageCount } = await import("@/lib/tools/pdfPages");
      const n = await pageCount(await f.arrayBuffer());
      setFile(f);
      setTotal(n);
      setRanges(n > 1 ? `1-${Math.ceil(n / 2)}, ${Math.ceil(n / 2) + 1}-${n}` : "1");
    } catch (e) {
      setError(pdfErrorMessage(e));
    } finally {
      setBusy("");
    }
  };

  // 지금 설정으로 만들어질 묶음. 입력이 잘못됐으면 오류 문구를 돌려줍니다.
  const plan = (() => {
    if (!total) return null;
    if (mode === "every") {
      const n = Number(every);
      if (!Number.isInteger(n) || n < 1) return { ok: false as const, error: "1 이상의 정수를 입력하세요." };
      return { ok: true as const, groups: chunkPages(total, n) };
    }
    const r = parsePageRanges(ranges, total);
    return r.ok && mode === "extract" ? { ok: true as const, groups: [r.groups.flat()] } : r;
  })();

  const run = async () => {
    if (!file || !plan?.ok) return;
    setError("");
    setOutputs([]);
    setBusy("나누는 중…");
    try {
      const { splitPdf } = await import("@/lib/tools/pdfPages");
      const parts = await splitPdf(await file.arrayBuffer(), plan.groups);
      setOutputs(parts.map((bytes, i) => {
        const g = plan.groups[i];
        const blob = pdfBlob(bytes);
        const label = mode === "extract" ? "추출" : groupLabel(g);
        return { url: URL.createObjectURL(blob), name: pdfName(file.name, label), size: blob.size, pages: g.length };
      }));
    } catch (e) {
      setError(pdfErrorMessage(e));
    } finally {
      setBusy("");
    }
  };

  const fileCount = plan?.ok ? plan.groups.length : 0;
  const tooMany = fileCount > 100;

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <span>{file ? `${file.name} (${formatBytes(file.size)} · ${total}쪽)` : "나눌 PDF 파일을 고르세요"}</span>
      </label>

      {file && (
        <>
          <h3 className="sub">나누는 방법</h3>
          <div className="seg" role="group" aria-label="나누는 방법">
            {MODES.map((m) => (
              <button key={m.key} type="button" aria-pressed={mode === m.key} onClick={() => { setMode(m.key); setOutputs([]); }}>{m.label}</button>
            ))}
          </div>

          {mode === "every" ? (
            <label>
              몇 쪽씩 나눌까요?
              <input type="number" inputMode="numeric" min={1} max={total} value={every} onChange={(e) => { setEvery(e.target.value); setOutputs([]); }} />
            </label>
          ) : (
            <label>
              {mode === "ranges" ? "쪽 범위 (쉼표로 나눈 범위마다 파일 하나)" : "뽑을 쪽 (모두 한 파일로 묶음)"}
              <input value={ranges} placeholder="예: 1-3, 5, 8-" onChange={(e) => { setRanges(e.target.value); setOutputs([]); }} />
            </label>
          )}
          <p className="note-sm">
            {plan?.ok
              ? mode === "extract"
                ? `${plan.groups[0].length}쪽을 담은 파일 1개가 만들어집니다.`
                : `파일 ${fileCount}개가 만들어집니다: ${plan.groups.slice(0, 6).map(groupLabel).join(", ")}${fileCount > 6 ? " …" : ""}`
              : plan?.error}
          </p>
          {tooMany && <p className="warn">파일이 100개를 넘으면 하나씩 내려받기 번거롭습니다. 나누는 단위를 키워 보세요.</p>}
        </>
      )}

      <div className="actions">
        <button type="button" className="btn sm" disabled={!plan?.ok || tooMany || !!busy} onClick={run}>
          {busy ? "처리 중…" : mode === "extract" ? "선택한 쪽 뽑기" : "나누기"}
        </button>
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}</p>}
        {error && <p className="warn">{error}</p>}
        {outputs.length > 0 && (
          <ul className="filelist">
            {outputs.map((o) => (
              <li key={o.url}>
                <span className="fname">
                  <b>{o.name}</b>
                  <small>{o.pages}쪽 · {formatBytes(o.size)}</small>
                </span>
                <a className="btn sm" href={o.url} download={o.name}>내려받기</a>
              </li>
            ))}
          </ul>
        )}
        <p className="note">파일은 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다. 나눈 파일은 각각 내려받으세요.</p>
      </div>
    </div>
  );
}
