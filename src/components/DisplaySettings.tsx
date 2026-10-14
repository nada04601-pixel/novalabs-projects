"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/useT";

type Size = "md" | "lg" | "xl";
type Theme = "system" | "light" | "dark";
const KEY = "nl-display";

const SIZES: { v: Size; label: string; en: string }[] = [
  { v: "md", label: "보통", en: "Normal" },
  { v: "lg", label: "크게", en: "Large" },
  { v: "xl", label: "아주 크게", en: "Extra large" },
];
const THEMES: { v: Theme; label: string; en: string }[] = [
  { v: "system", label: "기기 설정", en: "System" },
  { v: "light", label: "밝게", en: "Light" },
  { v: "dark", label: "어둡게", en: "Dark" },
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
  const t = useT();
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
        {t("글자·화면 설정", "Display")}
      </button>
      {open && (
        <div className="display-pop" role="dialog" aria-label={t("글자·화면 설정", "Display settings")}>
          <p>{t("글자 크기", "Text size")}</p>
          <div className="seg">
            {SIZES.map((s) => (
              <button key={s.v} type="button" aria-pressed={size === s.v} onClick={() => save(s.v, theme)}>{t(s.label, s.en)}</button>
            ))}
          </div>
          <p>{t("화면", "Theme")}</p>
          <div className="seg">
            {THEMES.map((th) => (
              <button key={th.v} type="button" aria-pressed={theme === th.v} onClick={() => save(size, th.v)}>{t(th.label, th.en)}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
