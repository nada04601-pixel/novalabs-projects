import Link from "next/link";
import { site } from "@/data/site";

// 로고: 물결 테두리 남색 배지 안에 + ÷ × 와 플라스크, 오른쪽 위 반짝임. 같은 모양이 src/app/icon.svg(파비콘)에도 있습니다.
const BADGE =
  "M20.00 3.30 L21.14 3.54 L22.21 4.20 L23.16 5.11 L24.00 6.08 L24.79 6.89 L25.63 7.42 L26.59 7.64 L27.72 7.62 L29.00 7.53 L30.32 7.55 L31.54 7.84 L32.52 8.48 L33.16 9.46 L33.45 10.68 L33.47 12.00 L33.38 13.28 L33.36 14.41 L33.58 15.37 L34.11 16.21 L34.92 17.00 L35.89 17.84 L36.80 18.79 L37.46 19.86 L37.70 21.00 L37.46 22.14 L36.80 23.21 L35.89 24.16 L34.92 25.00 L34.11 25.79 L33.58 26.63 L33.36 27.59 L33.38 28.72 L33.47 30.00 L33.45 31.32 L33.16 32.54 L32.52 33.52 L31.54 34.16 L30.32 34.45 L29.00 34.47 L27.72 34.38 L26.59 34.36 L25.63 34.58 L24.79 35.11 L24.00 35.92 L23.16 36.89 L22.21 37.80 L21.14 38.46 L20.00 38.70 L18.86 38.46 L17.79 37.80 L16.84 36.89 L16.00 35.92 L15.21 35.11 L14.37 34.58 L13.41 34.36 L12.28 34.38 L11.00 34.47 L9.68 34.45 L8.46 34.16 L7.48 33.52 L6.84 32.54 L6.55 31.32 L6.53 30.00 L6.62 28.73 L6.64 27.59 L6.42 26.63 L5.89 25.79 L5.08 25.00 L4.11 24.16 L3.20 23.21 L2.54 22.14 L2.30 21.00 L2.54 19.86 L3.20 18.79 L4.11 17.84 L5.08 17.00 L5.89 16.21 L6.42 15.37 L6.64 14.41 L6.62 13.27 L6.53 12.00 L6.55 10.68 L6.84 9.46 L7.48 8.48 L8.46 7.84 L9.68 7.55 L11.00 7.53 L12.27 7.62 L13.41 7.64 L14.37 7.42 L15.21 6.89 L16.00 6.08 L16.84 5.11 L17.79 4.20 L18.86 3.54Z";

export function LogoMark({ className = "logo-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="lm-badge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b2a86" />
          <stop offset="1" stopColor="#1b1a5e" />
        </linearGradient>
        <linearGradient id="lm-flask" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path className="logo-badge" d={BADGE} fill="url(#lm-badge)" />
      <g stroke="#fff" strokeWidth="2.3" strokeLinecap="round" fill="none">
        <path d="M10.5 15.5h6M13.5 12.5v6" />
        <path d="M21.5 15.5h6" />
        <path d="M11 24.5l5 5M16 24.5l-5 5" />
      </g>
      <g fill="#fff">
        <circle cx="24.5" cy="12.3" r="1.25" />
        <circle cx="24.5" cy="18.7" r="1.25" />
      </g>
      <path
        d="M23.2 22.3h5.6M24.4 22.3v3.2l-3.1 5.3a1.3 1.3 0 0 0 1.1 2h7.2a1.3 1.3 0 0 0 1.1-2l-3.1-5.3v-3.2"
        fill="none"
        stroke="url(#lm-flask)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M22.6 29.4h7.6l1.1 1.9a1 1 0 0 1-.9 1.5h-8a1 1 0 0 1-.9-1.5Z" fill="url(#lm-flask)" />
      <path d="M34.5 1.6c.4 2.5.9 3 3.4 3.4-2.5.4-3 .9-3.4 3.4-.4-2.5-.9-3-3.4-3.4 2.5-.4 3-.9 3.4-3.4Z" fill="#a78bfa" />
      <path d="M38.2 9.2c.2 1.1.4 1.3 1.5 1.5-1.1.2-1.3.4-1.5 1.5-.2-1.1-.4-1.3-1.5-1.5 1.1-.2 1.3-.4 1.5-1.5Z" fill="#c4b5fd" />
    </svg>
  );
}

export default function Logo() {
  return (
    <Link href="/" className="logo" aria-label={`${site.name} 홈`}>
      <LogoMark />
      <span className="logo-text">
        노바랩<b>계산소</b>
      </span>
    </Link>
  );
}
