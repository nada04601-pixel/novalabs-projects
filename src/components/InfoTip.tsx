"use client";
import { useEffect, useId, useRef, useState } from "react";

// 입력 항목 이름 옆의 ⓘ 버튼. 누르면 설명 팝업을 띄우고, 바깥을 누르거나 Esc를 누르면 닫습니다.
export default function InfoTip({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <span className="tip" ref={box}>
      <button
        ref={btn}
        type="button"
        className="tip-btn"
        aria-label={`${title} 설명 보기`}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          // label 안에 있어도 입력칸으로 초점이 넘어가지 않게 합니다.
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="10" cy="6.2" r="1.15" fill="currentColor" />
          <path d="M10 9v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <span className="tip-pop" id={id} role="dialog" aria-label={title}>
          <span className="tip-head">
            <strong>{title}</strong>
            <button type="button" className="tip-close" aria-label="설명 닫기" onClick={(e) => { e.preventDefault(); setOpen(false); }}>×</button>
          </span>
          <span className="tip-body">{children}</span>
        </span>
      )}
    </span>
  );
}
