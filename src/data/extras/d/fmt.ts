// 묶음 d에서 함께 쓰는 숫자 표기 도우미. 금액은 모두 계산 결과를 이 함수로 글자로 바꿉니다.

export const n = (v: number) => Math.round(v).toLocaleString("ko-KR");

// 원 단위 금액: 186,500원
export const won = (v: number) => `${n(v)}원`;

// 요율: 0.004 → 0.4%, 0.05 → 5%, 0.0275 → 2.75%
export const pr = (r: number) => `${Number((r * 100).toFixed(2))}%`;

// 큰 금액을 억·만 단위로: 350,000,000 → 3억 5,000만 원 (만 원 미만은 반올림)
export const krw = (v: number) => {
  const r = Math.round(v / 10_000) * 10_000;
  const eok = Math.floor(r / 100_000_000);
  const man = Math.round((r - eok * 100_000_000) / 10_000);
  if (eok === 0) return `${man.toLocaleString("ko-KR")}만 원`;
  return man ? `${eok}억 ${man.toLocaleString("ko-KR")}만 원` : `${eok}억 원`;
};

// 소수 자리 고정: 25.4
export const fx = (v: number, d = 1) => v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });

// 한국은행 기준금리(연). 2026년 11월 26일 연 3.25%로 변경(직전 3.00%, 2026-08-27부터), 2026년 11월 27일 한국은행 누리집에서 확인.
// 금리가 바뀌면 아래 세 값만 고치면 묶음 d의 전월세 전환 표와 문장이 함께 바뀝니다.
export const BASE_RATE = 0.0325;
export const BASE_RATE_CHANGED = "2026년 11월 26일";
export const BASE_RATE_CHECKED = "2026년 11월 27일";
