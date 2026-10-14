import { CATEGORIES, tools, type Category } from "@/data/tools";

// 메뉴·검색·사이드바에서 함께 쓰는 도구 목록. 계산기 페이지(/tools/*)와 모임 정산(/moim), 로또 당첨번호 조회(/lotto)를 한데 모읍니다.
export type NavItem = { href: string; title: string; short: string; category: Category };

export const navItems: NavItem[] = [
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

export const navGroups = CATEGORIES.map((category) => ({
  category,
  items: navItems.filter((i) => i.category === category),
}));
