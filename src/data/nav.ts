import { CATEGORIES, tools, type Category } from "@/data/tools";

// 메뉴·검색·사이드바에서 함께 쓰는 도구 목록. 계산기 페이지(/tools/*)와 모임 정산(/moim)을 한데 모읍니다.
export type NavItem = { href: string; title: string; short: string; category: Category };

export const navItems: NavItem[] = [
  ...tools.map((t) => ({ href: `/tools/${t.slug}`, title: t.title, short: t.short, category: t.category })),
  {
    href: "/moim",
    title: "모임 정산 계산기",
    short: "1차·2차 참석과 술값까지 나눠 각자 보낼 돈과 최소 송금 목록을 계산합니다.",
    category: "생활",
  },
];

export const navGroups = CATEGORIES.map((category) => ({
  category,
  items: navItems.filter((i) => i.category === category),
}));
