export const VAT_RATE = 0.1;

// 공급가액에서 부가세와 합계 구하기. 부가세는 원 단위 미만을 버립니다.
export function fromSupply(supply: number) {
  const vat = Math.floor(supply * VAT_RATE);
  return { supply, vat, total: supply + vat };
}

// 부가세 포함 합계에서 공급가액과 부가세 나누기. 공급가액은 반올림해 합계와 맞춥니다.
export function fromTotal(total: number) {
  const supply = Math.round(total / (1 + VAT_RATE));
  return { supply, vat: total - supply, total };
}
