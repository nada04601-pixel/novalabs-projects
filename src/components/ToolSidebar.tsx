import Link from "next/link";
import { navGroups } from "@/data/nav";

// 계산기 페이지 왼쪽 메뉴. 현재 도구가 속한 분류만 펼쳐 둡니다(<details>라 스크립트 없이 접고 펼 수 있음).
export default function ToolSidebar({ current }: { current: string }) {
  return (
    <aside className="side" aria-label="계산기 목록">
      <p className="side-title">계산기</p>
      {navGroups.map((g) => {
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
