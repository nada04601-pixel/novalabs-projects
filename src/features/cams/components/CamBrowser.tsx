"use client";
// 메인 화면: 분류 탭 + 검색 + 카드 목록 + 지도. 모바일에서는 목록과 지도를 버튼으로 바꿔 봅니다.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Cam, CamCategory } from "../types";
import { CATEGORIES, camHref, cams, filterCams } from "../lib/cams";
import CamCard from "./CamCard";
import CamMap from "./CamMap";
import s from "../cams.module.css";

export default function CamBrowser() {
  const router = useRouter();
  const [category, setCategory] = useState<CamCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<Cam | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const list = useMemo(() => filterCams(cams, category, query), [category, query]);

  return (
    <>
      <div className={s.tabs} role="group" aria-label="분류">
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" className={s.tab} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      <div className={s.bar}>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="장소·지역 검색 (예: 해운대, 제주)" aria-label="장소 검색" />
        <button type="button" className={`${s.btn} ${s.ghost} ${s.viewToggle}`} onClick={() => setView(view === "list" ? "map" : "list")}>
          {view === "list" ? "🗺️ 지도" : "☰ 목록"}
        </button>
      </div>
      <p className={s.count}>{list.length}곳</p>
      <div className={s.layout} data-view={view}>
        <div className={s.grid}>
          {list.map((c) => <CamCard key={c.id} cam={c} on={hover?.id === c.id} onHover={setHover} />)}
          {!list.length && <p className={s.empty}>찾는 장소가 없습니다. 다른 검색어나 분류를 골라 보세요.</p>}
        </div>
        <div className={s.mapBox}>
          <CamMap cams={list} selectedId={hover?.id} onSelect={(c) => router.push(camHref(c))} />
        </div>
      </div>
    </>
  );
}
