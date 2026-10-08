"use client";
import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/tools/fileSize";
import { move, PDF_MAX_BYTES, pdfBlob, pdfErrorMessage, pdfName } from "@/lib/tools/pdfPlan";

type Item = { id: number; file: File; pages: number | null; error: string };
type Result = { url: string; name: string; size: number; pages: number };

const MAX_FILES = 50;

export default function PdfMerger() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const nextId = useRef(1);

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setResult(null);
    setError("");
    const picked = Array.from(list);
    const room = MAX_FILES - items.length;
    if (picked.length > room) setError(`한 번에 최대 ${MAX_FILES}개까지 합칠 수 있습니다.`);
    const fresh: Item[] = picked.slice(0, Math.max(0, room)).map((file) => ({
      id: nextId.current++,
      file,
      pages: null,
      error: file.size > PDF_MAX_BYTES ? `${formatBytes(PDF_MAX_BYTES)}를 넘는 파일입니다.` : "",
    }));
    setItems((prev) => [...prev, ...fresh]);
    // 쪽수를 읽으면서 열 수 없는 파일(암호, 손상)을 미리 걸러 둡니다.
    const { pageCount } = await import("@/lib/tools/pdfPages");
    for (const it of fresh) {
      if (it.error) continue;
      let patch: Partial<Item>;
      try {
        patch = { pages: await pageCount(await it.file.arrayBuffer()) };
      } catch (e) {
        patch = { error: pdfErrorMessage(e) };
      }
      setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, ...patch } : p)));
    }
  };

  const update = (next: Item[]) => {
    setItems(next);
    setResult(null);
  };

  const ready = items.filter((i) => !i.error && i.pages !== null);
  const loading = items.some((i) => !i.error && i.pages === null);
  const totalPages = ready.reduce((s, i) => s + (i.pages ?? 0), 0);

  const run = async () => {
    if (ready.length < 2) return;
    setError("");
    setResult(null);
    setBusy("파일을 합치는 중…");
    try {
      const { mergePdfs } = await import("@/lib/tools/pdfPages");
      const bytes = await mergePdfs(await Promise.all(ready.map((i) => i.file.arrayBuffer())));
      const blob = pdfBlob(bytes);
      setResult({ url: URL.createObjectURL(blob), name: pdfName(ready[0].file.name, "합본"), size: blob.size, pages: totalPages });
    } catch (e) {
      setError(pdfErrorMessage(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="calc">
      <label className="drop">
        <input type="file" accept="application/pdf,.pdf" multiple onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <span>{items.length ? "PDF 파일 더 추가하기" : "합칠 PDF 파일을 고르세요 (여러 개 선택 가능)"}</span>
      </label>

      {items.length > 0 && (
        <>
          <div className="list-head">
            <h3 className="sub">합칠 순서</h3>
            <button
              type="button"
              className="link"
              onClick={() => update([...items].sort((a, b) => a.file.name.localeCompare(b.file.name, "ko", { numeric: true })))}
            >
              파일 이름순 정렬
            </button>
          </div>
          <ol className="filelist">
            {items.map((it, i) => (
              <li key={it.id} className={it.error ? "bad" : undefined}>
                <span className="fname">
                  <b>{it.file.name}</b>
                  <small>
                    {formatBytes(it.file.size)}
                    {it.pages !== null && ` · ${it.pages}쪽`}
                    {!it.error && it.pages === null && " · 읽는 중…"}
                  </small>
                  {it.error && <small className="err">{it.error} 합칠 때 제외됩니다.</small>}
                </span>
                <span className="ctrl">
                  <button type="button" aria-label={`${it.file.name} 위로`} disabled={i === 0} onClick={() => update(move(items, i, -1))}>↑</button>
                  <button type="button" aria-label={`${it.file.name} 아래로`} disabled={i === items.length - 1} onClick={() => update(move(items, i, 1))}>↓</button>
                  <button type="button" aria-label={`${it.file.name} 빼기`} onClick={() => update(items.filter((x) => x.id !== it.id))}>✕</button>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="actions">
        <button type="button" className="btn sm" disabled={ready.length < 2 || loading || !!busy} onClick={run}>
          {busy ? "처리 중…" : ready.length >= 2 ? `${ready.length}개 파일 합치기 (${totalPages}쪽)` : "PDF 합치기"}
        </button>
      </div>

      <div className="result" aria-live="polite">
        {ready.length === 1 && !loading && <p className="note">파일을 2개 이상 고르면 합칠 수 있습니다.</p>}
        {busy && <p className="note" role="status">{busy}</p>}
        {error && <p className="warn">{error}</p>}
        {result && (
          <>
            <div className="big">
              <span>합친 파일</span>
              <strong>{result.pages}쪽</strong>
              <small>{result.name} · {formatBytes(result.size)}</small>
            </div>
            <div className="actions">
              <a className="btn sm" href={result.url} download={result.name}>합친 PDF 내려받기</a>
            </div>
          </>
        )}
        <p className="note">파일은 서버로 올라가지 않고 이 브라우저 안에서만 처리됩니다. 위아래 화살표로 순서를 바꾼 뒤 합치세요.</p>
      </div>
    </div>
  );
}
