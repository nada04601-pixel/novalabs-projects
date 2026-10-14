"use client";
import { useState } from "react";
import { useT } from "@/lib/useT";

// 결과를 텍스트로 복사하는 버튼. 클립보드를 쓸 수 없으면 직접 복사할 수 있게 띄워 줍니다.
export default function CopyButton({ text, label }: { text: () => string; label?: string }) {
  const tr = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn sm"
      onClick={async () => {
        const t = text();
        try {
          await navigator.clipboard.writeText(t);
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } catch {
          window.prompt(tr("아래 내용을 복사하세요", "Copy the text below"), t);
        }
      }}
    >
      {done ? tr("복사했어요", "Copied") : (label ?? tr("결과 복사", "Copy result"))}
    </button>
  );
}
