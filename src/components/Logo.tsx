import Link from "next/link";
import { site } from "@/data/site";

// 로고: 계산기 버튼을 단순화한 심볼 + "노바랩" + 강조색 "계산소"
export default function Logo() {
  return (
    <Link href="/" className="logo" aria-label={`${site.name} 홈`}>
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--acc)" />
        <path d="M10 11.5h5M12.5 9v5M18 11.5h4.5M10 20.5l4 4M14 20.5l-4 4M18 20h4.5M18 23.5h4.5" stroke="var(--accfg)" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className="logo-text">
        노바랩<b>계산소</b>
      </span>
    </Link>
  );
}
