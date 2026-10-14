import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: { absolute: `Privacy Policy | ${site.nameEn}` },
  description: `How ${site.nameEn} (${site.domain}) handles your information. Files and values you use with our tools are processed in your browser and never uploaded.`,
  alternates: { canonical: "/en/privacy", languages: { ko: "/privacy", en: "/en/privacy" } },
  openGraph: { siteName: site.nameEn, locale: "en_US", type: "website", url: "/en/privacy" },
};

// 한국어 개인정보처리방침(/privacy)의 영어판. 내용을 바꿀 때는 두 페이지를 함께 고칩니다.
export default function PrivacyEn() {
  return (
    <div className="w page" lang="en">
      <h1>Privacy Policy</h1>
      <p>
        {site.nameEn} ({site.domain}, also operated in Korean as {site.name}; the &quot;Site&quot;) values your privacy and handles your information as described below.
      </p>

      <h2>1. Information we collect</h2>
      <p>
        Files you open in our tools (PDFs, images, videos and so on) and values you enter in calculators are processed only in your own browser. They are never sent to or stored on our servers. When a tool needs extra resources, such as an AI model or an encoder, it downloads them from this Site, but your files and inputs stay on your device. If you contact us by email, we use your email address and message only to reply to you.
      </p>

      <h2>2. Cookies and advertising</h2>
      <p>
        The Site may use cookies to improve the service and to show ads. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites. Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on your visits to this Site and/or other sites on the Internet.
      </p>
      <p>
        You can opt out of personalized advertising in{" "}
        <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>, or opt out of third-party vendors&apos; cookies for personalized advertising at{" "}
        <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer">www.aboutads.info</a>. To learn how Google uses data, see{" "}
        <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">How Google uses information from sites or apps that use its services</a>. You can also block cookies in your browser settings, although some features may not work properly.
      </p>

      <h2>3. Visit statistics</h2>
      <p>We may use analytics tools to understand the number of visits and how pages are used. This information is aggregated in a form that does not identify individuals.</p>

      <h2>4. Retention and deletion</h2>
      <p>Emails you send us are deleted without delay once your inquiry has been handled, except where retention is required by law.</p>

      <h2>5. Contact</h2>
      <p>For questions about your privacy, please email <a href={`mailto:${site.email}`}>{site.email}</a>.</p>

      <p className="note">
        Effective date: October 6, 2026. This is an English translation of the <Link href="/privacy" hrefLang="ko">Korean privacy policy</Link>. If the two versions differ, the Korean version prevails.
      </p>
    </div>
  );
}
