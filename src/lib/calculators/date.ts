// 날짜 문자열(YYYY-MM-DD)을 시간대 영향 없이 다루기 위한 도우미
export const parseDate = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 ? d : null;
};

export const formatDate = (d: Date) => d.toISOString().slice(0, 10);

export const todayKST = () => formatDate(new Date(Date.now() + 9 * 60 * 60 * 1000));

export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

// n개월 뒤 같은 날짜. 그 달에 같은 날이 없으면 말일로 맞춥니다(1월 31일 + 1개월 = 2월 28/29일).
export function addMonths(d: Date, n: number) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

// from부터 to까지 채운 개월 수
export function fullMonths(from: Date, to: Date) {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
  if (addMonths(from, months) > to) months -= 1;
  return Math.max(0, months);
}
