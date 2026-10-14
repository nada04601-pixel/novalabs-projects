import Link from "next/link";
import { navGroups } from "@/data/nav";
import { enGroups } from "@/data/tools.en";

// 도구 페이지 왼쪽 메뉴. 현재 도구가 속한 분류만 펼쳐 둡니다(<details>라 스크립트 없이 접고 펼 수 있음).
// 영어 페이지는 영어 버전이 있는 도구만 보여 줍니다.
export default function ToolSidebar({ current, lang = "ko" }: { current: string; lang?: "ko" | "en" }) {
  const groups = lang === "en" ? enGroups : navGroups;
  return (
    <aside className="side" aria-label={lang === "en" ? "Tools" : "도구 목록"}>
      <p className="side-title">{lang === "en" ? "Tools" : "도구함"}</p>
      {groups.map((g) => {
        const here = g.items.some((i) => i.href === current);
        return (
          <details key={g.category} open={here}>
            <summary>{g.category}</summary>
            <ul>
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} aria-current={i.href === current ? "page" : undefined}>{i.title}</Link>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </aside>
  );
}
