// 주택용 전기요금 계산기. 값과 계산 순서는 한전ON 원문으로 확인했습니다(2026-11-27).
// - 요금표: 한전ON 한글 전기요금표 > 주택용(https://online.kepco.co.kr/PRM004D00). 단가는 2023-05-16 이후 그대로.
// - 기후환경요금 9.0원/kWh(https://online.kepco.co.kr/PRM097D00), 연료비조정단가 2026년 4분기 +5.0원/kWh(한전ON 공지 2026-09-21)
// - 전력산업기반기금: 전기요금의 1천분의 27(전기사업법 시행령 제36조, 2025-07-01부터), 10원 미만 버림
// - 계산 순서·끝수: 한전ON 전기요금계산기 "청구액 계산방법"(https://online.kepco.co.kr/PRM033D00), 기본공급약관 제7조
//   기본요금·전력량요금·기후환경요금·연료비조정요금은 원 미만 버림 → 부가세 10%는 원 미만 반올림 → 기금은 10원 미만 버림 → 청구액 10원 미만 버림
// - 필수사용량 보장공제는 2022년 7월 일반 가구에서 없어졌고, 복지할인 가구의 추가감액으로만 남아 있습니다(여기서는 넣지 않음).

export type Voltage = "low" | "high"; // 주택용 저압 / 고압

type Tier = { basic: number; price: number };
export const TARIFF: Record<Voltage, { tiers: [Tier, Tier, Tier]; superPrice: number }> = {
  low: {
    tiers: [
      { basic: 910, price: 120.0 },
      { basic: 1_600, price: 214.6 },
      { basic: 7_300, price: 307.3 },
    ],
    superPrice: 736.2,
  },
  high: {
    tiers: [
      { basic: 730, price: 105.0 },
      { basic: 1_260, price: 174.0 },
      { basic: 6_060, price: 242.3 },
    ],
    superPrice: 601.3,
  },
};

export const CLIMATE_PRICE = 9.0; // 기후환경요금(원/kWh)
export const FUEL_PRICE_2026Q4 = 5.0; // 연료비조정단가(원/kWh), 분기마다 바뀜
export const VAT_RATE = 0.1;
export const FUND_RATE = 0.027; // 전력산업기반기금
export const SUPER_USER_KWH = 1_000; // 하계·동계에 이보다 많이 쓴 부분은 슈퍼유저 요금

// 하계(7~8월)는 누진 구간이 300·450kWh, 그 밖의 달은 200·400kWh
export const isSummer = (month: number) => month === 7 || month === 8;
// 슈퍼유저 요금은 하계(7~8월)와 동계(12~2월)에만 적용
export const isSuperSeason = (month: number) => isSummer(month) || month === 12 || month === 1 || month === 2;
export const tierBounds = (month: number): [number, number] => (isSummer(month) ? [300, 450] : [200, 400]);

const floor10 = (v: number) => Math.floor(Math.round(v * 100) / 1000) * 10;
// 원 미만 버림(소수 계산 오차 보정). 연료비조정단가가 음수일 때는 0 쪽으로 버립니다.
const floorWon = (v: number) => Math.trunc(Math.round(v * 100) / 100);

export type ElectricityInput = {
  kwh: number; // 한 달 사용량
  month: number; // 사용한 달(1~12)
  voltage: Voltage;
  fuelPrice?: number; // 연료비조정단가(원/kWh). 비우면 2026년 4분기 값
  climatePrice?: number;
};

export type TierUse = { label: string; kwh: number; price: number; amount: number };

export type ElectricityResult = {
  kwh: number;
  tierIndex: 0 | 1 | 2; // 기본요금 구간
  basic: number;
  energyRaw: number; // 원 미만 버리기 전 전력량요금
  energy: number;
  uses: TierUse[];
  climate: number;
  fuel: number;
  subtotal: number; // 전기요금계
  vat: number;
  fund: number;
  bill: number; // 청구액
  superApplied: boolean;
};

export function calcElectricity(input: ElectricityInput): ElectricityResult {
  const kwh = Math.max(0, Math.round(input.kwh));
  const month = Math.min(Math.max(Math.round(input.month), 1), 12);
  const t = TARIFF[input.voltage];
  const [b1, b2] = tierBounds(month);
  const tierIndex: 0 | 1 | 2 = kwh <= b1 ? 0 : kwh <= b2 ? 1 : 2;

  const superApplied = isSuperSeason(month) && kwh > SUPER_USER_KWH;
  const u1 = Math.min(kwh, b1);
  const u2 = Math.min(Math.max(kwh - b1, 0), b2 - b1);
  const u3 = Math.max(kwh - b2, 0) - (superApplied ? kwh - SUPER_USER_KWH : 0);
  const u4 = superApplied ? kwh - SUPER_USER_KWH : 0;
  const uses: TierUse[] = [
    { label: `처음 ${b1}kWh`, kwh: u1, price: t.tiers[0].price, amount: u1 * t.tiers[0].price },
    { label: `${b1 + 1}~${b2}kWh`, kwh: u2, price: t.tiers[1].price, amount: u2 * t.tiers[1].price },
    { label: superApplied ? `${b2 + 1}~${SUPER_USER_KWH}kWh` : `${b2}kWh 초과`, kwh: u3, price: t.tiers[2].price, amount: u3 * t.tiers[2].price },
    ...(superApplied ? [{ label: `${SUPER_USER_KWH}kWh 초과(슈퍼유저)`, kwh: u4, price: t.superPrice, amount: u4 * t.superPrice }] : []),
  ].filter((x) => x.kwh > 0);

  const basic = kwh > 0 ? t.tiers[tierIndex].basic : t.tiers[0].basic;
  const energyRaw = uses.reduce((s, x) => s + x.amount, 0);
  const energy = floorWon(energyRaw);
  const climate = floorWon(kwh * (input.climatePrice ?? CLIMATE_PRICE));
  const fuel = floorWon(kwh * (input.fuelPrice ?? FUEL_PRICE_2026Q4));
  const subtotal = basic + energy + climate + fuel;
  const vat = Math.round(subtotal * VAT_RATE);
  const fund = floor10(subtotal * FUND_RATE);
  const bill = floor10(subtotal + vat + fund);

  return { kwh, tierIndex, basic, energyRaw, energy, uses, climate, fuel, subtotal, vat, fund, bill, superApplied };
}
