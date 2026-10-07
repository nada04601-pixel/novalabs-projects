// 비밀번호 생성기. 브라우저의 암호학적 난수(crypto.getRandomValues)로 글자를 고릅니다.

export const CHARSETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/~",
} as const;
export type CharsetKey = keyof typeof CHARSETS;

// 손으로 옮겨 적을 때 헷갈리기 쉬운 글자
export const AMBIGUOUS = "Il1|O0o";

export type PasswordOptions = { length: number; sets: CharsetKey[]; excludeAmbiguous: boolean };

// 0 이상 2^32 미만의 정수를 돌려주는 난수원. 테스트에서 바꿔 끼울 수 있게 분리했습니다.
export type RandomSource = () => number;
export const cryptoRandom: RandomSource = () => crypto.getRandomValues(new Uint32Array(1))[0];

// 0 이상 n 미만의 정수를 치우침 없이 고릅니다(나머지 연산의 편향을 거절 샘플링으로 제거).
export function randomInt(n: number, rand: RandomSource = cryptoRandom): number {
  if (n <= 0) throw new Error("n must be positive");
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  for (;;) {
    const x = rand();
    if (x < limit) return x % n;
  }
}

export function pools(opts: PasswordOptions): string[] {
  return opts.sets
    .map((k) => [...CHARSETS[k]].filter((c) => !(opts.excludeAmbiguous && AMBIGUOUS.includes(c))).join(""))
    .filter((p) => p.length > 0);
}

export function generatePassword(opts: PasswordOptions, rand: RandomSource = cryptoRandom): string {
  const ps = pools(opts);
  if (ps.length === 0) return "";
  const length = Math.max(opts.length, ps.length);
  const all = ps.join("");
  // 고른 종류가 최소 한 글자씩은 들어가도록 먼저 하나씩 뽑고, 나머지는 전체에서 뽑습니다.
  const chars = ps.map((p) => p[randomInt(p.length, rand)]);
  while (chars.length < length) chars.push(all[randomInt(all.length, rand)]);
  // 피셔-예이츠 섞기로 '종류별 한 글자'가 앞에 몰리지 않게 합니다.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rand);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// 무작위로 만든 비밀번호의 엔트로피(비트) = 길이 × log2(쓸 수 있는 글자 수)
export function entropyBits(opts: PasswordOptions): number {
  const size = pools(opts).join("").length;
  return size > 1 ? Math.max(opts.length, pools(opts).length) * Math.log2(size) : 0;
}

export function strength(bits: number): { label: string; level: 0 | 1 | 2 | 3 } {
  if (bits < 40) return { label: "약함", level: 0 };
  if (bits < 60) return { label: "보통", level: 1 };
  if (bits < 80) return { label: "강함", level: 2 };
  return { label: "매우 강함", level: 3 };
}
