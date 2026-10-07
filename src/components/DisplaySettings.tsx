"use client";
import { useEffect, useRef, useState } from "react";

type Size = "md" | "lg" | "xl";
type Theme = "system" | "light" | "dark";
const KEY = "nl-display";

const SIZES: { v: Size; label: string }[] = [
  { v: "md", label: "보통" },
  { v: "lg", label: "크게" },
  { v: "xl", label: "아주 크게" },
];
const THEMES: { v: Theme; label: string }[] = [
  { v: "system", label: "기기 설정" },
  { v: "light", label: "밝게" },
  { v: "dark", label: "어둡게" },
];

// <html>에 반영합니다. 첫 화면 깜빡임을 막는 같은 처리가 layout.tsx의 인라인 스크립트에도 있습니다.
function apply(size: Size, theme: Theme) {
  const el = document.documentElement;
  if (size === "md") el.removeAttribute("data-fs");
  else el.setAttribute("data-fs", size);
  if (theme === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", theme);
}

export default function DisplaySettings() {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<Size>("md");
  const [theme, setTheme] = useState<Theme>("system");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (SIZES.some((s) => s.v === saved.size)) setSize(saved.size);
      if (THEMES.some((t) => t.v === saved.theme)) setTheme(saved.theme);
    } catch {
      // 저장소를 쓸 수 없으면 기본값으로 둡니다.
    }
  }, []);

  const save = (s: Size, t: Theme) => {
    setSize(s);
    setTheme(t);
    apply(s, t);
    try {
      localStorage.setItem(KEY, JSON.stringify({ size: s, theme: t }));
    } catch {
      // 저장하지 못해도 이번 방문에는 적용됩니다.
    }
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="display" ref={box}>
      <button type="button" className="display-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        글자·화면 설정
      </button>
      {open && (
        <div className="display-pop" role="dialog" aria-label="글자·화면 설정">
          <p>글자 크기</p>
          <div className="seg">
            {SIZES.map((s) => (
              <button key={s.v} type="button" aria-pressed={size === s.v} onClick={() => save(s.v, theme)}>{s.label}</button>
            ))}
          </div>
          <p>화면</p>
          <div className="seg">
            {THEMES.map((t) => (
              <button key={t.v} type="button" aria-pressed={theme === t.v} onClick={() => save(size, t.v)}>{t.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
