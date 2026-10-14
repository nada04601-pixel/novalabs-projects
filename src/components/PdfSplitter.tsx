"use client";
import { useT } from "@/lib/useT";
import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import { chunkPages, groupLabel, parsePageRanges, PDF_MAX_BYTES, pdfBlob, pdfErrorMessage, pdfName, splitZipName } from "@/lib/tools/pdfPlan";
import { uniqueNames, zipStore } from "@/lib/tools/zip";

type Mode = "ranges" | "every" | "extract";
type Output = { url: string; name: string; size: number; pages: number; blob: Blob };

const MODES: { key: Mode; label: string; en: string }[] = [
  { key: "ranges", label: "범위별로 나누기", en: "Split by ranges" },
  { key: "every", label: "n쪽씩 나누기", en: "Every N pages" },
  { key: "extract", label: "원하는 쪽만 뽑기", en: "Extract pages" },
];

export default function PdfSplitter() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState<Mode>("ranges");
  const [ranges, setRanges] = useState("");
  const [every, setEvery] = useState("1");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [zip, setZip] = useState<{ url: string; name: string; size: number } | null>(null);

  useEffect(() => () => outputs.forEach((o) => URL.revokeObjectURL(o.url)), [outputs]);
  useEffect(() => () => { if (zip) URL.revokeObjectURL(zip.url); }, [zip]);
  // 나눈 결과가 바뀌면 예전 ZIP은 버립니다.
  useEffect(() => setZip(null), [outputs]);

  const pick = async (f: File | null) => {
    setOutputs([]);
    setError("");
    setFile(null);
    setTotal(0);
    if (!f) return;
    if (f.size > PDF_MAX_BYTES) {
      setError(t(`파일이 너무 큽니다. ${formatBytes(PDF_MAX_BYTES)} 이하의 PDF만 처리할 수 있습니다.`, `The file is too large. Only PDFs up to ${formatBytes(PDF_MAX_BYTES)} can be processed.`));
      return;
    }
    setBusy(t("파일을 읽는 중…", "Reading the file…"));
    try {
      const { pageCount } = await import("@/lib/tools/pdfPages");
      const n = await pageCount(await f.arrayBuffer());
      setFile(f);
      setTotal(n);
      setRanges(n > 1 ? `1-${Math.ceil(n / 2)}, ${Math.ceil(n / 2) + 1}-${n}` : "1");
    } catch (e) {
      setError(pdfErrorMessage(e, t.lang));
    } finally {
      setBusy("");
    }
  };

  // 지금 설정으로 만들어질 묶음. 입력이 잘못됐으면 오류 문구를 돌려줍니다.
  const plan = (() => {
    if (!total) return null;
    if (mode === "every") {
      const n = Number(every);
      if (!Number.isInteger(n) || n < 1) return { ok: false as const, error: t("1 이상의 정수를 입력하세요.", "Enter a whole number of 1 or more.") };
      return { ok: true as const, groups: chunkPages(total, n) };
    }
    const r = parsePageRanges(ranges, total, t.lang);
    return r.ok && mode === "extract" ? { ok: true as const, groups: [r.groups.flat()] } : r;
  })();

  const run = async () => {
    if (!file || !plan?.ok) return;
    setError("");
    setOutputs([]);
    setBusy(t("나누는 중…", "Splitting…"));
    try {
      const { splitPdf } = await import("@/lib/tools/pdfPages");
      const parts = await splitPdf(await file.arrayBuffer(), plan.groups);
      const names = uniqueNames(plan.groups.map((g) => pdfName(file.name, mode === "extract" ? t("추출", "extracted") : groupLabel(g, t.lang), t.lang)));
      setOutputs(parts.map((bytes, i) => {
        const blob = pdfBlob(bytes);
        return { url: URL.createObjectURL(blob), name: names[i], size: blob.size, pages: plan.groups[i].length, blob };
      }));
    } catch (e) {
      setError(pdfErrorMessage(e, t.lang));
    } finally {
      setBusy("");
    }
  };

  const makeZip = async () => {
    if (!file || outputs.length < 2) return;
    setBusy(t("ZIP 파일로 묶는 중…", "Creating ZIP…"));
    try {
      const entries = await Promise.all(outputs.map(async (o) => ({ name: o.name, data: new Uint8Array(await o.blob.arrayBuffer()) })));
      const blob = new Blob([zipStore(entries)], { type: "application/zip" });
      setZip({ url: URL.createObjectURL(blob), name: splitZipName(file.name, t.lang), size: blob.size });
    } catch {
      setError(t("ZIP 파일을 만들지 못했습니다. 메모리가 부족할 수 있으니 파일을 하나씩 내려받아 주세요.", "Couldn't create the ZIP file. The device may be low on memory - please download the files one by one."));
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
        <span>{file ? t(`${file.name} (${formatBytes(file.size)} · ${total}쪽)`, `${file.name} (${formatBytes(file.size)} · ${total} pages)`) : t("나눌 PDF 파일을 고르세요", "Choose a PDF file to split")}</span>
      </label>

      {file && (
        <>
          <h3 className="sub">{t("나누는 방법", "How to split")}</h3>
          <div className="seg" role="group" aria-label={t("나누는 방법", "How to split")}>
            {MODES.map((m) => (
              <button key={m.key} type="button" aria-pressed={mode === m.key} onClick={() => { setMode(m.key); setOutputs([]); }}>{t(m.label, m.en)}</button>
            ))}
          </div>

          {mode === "every" ? (
            <label>
              {t("몇 쪽씩 나눌까요?", "Pages per file")}
              <input type="number" inputMode="numeric" min={1} max={total} value={every} onChange={(e) => { setEvery(e.target.value); setOutputs([]); }} />
            </label>
          ) : (
            <label>
              {mode === "ranges" ? t("쪽 범위 (쉼표로 나눈 범위마다 파일 하나)", "Page ranges (one file per comma-separated range)") : t("뽑을 쪽 (모두 한 파일로 묶음)", "Pages to extract (all in one file)")}
              <input value={ranges} placeholder={t("예: 1-3, 5, 8-", "e.g. 1-3, 5, 8-")} onChange={(e) => { setRanges(e.target.value); setOutputs([]); }} />
            </label>
          )}
          <p className="note-sm">
            {plan?.ok
              ? mode === "extract"
                ? t(`${plan.groups[0].length}쪽을 담은 파일 1개가 만들어집니다.`, `1 file with ${plan.groups[0].length} pages will be created.`)
                : t(`파일 ${fileCount}개가 만들어집니다: `, `${fileCount} files will be created: `) +
                  `${plan.groups.slice(0, 6).map((g) => groupLabel(g, t.lang)).join(", ")}${fileCount > 6 ? " …" : ""}`
              : plan?.error}
          </p>
          {tooMany && <p className="warn">{t("한 번에 100개까지 나눌 수 있습니다. 나누는 단위를 키워 보세요.", "Up to 100 files can be created at once. Try larger chunks.")}</p>}
        </>
      )}

      <div className="actions">
        <button type="button" className="btn sm" disabled={!plan?.ok || tooMany || !!busy} onClick={run}>
          {busy ? t("처리 중…", "Working…") : mode === "extract" ? t("선택한 쪽 뽑기", "Extract pages") : t("나누기", "Split")}
        </button>
      </div>

      <div className="result" aria-live="polite">
        {busy && <p className="note" role="status">{busy}</p>}
        {error && <p className="warn">{error}</p>}
        {outputs.length > 1 && !busy && (
          <div className="actions">
            {zip
              ? <a className="btn sm" href={zip.url} download={zip.name}>{t("ZIP 내려받기", "Download ZIP")} ({formatBytes(zip.size)})</a>
              : <button type="button" className="btn sm" onClick={makeZip}>{t(`${outputs.length}개 모두 ZIP으로 묶기`, `Bundle all ${outputs.length} as ZIP`)}</button>}
          </div>
        )}
        {outputs.length > 0 && (
          <ul className="filelist">
            {outputs.map((o) => (
              <li key={o.url}>
                <span className="fname">
                  <b>{o.name}</b>
                  <small>{t(`${o.pages}쪽`, `${o.pages} pages`)} · {formatBytes(o.size)}</small>
                </span>
                <a className="btn sm" href={o.url} download={o.name}>{t("내려받기", "Download")}</a>
              </li>
            ))}
          </ul>
        )}
        <p className="note">{t("파일은 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다. 나눈 파일은 하나씩 받거나 ZIP 파일 하나로 묶어 받을 수 있습니다.", "Files are processed only in this browser and never uploaded. Download the split files one by one or as a single ZIP.")}</p>
      </div>
    </div>
  );
}
