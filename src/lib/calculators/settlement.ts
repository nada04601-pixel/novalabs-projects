// 모임 차수별 정산. 금액은 모두 원 단위 정수로 다룹니다.

export type Round = {
  place: string;
  amount: number; // 차수 결제 금액(술값 포함)
  alcohol: number; // 그중 술값. 마신 사람끼리만 나눕니다(선택)
  payer: number; // 결제한 사람(members 인덱스)
  attendees: number[]; // 참석자
  drinkers: number[]; // 참석자 중 술 마신 사람
};

export type Transfer = { from: number; to: number; amount: number };

export type SettlementResult = {
  share: number[]; // 사람별 부담액
  paid: number[]; // 사람별 실제 결제액
  balance: number[]; // paid − share. +면 받을 돈, −면 낼 돈
  roundShares: number[][]; // [차수][사람] 부담액
  transfers: Transfer[];
  total: number;
};

// amount를 people에게 원 단위로 나누고, 나누어떨어지지 않는 자투리는 sink에게 몹니다.
function split(amount: number, people: number[], sink: number, into: number[]) {
  if (people.length === 0 || amount <= 0) return 0;
  const each = Math.floor(amount / people.length);
  for (const p of people) into[p] += each;
  const rest = amount - each * people.length;
  into[sink] += rest;
  return rest;
}

export function settle(memberCount: number, rounds: Round[]): SettlementResult {
  const n = memberCount;
  const share = new Array(n).fill(0);
  const paid = new Array(n).fill(0);
  const roundShares: number[][] = [];

  for (const r of rounds) {
    const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < n;
    const attendees = [...new Set(r.attendees.filter(valid))];
    const drinkers = [...new Set(r.drinkers.filter((i) => attendees.includes(i)))];
    const amount = Math.max(0, Math.round(r.amount));
    const rs = new Array(n).fill(0);
    if (attendees.length === 0 || amount === 0 || !valid(r.payer)) {
      roundShares.push(rs);
      continue;
    }
    // 마신 사람이 없으면 술값도 참석자 전원이 나눕니다.
    const alcohol = drinkers.length > 0 ? Math.min(Math.max(0, Math.round(r.alcohol)), amount) : 0;
    split(amount - alcohol, attendees, r.payer, rs);
    split(alcohol, drinkers, r.payer, rs);
    rs.forEach((v, i) => (share[i] += v));
    paid[r.payer] += amount;
    roundShares.push(rs);
  }

  const balance = paid.map((p, i) => p - share[i]);
  return {
    share,
    paid,
    balance,
    roundShares,
    transfers: minimizeTransfers(balance),
    total: paid.reduce((a, b) => a + b, 0),
  };
}

// 낼 사람과 받을 사람을 금액이 큰 순으로 짝지어 송금 횟수를 줄입니다.
export function minimizeTransfers(balance: number[]): Transfer[] {
  const debtors = balance.map((b, i) => ({ i, v: -b })).filter((x) => x.v > 0);
  const creditors = balance.map((b, i) => ({ i, v: b })).filter((x) => x.v > 0);
  const transfers: Transfer[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.v - a.v || a.i - b.i);
    creditors.sort((a, b) => b.v - a.v || a.i - b.i);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.v, c.v);
    transfers.push({ from: d.i, to: c.i, amount });
    d.v -= amount;
    c.v -= amount;
    if (d.v === 0) debtors.shift();
    if (c.v === 0) creditors.shift();
  }
  return transfers;
}

// 송금액 표시용 100원 단위 올림
export const ceil100 = (v: number) => Math.ceil(v / 100) * 100;
