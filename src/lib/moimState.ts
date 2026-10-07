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

const bytesToB64Url = (bytes: Uint8Array) => {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64UrlToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

// 예전 형식(#d=): 상태 JSON을 그대로 base64url로 담습니다. 이미 공유된 링크를 열기 위해 남겨 둡니다.
export const encodeState = (s: MoimState) => bytesToB64Url(new TextEncoder().encode(JSON.stringify(s)));

// 새 형식(#z=): 키 이름을 빼고 배열로 줄인 뒤 deflate로 압축합니다. 참석·음주는 비트마스크로 담습니다.
const toMask = (list: number[]) => list.reduce((m, i) => m | (1 << i), 0);
const fromMask = (m: unknown, n: number) =>
  typeof m === "number" ? Array.from({ length: n }, (_, i) => i).filter((i) => (m >>> i) & 1) : [];

const compact = (s: MoimState) => [
  1,
  s.title,
  s.bank,
  s.members,
  s.rounds.map((r) => [r.place, r.amount, r.alcohol, r.payer, toMask(r.attendees), toMask(r.drinkers)]),
  s.sent,
  s.round100 ? 1 : 0,
];

function expand(a: unknown): unknown {
  if (!Array.isArray(a) || a[0] !== 1) return null;
  const members = Array.isArray(a[3]) ? a[3] : [];
  const n = Math.min(members.length, LIMITS.members);
  return {
    title: a[1],
    bank: a[2],
    members,
    rounds: (Array.isArray(a[4]) ? a[4] : []).map((r: unknown) => {
      const x = Array.isArray(r) ? r : [];
      return { place: x[0], amount: x[1], alcohol: x[2], payer: x[3], attendees: fromMask(x[4], n), drinkers: fromMask(x[5], n) };
    }),
    sent: a[5],
    round100: a[6] === 1,
  };
}

const canCompress = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
const MAX_INFLATED = 64 * 1024; // 압축 해제 크기 상한(압축 폭탄 방지)

async function deflate(text: string) {
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array<ArrayBuffer>) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_INFLATED) {
      await reader.cancel();
      throw new Error("too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return new TextDecoder().decode(out);
}

// 공유 링크의 # 뒤에 붙일 문자열. 압축을 지원하지 않는 브라우저에서는 예전 형식으로 만듭니다.
export async function encodeLink(s: MoimState) {
  if (!canCompress()) return `d=${encodeState(s)}`;
  return `z=${bytesToB64Url(await deflate(JSON.stringify(compact(s))))}`;
}

const str = (v: unknown, max = LIMITS.text) => (typeof v === "string" ? v.slice(0, max) : "");
const int = (v: unknown, max = 100_000_000) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(Math.round(v), 0), max) : 0;
const idxList = (v: unknown, n: number) =>
  Array.isArray(v) ? [...new Set(v.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < n))] : [];

// 링크에서 읽은 값은 믿을 수 없으므로 형태와 범위를 모두 다시 맞춥니다.
function normalize(raw: unknown): MoimState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r0 = raw as Record<string, unknown>;
  const members = (Array.isArray(r0.members) ? r0.members : []).slice(0, LIMITS.members).map((x: unknown) => str(x, 20));
  const n = members.length;
  const rounds = (Array.isArray(r0.rounds) ? r0.rounds : []).slice(0, LIMITS.rounds).map((r: Record<string, unknown>) => {
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
    title: str(r0.title, 40),
    bank: str(r0.bank, 80),
    members,
    rounds,
    sent: (Array.isArray(r0.sent) ? r0.sent : []).slice(0, 100).map((x: unknown) => str(x, 50)),
    round100: r0.round100 === true,
  };
}

// 예전 형식(#d=) 해석
export function decodeState(hash: string): MoimState | null {
  const m = /(?:^|[#&])d=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    return normalize(JSON.parse(new TextDecoder().decode(b64UrlToBytes(m[1]))));
  } catch {
    return null;
  }
}

// 새 형식(#z=)과 예전 형식(#d=)을 모두 읽습니다.
export async function decodeLink(hash: string): Promise<MoimState | null> {
  const z = /(?:^|[#&])z=([A-Za-z0-9_-]+)/.exec(hash);
  if (!z) return decodeState(hash);
  if (!canCompress()) return null;
  try {
    return normalize(expand(JSON.parse(await inflate(b64UrlToBytes(z[1])))));
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
