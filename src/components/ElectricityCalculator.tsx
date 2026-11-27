"use client";
import { useState } from "react";
import { calcElectricity, CLIMATE_PRICE, FUEL_PRICE_2026Q4, TARIFF, isSuperSeason, tierBounds, SUPER_USER_KWH, type Voltage } from "@/lib/calculators/electricity";
import { num, won } from "@/lib/format";

const kwhText = (v: number) => `${v.toLocaleString("ko-KR")}kWh`;
// 구간별 전력량요금은 소수 첫째 자리까지 보여 주고, 합계에서 원 미만을 버립니다.
const wonDecimal = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}원`;

// 연료비조정단가는 음수(인하)일 수 있어 숫자만 남기는 num() 대신 따로 읽습니다.
const signed = (v: string, fallback: number) => {
  const x = Number(v.replace(/[^0-9.\-]/g, ""));
  return v.trim() === "" || Number.isNaN(x) ? fallback : Math.max(-5, Math.min(5, x));
};

export default function ElectricityCalculator() {
  const [kwh, setKwh] = useState("350");
  const [month, setMonth] = useState("11");
  const [voltage, setVoltage] = useState<Voltage>("low");
  const [fuel, setFuel] = useState(String(FUEL_PRICE_2026Q4));

  const m = num(month) || 1;
  const r = calcElectricity({ kwh: Math.min(num(kwh), 100_000), month: m, voltage, fuelPrice: signed(fuel, FUEL_PRICE_2026Q4) });
  const [b1, b2] = tierBounds(m);
  const t = TARIFF[voltage];

  // 다음 누진 구간까지 남은 사용량 안내
  const nextStep =
    r.kwh <= b1
      ? { left: b1 - r.kwh, text: `${kwhText(b1)}를 넘으면 기본요금이 ${won(t.tiers[0].basic)}에서 ${won(t.tiers[1].basic)}으로, 넘는 부분 단가가 ${t.tiers[0].price}원에서 ${t.tiers[1].price}원으로 오릅니다.` }
      : r.kwh <= b2
        ? { left: b2 - r.kwh, text: `${kwhText(b2)}를 넘으면 기본요금이 ${won(t.tiers[1].basic)}에서 ${won(t.tiers[2].basic)}으로, 넘는 부분 단가가 ${t.tiers[1].price}원에서 ${t.tiers[2].price}원으로 오릅니다.` }
        : null;

  return (
    <div className="calc">
      <div className="fields">
        <label>한 달 사용량 (kWh)
          <input inputMode="numeric" value={kwh} onChange={(e) => setKwh(e.target.value)} />
        </label>
        <label>사용한 달
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}월</option>)}
          </select>
        </label>
        <label>계약 종류 (고지서의 계약종별)
          <select value={voltage} onChange={(e) => setVoltage(e.target.value as Voltage)}>
            <option value="low">주택용 저압</option>
            <option value="high">주택용 고압</option>
          </select>
        </label>
        <label>연료비조정단가 (원/kWh, −5~+5)
          <input inputMode="decimal" value={fuel} onChange={(e) => setFuel(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>{m}월 {kwhText(r.kwh)} 전기요금 청구액</span>
          <strong>{won(r.bill)}</strong>
          <small>전기요금계 {won(r.subtotal)} · 부가세 {won(r.vat)} · 기금 {won(r.fund)}</small>
        </div>
        {r.superApplied && (
          <p className="warn">{m}월은 하계·동계라 {kwhText(SUPER_USER_KWH)}를 넘는 부분에 슈퍼유저 단가 {t.superPrice}원이 붙었습니다.</p>
        )}
        {!r.superApplied && r.kwh > SUPER_USER_KWH && !isSuperSeason(m) && (
          <p className="note-sm">{m}월은 슈퍼유저 요금이 붙지 않는 달입니다. 같은 사용량이라도 7~8월, 12~2월이면 {kwhText(SUPER_USER_KWH)} 넘는 부분이 더 비쌉니다.</p>
        )}
        {nextStep && r.kwh > 0 && (
          <p className="note-sm">다음 구간까지 {kwhText(nextStep.left)} 남았습니다. {nextStep.text}</p>
        )}
        <div className="scroll">
          <table>
            <thead>
              <tr><th>항목</th><td>계산</td><td>금액</td></tr>
            </thead>
            <tbody>
              <tr><th>기본요금</th><td>{r.tierIndex + 1}구간</td><td>{won(r.basic)}</td></tr>
              {r.uses.map((u) => (
                <tr key={u.label}><th>전력량요금 {u.label}</th><td>{kwhText(u.kwh)} × {u.price}원</td><td>{wonDecimal(u.amount)}</td></tr>
              ))}
              <tr><th>전력량요금 합계</th><td>원 미만 버림</td><td>{won(r.energy)}</td></tr>
              <tr><th>기후환경요금</th><td>{kwhText(r.kwh)} × {CLIMATE_PRICE.toFixed(1)}원</td><td>{won(r.climate)}</td></tr>
              <tr><th>연료비조정요금</th><td>{kwhText(r.kwh)} × {signed(fuel, FUEL_PRICE_2026Q4)}원</td><td>{won(r.fuel)}</td></tr>
              <tr className="sum"><th>전기요금계</th><td></td><td>{won(r.subtotal)}</td></tr>
              <tr><th>부가가치세</th><td>전기요금계 × 10%</td><td>{won(r.vat)}</td></tr>
              <tr><th>전력산업기반기금</th><td>전기요금계 × 2.7%, 10원 미만 버림</td><td>{won(r.fund)}</td></tr>
              <tr className="sum"><th>청구액</th><td>10원 미만 버림</td><td>{won(r.bill)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="note-sm">TV 수신료, 복지할인, 자동이체 할인, 아파트 공용 설비 사용분은 넣지 않았습니다. 사용 기간이 요금이나 계절 구간이 바뀌는 때에 걸치면 실제 고지액과 차이가 날 수 있습니다.</p>
      </div>
    </div>
  );
}
