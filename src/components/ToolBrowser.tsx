"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, type Category } from "@/data/tools";
import { navItems } from "@/data/nav";

// 홈과 /tools에서 쓰는 도구 검색·분류 필터·카드 목록
export default function ToolBrowser() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");

  const q = query.trim().toLowerCase();
  const matched = useMemo(
    () => navItems.filter((i) => !q || i.title.toLowerCase().includes(q) || i.short.toLowerCase().includes(q)),
    [q]
  );
  const shown = cat === "all" ? matched : matched.filter((i) => i.category === cat);

  return (
    <section className="browser" aria-label="계산기 찾기">
      <label className="search">
        <span>계산기 검색</span>
        <input
          type="search"
          value={query}
          placeholder="예: 연봉, 퇴직금, 대출, 월세, D-day"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="chips filter" role="group" aria-label="분류">
        <button type="button" aria-pressed={cat === "all"} onClick={() => setCat("all")}>
          전체 <span className="count">{matched.length}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c} <span className="count">{matched.filter((i) => i.category === c).length}</span>
          </button>
        ))}
      </div>

      <div className="list-head">
        <h2>계산기 목록</h2>
        <span className="note-sm" aria-live="polite">{shown.length}개</span>
      </div>
      {shown.length === 0 ? (
        <p className="note">찾는 계산기가 없습니다. 다른 낱말로 검색해 보세요.</p>
      ) : (
        <div className="g">
          {shown.map((i) => (
            <Link key={i.href} href={i.href} className="c">
              <span className="badge">{i.category}</span>
              <h3>{i.title}</h3>
              <p>{i.short}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
