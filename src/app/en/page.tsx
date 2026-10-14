import type { Metadata } from "next";
import Link from "next/link";
import { enGroups, toolsEn } from "@/data/tools.en";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: { absolute: `${site.nameEn} - Free Online PDF, Image & Video Tools in Your Browser` },
  description: site.descriptionEn,
  alternates: { canonical: "/en", languages: { ko: "/", en: "/en", "x-default": "/" } },
  openGraph: { siteName: site.nameEn, locale: "en_US", type: "website", url: "/en" },
};

// 영어 홈: 영어 버전이 있는 도구를 분류별로 보여 줍니다.
export default function EnHome() {
  return (
    <div className="w wide page" lang="en">
      <h1>Free online tools that run in your browser</h1>
      <p className="lead">
        Compress, merge and split PDFs, upscale images with AI, trim and compress videos, and more: {toolsEn.length} free tools with no sign-up.
        Everything runs on your own device, so your files are never uploaded.
      </p>
      {enGroups.map((g) => (
        <section key={g.category}>
          <h2>{g.category}</h2>
          <div className="g">
            {g.items.map((i) => (
              <Link key={i.href} href={i.href} className="c">
                <h3>{i.title}</h3>
                <p>{i.short}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <p className="note">
        Looking for Korean-specific calculators such as salary, tax and loan tools? Visit the <Link href="/" hrefLang="ko">Korean site</Link>.
      </p>
    </div>
  );
}
