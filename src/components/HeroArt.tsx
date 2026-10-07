// 홈 상단 일러스트(장식용). 실제 계산 결과 카드를 겹쳐 보여 줍니다.
// 색은 globals.css의 --art-* 변수를 따라 다크 모드에서도 어울리게 바뀝니다.
const fill = (v: string) => ({ fill: `var(${v})` });

export default function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 520 420" aria-hidden="true" focusable="false">
      <defs>
        <filter id="ha-sh" filterUnits="userSpaceOnUse" x="-40" y="-40" width="600" height="520">
          <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#312e81" floodOpacity=".14" />
        </filter>
        <linearGradient id="ha-blob" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--art-blob1)" }} />
          <stop offset="1" style={{ stopColor: "var(--art-blob2)" }} />
        </linearGradient>
      </defs>

      <circle cx="300" cy="200" r="175" fill="url(#ha-blob)" opacity=".5" />
      <circle cx="120" cy="330" r="60" style={fill("--art-blob1")} opacity=".45" />

      {/* 카드 1: 연봉 실수령액 */}
      <g transform="translate(150 36)" filter="url(#ha-sh)">
        <rect width="300" height="130" rx="18" style={fill("--art-paper")} />
        <rect x="20" y="18" width="34" height="34" rx="10" style={fill("--art-soft")} />
        <text x="37" y="41" textAnchor="middle" fontSize="17" fontWeight="800" fill="#6366f1">₩</text>
        <text x="64" y="32" fontSize="12" style={fill("--art-mut")}>연봉 실수령액</text>
        <text x="64" y="50" fontSize="11" style={fill("--art-faint")}>연봉 5,000만 원 기준</text>
        <text x="20" y="92" fontSize="28" fontWeight="800" letterSpacing="-1" style={fill("--art-text")}>월 3,553,777원</text>
        <rect x="20" y="106" width="260" height="8" rx="4" style={fill("--art-soft")} />
        <rect x="20" y="106" width="222" height="8" rx="4" fill="#4f46e5" />
        <rect x="242" y="106" width="18" height="8" fill="#a5b4fc" />
        <rect x="260" y="106" width="20" height="8" rx="4" fill="#c7d2fe" />
      </g>

      {/* 카드 2: 날짜 계산기 */}
      <g transform="translate(40 196)" filter="url(#ha-sh)">
        <rect width="200" height="118" rx="18" style={fill("--art-paper")} />
        <text x="20" y="34" fontSize="12" style={fill("--art-mut")}>날짜 계산기</text>
        <text x="20" y="80" fontSize="38" fontWeight="800" letterSpacing="-1" fill="#6366f1">D-12</text>
        <text x="20" y="102" fontSize="12" style={fill("--art-faint")}>목표일까지 남은 날</text>
        <rect x="138" y="22" width="44" height="40" rx="10" style={fill("--art-soft")} />
        <rect x="138" y="22" width="44" height="12" rx="6" fill="#a5b4fc" />
      </g>

      {/* 카드 3: 모임 정산 */}
      <g transform="translate(262 196)" filter="url(#ha-sh)">
        <rect width="226" height="168" rx="18" style={fill("--art-paper")} />
        <text x="20" y="34" fontSize="12" style={fill("--art-mut")}>모임 정산 · 송금 3건</text>
        <g fontSize="13" style={fill("--art-text")}>
          <text x="20" y="66">수진 → 민수</text>
          <text x="206" y="66" textAnchor="end" fontWeight="700">64,000원</text>
          <text x="20" y="96">지영 → 민수</text>
          <text x="206" y="96" textAnchor="end" fontWeight="700">30,000원</text>
        </g>
        <g fontSize="13" style={fill("--art-faint")}>
          <text x="20" y="126" textDecoration="line-through">현우 → 민수</text>
          <text x="206" y="126" textAnchor="end" fontWeight="700">10,000원</text>
        </g>
        <rect x="20" y="142" width="74" height="14" rx="7" style={fill("--art-soft")} />
        <text x="57" y="153" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#6366f1">1건 완료</text>
      </g>

      {/* 작은 배지 */}
      <g transform="translate(470 96)" filter="url(#ha-sh)">
        <circle r="22" fill="#4f46e5" />
        <text y="7" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff">%</text>
      </g>
      <g transform="translate(96 150)" filter="url(#ha-sh)">
        <rect x="-24" y="-18" width="48" height="36" rx="10" style={fill("--art-paper")} />
        <path d="M-12 8l7-8 6 5 11-12" fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
