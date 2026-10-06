// 월세 세액공제(조세특례제한법 제95조의2, 2024년 귀속 이후 기준)
export const RENT_CREDIT = {
  incomeLimit: 80_000_000, // 총급여 한도
  highRateLimit: 55_000_000, // 이 금액 이하 17%
  highRate: 0.17,
  lowRate: 0.15,
  rentLimit: 10_000_000, // 공제 대상 월세 연 한도
};

export function calcRentTaxCredit(totalSalary: number, monthlyRent: number, months: number) {
  const eligible = totalSalary > 0 && totalSalary <= RENT_CREDIT.incomeLimit;
  const rate = totalSalary <= RENT_CREDIT.highRateLimit ? RENT_CREDIT.highRate : RENT_CREDIT.lowRate;
  const paid = monthlyRent * months;
  const base = Math.min(paid, RENT_CREDIT.rentLimit);
  const credit = eligible ? base * rate : 0;
  return { eligible, rate, paid, base, credit, localTaxCredit: credit * 0.1 };
}
