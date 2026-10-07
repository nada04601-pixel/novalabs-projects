"use client";
import { useState } from "react";

// 결과를 텍스트로 복사하는 버튼. 클립보드를 쓸 수 없으면 직접 복사할 수 있게 띄워 줍니다.
export default function CopyButton({ text, label = "결과 복사" }: { text: () => string; label?: string }) {
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
          window.prompt("아래 내용을 복사하세요", t);
        }
      }}
    >
      {done ? "복사했어요" : label}
    </button>
  );
}
