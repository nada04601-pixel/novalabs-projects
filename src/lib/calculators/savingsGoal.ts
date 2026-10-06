import { calcSavings, type InterestType } from "./savings";

// 목표 금액(세후)을 만들기 위한 월 납입액. 적금 이자는 납입액에 비례하므로 100만 원 기준 결과로 역산합니다.
export function calcSavingsGoal(target: number, months: number, annualRate: number, interestType: InterestType, taxRate: number) {
  const n = Math.max(1, Math.floor(months));
  const unit = 1_000_000;
  const perUnit = calcSavings({ kind: "installment", amount: unit, annualRate, months: n, interestType, taxRate }).afterTax / unit;
  const monthly = target > 0 ? Math.ceil(target / perUnit / 100) * 100 : 0; // 100원 단위 올림
  const result = calcSavings({ kind: "installment", amount: monthly, annualRate, months: n, interestType, taxRate });
  return { monthly, months: n, ...result, withoutInterest: Math.ceil(target / n) };
}
