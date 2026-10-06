// 전월세 전환율 상한(주택임대차보호법 시행령): 연 10%와 기준금리 + 연 2% 중 낮은 비율
export const legalConversionCap = (baseRate: number) => Math.min(0.1, baseRate + 0.02);

// 보증금 일부를 월세로: 월세 = 전환 보증금 × 전환율 ÷ 12
export function depositToRent(currentDeposit: number, newDeposit: number, annualRate: number) {
  const converted = Math.max(0, currentDeposit - newDeposit);
  return { converted, monthlyRent: (converted * annualRate) / 12 };
}

// 월세를 보증금으로 환산: 전세 환산 보증금 = 보증금 + 월세 × 12 ÷ 전환율
export function rentToDeposit(deposit: number, monthlyRent: number, annualRate: number) {
  const added = annualRate > 0 ? (monthlyRent * 12) / annualRate : 0;
  return { added, jeonseEquivalent: deposit + added };
}
