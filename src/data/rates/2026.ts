// 2026년 요율·기준값. 매년(특히 국민연금 상·하한은 7월) 확인 후 갱신하세요.
// 출처: 국민연금공단, 국민건강보험공단, 고용노동부, 국세청 / 확인일 2026-10
export const RATES = {
  year: 2026,
  checkedAt: "2026년 10월",
  pension: { rate: 0.0475, minBase: 410_000, maxBase: 6_590_000 }, // 근로자 부담 4.75%, 2026.7~2027.6 상·하한
  health: { rate: 0.03595 }, // 근로자 부담 3.595%
  longTermCare: { rateOfHealth: 0.1314 }, // 건강보험료의 13.14%
  employment: { rate: 0.009 }, // 근로자 부담 0.9%
  incomeTax: {
    brackets: [
      { upTo: 14_000_000, rate: 0.06 },
      { upTo: 50_000_000, rate: 0.15 },
      { upTo: 88_000_000, rate: 0.24 },
      { upTo: 150_000_000, rate: 0.35 },
      { upTo: 300_000_000, rate: 0.38 },
      { upTo: 500_000_000, rate: 0.4 },
      { upTo: 1_000_000_000, rate: 0.42 },
      { upTo: Infinity, rate: 0.45 },
    ],
    personalDeduction: 1_500_000, // 인적공제 1인당
    mealTaxFreeLimit: 200_000, // 식대 비과세 월 한도
  },
  localTaxRate: 0.1, // 지방소득세 = 소득세의 10%
  minimumWage: 10_320, // 2026년 최저시급(원)
  // 구직급여 1일 상한액(원). 고용보험법 시행령으로 정하며 바뀔 수 있습니다. 하한액은 최저임금 × 80% × 소정근로시간
  unemployment: { dailyMax: 68_100 },
  interestTax: { normal: 0.154, preferential: 0.095, exempt: 0 }, // 이자소득세(지방세 포함)
  // 주택 중개보수 상한요율(2021.10.19 시행). limit은 한도액(원), 없으면 한도 없음
  brokerage: {
    sale: [
      { under: 50_000_000, rate: 0.006, limit: 250_000 },
      { under: 200_000_000, rate: 0.005, limit: 800_000 },
      { under: 900_000_000, rate: 0.004 },
      { under: 1_200_000_000, rate: 0.005 },
      { under: 1_500_000_000, rate: 0.006 },
      { under: Infinity, rate: 0.007 },
    ],
    lease: [
      { under: 50_000_000, rate: 0.005, limit: 200_000 },
      { under: 100_000_000, rate: 0.004, limit: 300_000 },
      { under: 600_000_000, rate: 0.003 },
      { under: 1_200_000_000, rate: 0.004 },
      { under: 1_500_000_000, rate: 0.005 },
      { under: Infinity, rate: 0.006 },
    ],
  } as Record<"sale" | "lease", { under: number; rate: number; limit?: number }[]>,
  // 연말정산(2026년 귀속, 2027년 1~2월 정산). 세법 개정이 잦으니 국세청 연말정산 안내가 나오면 다시 확인하세요.
  yearEnd: {
    seniorDeduction: 1_000_000, // 경로우대(70세 이상) 추가공제 1인당
    disabledDeduction: 2_000_000, // 장애인 추가공제 1인당
    card: {
      // 총급여의 25%를 넘게 쓴 금액부터 공제
      minSpendRate: 0.25,
      rates: { credit: 0.15, debit: 0.3, culture: 0.3, market: 0.4, transit: 0.4 },
      // 도서·공연·박물관·미술관·신문·체육시설 이용분은 총급여 7천만 원 이하만 30%
      cultureIncomeLimit: 70_000_000,
      // 기본한도. 2026년부터 자녀 1명당 한도 추가(최대 2명분)
      baseLimit: { low: 3_000_000, high: 2_500_000, threshold: 70_000_000 },
      childLimit: { low: 500_000, high: 250_000, maxChildren: 2 },
      // 기본한도를 넘은 경우 전통시장·대중교통(7천만 원 이하는 도서·공연 등 포함)으로 추가 공제
      extraLimit: { low: 3_000_000, high: 2_000_000 },
    },
    insurance: { limit: 1_000_000, rate: 0.12 }, // 보장성 보험료
    medical: { minSpendRate: 0.03, otherLimit: 7_000_000, rate: 0.15 }, // 의료비
    education: { rate: 0.15 },
    donation: { rate: 0.15, highRate: 0.3, highFrom: 10_000_000 }, // 일반 기부금
    pension: { savingsLimit: 6_000_000, totalLimit: 9_000_000, highRate: 0.15, lowRate: 0.12, highRateIncome: 55_000_000 }, // 연금저축·IRP
    marriage: 500_000, // 혼인 세액공제(2024~2026년 혼인신고, 생애 1회)
    birth: [300_000, 500_000, 700_000], // 출산·입양 세액공제: 첫째, 둘째, 셋째 이상
    standardCredit: 130_000, // 표준세액공제
  },
};
