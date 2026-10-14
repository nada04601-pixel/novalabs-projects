import Link from "next/link";
import { site } from "@/data/site";

type Crumb = { label: string; href?: string };

// 경로 표시와 검색엔진용 BreadcrumbList 구조화 데이터
export default function Breadcrumbs({ items, lang = "ko" }: { items: Crumb[]; lang?: "ko" | "en" }) {
  const all: Crumb[] = [lang === "en" ? { label: "Home", href: "/en" } : { label: "홈", href: "/" }, ...items];
  return (
    <>
      <nav className="crumbs" aria-label={lang === "en" ? "Breadcrumb" : "현재 위치"}>
        <ol>
          {all.map((c, i) => (
            <li key={i}>
              {c.href && i < all.length - 1 ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: all.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: c.label,
              ...(c.href ? { item: `${site.url}${c.href}` } : {}),
            })),
          }),
        }}
      />
    </>
  );
}
