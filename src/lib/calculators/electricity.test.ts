import { describe, expect, it } from "vitest";
import { calcElectricity } from "./electricity";

// 시험값: 한전ON 전기요금계산기(https://online.kepco.co.kr/PRM033D00)를 2026-11-27에 직접 돌린 결과.
// 주택용, 복지할인 없음, 연료비조정단가 +5.0원, 기후환경요금 9.0원.
describe("전기요금: 한전 계산기와 같은 청구액(저압, 10~11월)", () => {
  const cases: [number, number, [number, number, number, number, number, number, number]][] = [
    [200, 31_220, [910, 24_000, 1_800, 1_000, 27_710, 2_771, 740]],
    [201, 32_260, [1_600, 24_214, 1_809, 1_005, 28_628, 2_863, 770]],
    [300, 57_760, [1_600, 45_460, 2_700, 1_500, 51_260, 5_126, 1_380]],
    [350, 70_640, [1_600, 56_190, 3_150, 1_750, 62_690, 6_269, 1_690]],
    [400, 83_530, [1_600, 66_920, 3_600, 2_000, 74_120, 7_412, 2_000]],
    [401, 90_310, [7_300, 67_227, 3_609, 2_005, 80_141, 8_014, 2_160]],
    [450, 108_050, [7_300, 82_285, 4_050, 2_250, 95_885, 9_589, 2_580]],
    [500, 126_160, [7_300, 97_650, 4_500, 2_500, 111_950, 11_195, 3_020]],
  ];
  for (const [kwh, bill, [basic, energy, climate, fuel, subtotal, vat, fund]] of cases) {
    it(`${kwh}kWh → ${bill}원`, () => {
      const r = calcElectricity({ kwh, month: 11, voltage: "low" });
      expect({ basic: r.basic, energy: r.energy, climate: r.climate, fuel: r.fuel, subtotal: r.subtotal, vat: r.vat, fund: r.fund, bill: r.bill })
        .toEqual({ basic, energy, climate, fuel, subtotal, vat, fund, bill });
    });
  }
});

describe("전기요금: 슈퍼유저와 고압", () => {
  it("12월 1,100kWh는 1,000kWh 넘는 부분에 슈퍼유저 단가", () => {
    const r = calcElectricity({ kwh: 1_100, month: 12, voltage: "low" });
    expect(r.superApplied).toBe(true);
    expect(r.energy).toBe(324_920);
    expect(r.subtotal).toBe(347_620);
    expect(r.bill).toBe(391_760);
  });
  it("11월 1,100kWh는 슈퍼유저 단가가 없다", () => {
    const r = calcElectricity({ kwh: 1_100, month: 11, voltage: "low" });
    expect(r.superApplied).toBe(false);
    expect(r.energy).toBe(282_030);
    expect(r.subtotal).toBe(304_730);
    expect(r.bill).toBe(343_420);
  });
  it("고압 300kWh(10~11월)", () => {
    const r = calcElectricity({ kwh: 300, month: 10, voltage: "high" });
    expect([r.basic, r.energy, r.subtotal, r.vat, r.fund, r.bill]).toEqual([1_260, 38_400, 43_860, 4_386, 1_180, 49_420]);
  });
  it("고압 12월 1,100kWh", () => {
    expect(calcElectricity({ kwh: 1_100, month: 12, voltage: "high" }).bill).toBe(318_670);
  });
  it("하계(7~8월)는 누진 구간이 300·450kWh", () => {
    const r = calcElectricity({ kwh: 300, month: 8, voltage: "low" });
    expect(r.basic).toBe(910);
    expect(r.energy).toBe(36_000);
  });
});
