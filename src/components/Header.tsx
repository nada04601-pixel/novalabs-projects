"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { navGroups } from "@/data/nav";
import { enGroups } from "@/data/tools.en";
import { langOf, switchPath } from "@/lib/i18n";
import DisplaySettings from "@/components/DisplaySettings";
import Logo from "@/components/Logo";

const MENU = {
  ko: [
    { href: "/", label: "홈" },
    { href: "/about", label: "소개" },
  ],
  en: [{ href: "/en", label: "Home" }],
};

export default function Header() {
  const pathname = usePathname();
  const lang = langOf(pathname);
  const en = lang === "en";
  // 영어 페이지는 영어 버전이 있는 도구만 보여 줍니다.
  const groups = en ? enGroups : navGroups;
  const [open, setOpen] = useState(false);
  const current = groups.findIndex((g) => g.items.some((i) => i.href === pathname));
  const [active, setActive] = useState(Math.max(current, 0));
  const wrap = useRef<HTMLDivElement>(null);

  // 페이지를 옮기면 메뉴를 닫습니다.
  useEffect(() => setOpen(false), [pathname]);

  // 메뉴 바깥을 누르거나 Esc를 누르면 닫습니다.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isTools = pathname.startsWith("/tools") || pathname.startsWith("/en/tools") || pathname === "/moim";
  const group = groups[active] ?? groups[0];

  return (
    <header>
      <div className="w wide top">
        <Logo lang={lang} />
        <div className="top-right">
          <Link className="lang-switch" href={switchPath(pathname, en ? "ko" : "en")} hrefLang={en ? "ko" : "en"} lang={en ? "ko" : "en"}>
            {en ? "한국어" : "English"}
          </Link>
          <DisplaySettings />
        </div>
      </div>
      <div className="w wide menu" ref={wrap}>
        <nav aria-label={en ? "Main menu" : "주 메뉴"}>
          {MENU[lang].map((m) => (
            <Link key={m.href} href={m.href} className={pathname === m.href ? "on" : ""}>{m.label}</Link>
          ))}
          <button
            type="button"
            className={`drop${isTools || open ? " on" : ""}`}
            aria-expanded={open}
            aria-controls="tools-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {en ? "Tools" : "도구함"} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
          </button>
          {!en && <Link href="/guides" className={pathname.startsWith("/guides") ? "on" : ""}>가이드</Link>}
        </nav>

        {open && (
          <div id="tools-menu" className="mega">
            <ul className="mega-cats">
              {groups.map((g, i) => (
                <li key={g.category}>
                  <button
                    type="button"
                    className={i === active ? "on" : ""}
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                  >
                    {g.category}
                    <span className="count">{g.items.length}</span>
                  </button>
                </li>
              ))}
              <li><Link href={en ? "/en" : "/tools"} className="all">{en ? "All tools" : "전체 도구 보기"}</Link></li>
            </ul>
            <div className="mega-items">
              <p className="mega-title">{group.category}</p>
              <ul>
                {group.items.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={i.href === pathname ? "page" : undefined}>{i.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
