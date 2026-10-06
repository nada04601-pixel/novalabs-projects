// 모임 정산 상태를 링크(#d=...)에 담아 서버 없이 공유합니다.

export type MoimRound = {
  place: string;
  amount: number;
  alcohol: number;
  payer: number; // -1이면 미선택
  attendees: number[];
  drinkers: number[];
};

export type MoimState = {
  title: string;
  bank: string; // 받을 계좌·송금 링크(선택)
  members: string[];
  rounds: MoimRound[];
  sent: string[]; // "보낸 사람→받는 사람" 송금 완료 표시
  round100: boolean; // 송금액 100원 단위 올림 표시
};

const LIMITS = { members: 30, rounds: 10, text: 60 };

export const emptyRound = (members: number): MoimRound => ({
  place: "",
  amount: 0,
  alcohol: 0,
  payer: members > 0 ? 0 : -1,
  attendees: Array.from({ length: members }, (_, i) => i),
  drinkers: [],
});

export const sampleState = (): MoimState => ({
  title: "금요일 동창 모임",
  bank: "",
  members: ["민수", "지영", "현우", "수진"],
  rounds: [
    { place: "고깃집", amount: 168_000, alcohol: 48_000, payer: 0, attendees: [0, 1, 2, 3], drinkers: [0, 2, 3] },
    { place: "호프집", amount: 54_000, alcohol: 0, payer: 2, attendees: [0, 2, 3], drinkers: [] },
  ],
  sent: [],
  round100: false,
});

const toB64Url = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export const encodeState = (s: MoimState) => toB64Url(JSON.stringify(s));

const str = (v: unknown, max = LIMITS.text) => (typeof v === "string" ? v.slice(0, max) : "");
const int = (v: unknown, max = 100_000_000) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(Math.round(v), 0), max) : 0;
const idxList = (v: unknown, n: number) =>
  Array.isArray(v) ? [...new Set(v.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < n))] : [];

// 링크에서 읽은 값은 믿을 수 없으므로 형태와 범위를 모두 다시 맞춥니다.
export function decodeState(hash: string): MoimState | null {
  const m = /(?:^|[#&])d=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const raw = JSON.parse(fromB64Url(m[1]));
    if (!raw || typeof raw !== "object") return null;
    const members = (Array.isArray(raw.members) ? raw.members : []).slice(0, LIMITS.members).map((x: unknown) => str(x, 20));
    const n = members.length;
    const rounds = (Array.isArray(raw.rounds) ? raw.rounds : []).slice(0, LIMITS.rounds).map((r: Record<string, unknown>) => {
      const attendees = idxList(r?.attendees, n);
      const payer = Number.isInteger(r?.payer) && (r.payer as number) >= 0 && (r.payer as number) < n ? (r.payer as number) : -1;
      const amount = int(r?.amount);
      return {
        place: str(r?.place, 30),
        amount,
        alcohol: Math.min(int(r?.alcohol), amount),
        payer,
        attendees,
        drinkers: idxList(r?.drinkers, n).filter((i) => attendees.includes(i)),
      };
    });
    return {
      title: str(raw.title, 40),
      bank: str(raw.bank, 80),
      members,
      rounds,
      sent: (Array.isArray(raw.sent) ? raw.sent : []).slice(0, 100).map((x: unknown) => str(x, 50)),
      round100: raw.round100 === true,
    };
  } catch {
    return null;
  }
}

// 참여자를 지우면 차수의 인덱스를 당겨 맞춥니다.
export function removeMember(s: MoimState, k: number): MoimState {
  const shift = (list: number[]) => list.filter((i) => i !== k).map((i) => (i > k ? i - 1 : i));
  return {
    ...s,
    members: s.members.filter((_, i) => i !== k),
    rounds: s.rounds.map((r) => ({
      ...r,
      attendees: shift(r.attendees),
      drinkers: shift(r.drinkers),
      payer: r.payer === k ? -1 : r.payer > k ? r.payer - 1 : r.payer,
    })),
  };
}

export const MOIM_LIMITS = LIMITS;
