// 숨긴 도구(HIDDEN_TOOLS)는 메뉴·검색·사이드바에 넣지 않습니다.
import { CATEGORIES, listedTools as tools, type Category } from "@/data/tools";

// 메뉴·검색·사이드바에서 함께 쓰는 도구 목록. 계산기 페이지(/tools/*)와 모임 정산(/moim), 로또 당첨번호 조회(/lotto)를 한데 모읍니다.
export type NavItem = { href: string; title: string; short: string; category: Category };

// 분류 안에서 맨 아래에 이 순서로 둘 항목
const LAST = ["/lotto", "/tools/lotto-simulator"];

const items: NavItem[] = [
  ...tools.map((t) => ({ href: `/tools/${t.slug}`, title: t.title, short: t.short, category: t.category })),
  {
    href: "/moim",
    title: "모임 정산 계산기",
    short: "1차·2차 참석과 술값까지 나눠 각자 보낼 돈과 최소 송금 목록을 계산합니다.",
    category: "생활",
  },
  {
    href: "/lotto",
    title: "로또 당첨번호 조회",
    short: "최신 회차 당첨번호와 당첨금, 1등 배출점, 1회부터 전체 당첨번호를 확인합니다.",
    category: "생활",
  },
];

// 도구가 아닌 페이지 중 메뉴·검색·사이드바에서 빼 둔 것. 로또 당첨번호 조회는 애드센스 심사 동안 숨깁니다(대표 결정 2026-11-23).
// 페이지는 그대로 있어 주소로 들어오면 쓸 수 있고, noindex(src/app/lotto/page.tsx)이며 사이트맵에서도 뺐습니다.
export const HIDDEN_PAGES: readonly string[] = ["/lotto"];

// 원래 순서를 지키면서 LAST 항목만 뒤로 보냅니다(정렬은 안정적이라 나머지 순서는 그대로).
export const navItems = items
  .filter((i) => !HIDDEN_PAGES.includes(i.href))
  .sort((a, b) => LAST.indexOf(a.href) - LAST.indexOf(b.href));

export const navGroups = CATEGORIES.map((category) => ({
  category,
  items: navItems.filter((i) => i.category === category),
}));
