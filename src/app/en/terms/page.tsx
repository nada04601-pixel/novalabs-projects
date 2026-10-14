import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: { absolute: `Terms of Use | ${site.nameEn}` },
  description: `Terms for using the free online tools and content provided by ${site.nameEn} (${site.domain}).`,
  alternates: { canonical: "/en/terms", languages: { ko: "/terms", en: "/en/terms" } },
  openGraph: { siteName: site.nameEn, locale: "en_US", type: "website", url: "/en/terms" },
};

// 한국어 이용약관(/terms)의 영어판. 내용을 바꿀 때는 두 페이지를 함께 고칩니다.
export default function TermsEn() {
  return (
    <div className="w page" lang="en">
      <h1>Terms of Use</h1>
      <p>
        These terms set out the conditions for using the tools, calculators and informational content (the &quot;Service&quot;) provided by {site.nameEn} ({site.domain}, also operated in Korean as {site.name}; the &quot;Site&quot;).
      </p>

      <h2>1. The Service</h2>
      <p>
        The Site provides free online tools, such as PDF, image and video tools, along with calculators and explanatory articles. Anyone can use them without creating an account. The tools run in your browser, and files you use with them are not uploaded to our servers.
      </p>

      <h2>2. Nature of results</h2>
      <p>
        Results produced by the tools and calculators are provided for reference only. Calculator results are estimates based on publicly available laws and rates, and actual amounts may vary with your circumstances, company policies, financial institutions&apos; terms and changes in law. The Site is not legally responsible for decisions you make based on these results, so please check with the relevant authorities or a professional before making important decisions. Keep the original copies of your files, as processed output may differ from what you expect.
      </p>

      <h2>3. Accuracy of content</h2>
      <p>
        We try to keep rates and rules up to date and show the basis and date of review on each calculator. If you find an error, please let us know by email at <a href={`mailto:${site.email}`}>{site.email}</a> and we will review and correct it.
      </p>

      <h2>4. Copyright</h2>
      <p>
        The rights to the Site&apos;s text, design and code belong to the operator. Short quotations with attribution are permitted, but reproducing the content in full or redistributing it commercially requires prior permission. You are responsible for having the right to use any files you process with the tools; for example, do not remove watermarks from or extract audio from other people&apos;s work without permission.
      </p>

      <h2>5. Advertising</h2>
      <p>
        The Site may display third-party ads, such as Google AdSense, to cover operating costs. Advertisers are responsible for the content of their ads and for the products and services they offer.
      </p>

      <h2>6. Changes to these terms</h2>
      <p>When we change these terms, we post them on this page with the effective date.</p>

      <p className="note">
        Effective date: October 6, 2026. This is an English translation of the <Link href="/terms" hrefLang="ko">Korean terms of use</Link>. If the two versions differ, the Korean version prevails.
      </p>
    </div>
  );
}
