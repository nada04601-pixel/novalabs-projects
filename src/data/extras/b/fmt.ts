// 묶음 b 보강 글에서 같이 쓰는 숫자·날짜 표시 도우미. 계산은 모두 이 사이트의 계산기 함수로 하고 여기서는 보기 좋게만 바꿉니다.

export const n = (v: number) => Math.round(v).toLocaleString("ko-KR");
export const won = (v: number) => `${n(v)}원`;
export const man = (v: number) => `${n(v / 10_000)}만 원`;
export const pct = (r: number, d = 1) => `${(r * 100).toFixed(d)}%`;

const DAY = 86_400_000;
const toUtc = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const toStr = (t: number) => new Date(t).toISOString().slice(0, 10);

// "2026-10-01" → "2026년 10월 1일"
export const ko = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
};

// "2026-10-01" → "10월 1일"
export const koMD = (s: string) => {
  const [, m, d] = s.split("-").map(Number);
  return `${m}월 ${d}일`;
};

// 날짜 문자열에 일수를 더합니다(음수면 뺍니다).
export const addDays = (s: string, k: number) => toStr(toUtc(s) + k * DAY);

// 같은 날짜의 n개월 전(평균임금 산정 기간 시작일 계산용)
export const monthsBefore = (s: string, k: number) => {
  const [y, m, d] = s.split("-").map(Number);
  return toStr(Date.UTC(y, m - 1 - k, d));
};
