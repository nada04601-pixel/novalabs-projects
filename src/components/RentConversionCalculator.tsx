"use client";
import { useState } from "react";
import { depositToRent, legalConversionCap, rentToDeposit } from "@/lib/calculators/rentConversion";
import { num, won } from "@/lib/format";

type Mode = "toRent" | "toDeposit";

export default function RentConversionCalculator() {
  const [mode, setMode] = useState<Mode>("toRent");
  const [deposit, setDeposit] = useState("300000000");
  const [newDeposit, setNewDeposit] = useState("200000000");
  const [rent, setRent] = useState("1000000");
  const [rate, setRate] = useState("4.5");
  const [baseRate, setBaseRate] = useState("2.5");

  const annualRate = Math.min(num(rate), 100) / 100;
  const cap = legalConversionCap(Math.min(num(baseRate), 100) / 100);
  const toRent = depositToRent(num(deposit), num(newDeposit), annualRate);
  const toDeposit = rentToDeposit(num(deposit), num(rent), annualRate);

  return (
    <div className="calc">
      <div className="fields">
        <label>계산 방향
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="toRent">보증금 일부를 월세로</option>
            <option value="toDeposit">월세를 전세 보증금으로 환산</option>
          </select>
        </label>
        <label>{mode === "toRent" ? "현재 보증금 (원)" : "보증금 (원)"}
          <input inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        </label>
        {mode === "toRent" ? (
          <label>바꾼 뒤 보증금 (원)
            <input inputMode="numeric" value={newDeposit} onChange={(e) => setNewDeposit(e.target.value)} />
          </label>
        ) : (
          <label>월세 (원)
            <input inputMode="numeric" value={rent} onChange={(e) => setRent(e.target.value)} />
          </label>
        )}
        <label>전환율 (연 %)
          <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label>한국은행 기준금리 (연 %)
          <input inputMode="decimal" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        {mode === "toRent" ? (
          <div className="big">
            <span>전환 후 월세</span>
            <strong>{won(toRent.monthlyRent)}</strong>
            <small>월세로 바꾸는 보증금 {won(toRent.converted)}</small>
          </div>
        ) : (
          <div className="big">
            <span>전세로 환산한 보증금</span>
            <strong>{won(toDeposit.jeonseEquivalent)}</strong>
            <small>월세 환산분 {won(toDeposit.added)}</small>
          </div>
        )}
        {annualRate > cap && (
          <p className="warn">
            입력한 전환율이 법정 상한 연 {(cap * 100).toFixed(2)}%보다 높습니다. 계약 기간 중이나 갱신 때 보증금을 월세로 바꾸는 경우에는 상한을 넘을 수 없습니다.
          </p>
        )}
        <table>
          <tbody>
            <tr><th>법정 전환율 상한</th><td>연 {(cap * 100).toFixed(2)}%</td></tr>
            {mode === "toRent" ? (
              <tr><th>상한 전환율 적용 시 월세</th><td>{won(depositToRent(num(deposit), num(newDeposit), cap).monthlyRent)}</td></tr>
            ) : (
              <tr><th>상한 전환율 적용 시 환산 보증금</th><td>{won(rentToDeposit(num(deposit), num(rent), cap).jeonseEquivalent)}</td></tr>
            )}
            <tr className="sum"><th>연간 월세 합계</th><td>{won((mode === "toRent" ? toRent.monthlyRent : num(rent)) * 12)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
