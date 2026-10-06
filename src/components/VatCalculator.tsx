"use client";
import { useState } from "react";
import { fromSupply, fromTotal } from "@/lib/calculators/vat";
import { num, won } from "@/lib/format";

type Mode = "supply" | "total";

export default function VatCalculator() {
  const [mode, setMode] = useState<Mode>("total");
  const [amount, setAmount] = useState("110000");

  const r = mode === "supply" ? fromSupply(num(amount)) : fromTotal(num(amount));

  return (
    <div className="calc">
      <div className="fields">
        <label>입력하는 금액
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="total">부가세 포함 합계 금액</option>
            <option value="supply">공급가액 (부가세 별도)</option>
          </select>
        </label>
        <label>금액 (원)
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        <div className="big">
          <span>부가가치세 (10%)</span>
          <strong>{won(r.vat)}</strong>
          <small>공급가액 {won(r.supply)} · 합계 {won(r.total)}</small>
        </div>
        <table>
          <tbody>
            <tr><th>공급가액</th><td>{won(r.supply)}</td></tr>
            <tr><th>부가세</th><td>{won(r.vat)}</td></tr>
            <tr className="sum"><th>합계 금액</th><td>{won(r.total)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
