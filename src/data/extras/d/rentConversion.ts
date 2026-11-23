import { RATES } from "@/data/rates/2026";
import { depositToRent, legalConversionCap, rentToDeposit } from "@/lib/calculators/rentConversion";
import { calcRentTaxCredit } from "@/lib/calculators/rentTaxCredit";
import type { GuideExtra, ToolExtra } from "../types";
import { BASE_RATE, BASE_RATE_CHANGED, BASE_RATE_CHECKED, krw, pr, won } from "./fmt";

const cap = legalConversionCap(BASE_RATE);
const monthly = (amount: number, rate: number) => depositToRent(amount, 0, rate).monthlyRent;

// 기준금리별 상한 표: 2.50%(2025.5~2026.7), 2.75%(2026.7~8), 3.00%(2026.8~), 3.25%·3.50%는 가정
const baseRates = [0.025, 0.0275, 0.03, 0.0325, 0.035];
const step = monthly(100_000_000, 0.0025);

// 갱신 때 전환 제안 예시
const exJeonse = 300_000_000;
const exNewDeposit = 150_000_000;
const exOfferRent = 700_000;
const exConv = depositToRent(exJeonse, exNewDeposit, cap);
const exImplied = (exOfferRent * 12) / exConv.converted;
const exExcess = exOfferRent - exConv.monthlyRent;
const depositRate = 0.03; // 가정: 예금 금리
const loanRate = 0.045; // 가정: 대출 금리
const exDepositIncome = (exConv.converted * depositRate * (1 - RATES.interestTax.normal)) / 12;
const exLoanInterest = (exConv.converted * loanRate) / 12;
const exCredit = calcRentTaxCredit(45_000_000, exConv.monthlyRent, 12);

// 월세 → 전세 환산 표
const r2dDeposit = 50_000_000;
const r2dRent = 800_000;
const r2dRates = [0.04, cap, 0.06, 0.07];

export const rentConversionGuideExtra: GuideExtra = {
  updated: "2026-11-23",
  mode: "append",
  sections: [
    {
      heading: "기준금리별 법정 전환율 상한과 월세",
      body: [
        `법정 전환율 상한은 '한국은행 기준금리 + 연 2%'와 연 10% 가운데 낮은 비율입니다. 한국은행 기준금리는 ${BASE_RATE_CHANGED} 연 ${pr(BASE_RATE)}로 바뀌었고, 이 글을 확인한 ${BASE_RATE_CHECKED}에도 같습니다. 이때 상한은 연 ${pr(cap)}입니다.`,
        "아래 표는 기준금리에 따라 상한이 어떻게 바뀌는지, 그리고 보증금 5천만 원과 1억 원을 월세로 바꿀 때 받을 수 있는 월세가 최대 얼마인지 계산한 것입니다.",
      ],
      table: {
        caption: "기준금리별 전환율 상한과 전환 보증금별 월세 상한",
        head: ["기준금리", "전환율 상한", "5천만 원 전환 시 월세 상한", "1억 원 전환 시 월세 상한"],
        rows: baseRates.map((b) => [
          b === BASE_RATE ? `${pr(b)} (현재)` : pr(b),
          `연 ${pr(legalConversionCap(b))}`,
          won(monthly(50_000_000, legalConversionCap(b))),
          won(monthly(100_000_000, legalConversionCap(b))),
        ]),
        note: `월세 = 전환하는 보증금 × 상한 ÷ 12, 원 단위 반올림. 기준금리 연 2.5%는 2025년 5월부터 2026년 7월까지, 2.75%는 2026년 7월부터 8월까지의 값이고 3.25%·3.5%는 비교를 위한 가정입니다. '현재'는 ${BASE_RATE_CHECKED} 확인 기준입니다.`,
      },
      after: [
        `기준금리가 0.25%포인트 오르면 상한도 0.25%포인트 오르고, 전환하는 보증금 1억 원당 월세 상한은 약 ${won(step)} 늘어납니다. 기준금리는 한국은행 금융통화위원회가 정하므로, 전환을 협의하는 날의 금리를 다시 확인하세요.`,
      ],
    },
    {
      heading: "갱신 때 월세 전환 제안을 검토하는 순서",
      body: [
        "한 씨는 전세 3억 원에 살다가 계약을 갱신하면서 집주인에게 '보증금 1억 5천만 원에 월세 70만 원으로 바꾸자'는 제안을 받았습니다. 순서대로 따져 보겠습니다.",
        `1단계, 전환하는 보증금: ${krw(exJeonse)} − ${krw(exNewDeposit)} = ${krw(exConv.converted)}입니다.`,
        `2단계, 제안받은 전환율: 월세 ${krw(exOfferRent)} × 12 ÷ ${krw(exConv.converted)} = 연 ${pr(exImplied)}입니다.`,
        `3단계, 상한과 비교: 기준금리 연 ${pr(BASE_RATE)}에서 상한은 연 ${pr(cap)}이고, 이 비율로 계산한 월세 상한은 ${won(exConv.monthlyRent)}입니다. 제안받은 월세는 상한보다 월 ${won(exExcess)}, 1년에 ${won(exExcess * 12)} 많습니다.`,
        "4단계, 대응: 갱신하면서 바꾸는 경우라 상한을 넘는 부분은 효력이 없습니다. 상한 이하의 금액으로 다시 협의하고, 합의가 되지 않으면 주택임대차분쟁조정위원회에 조정을 신청할 수 있습니다.",
        `5단계, 돌려받는 보증금의 쓰임: 돌려받은 ${krw(exConv.converted)}을 연 ${pr(depositRate)} 예금에 넣으면 이자소득세 ${pr(RATES.interestTax.normal)}를 떼고 월 약 ${won(exDepositIncome)}이 생깁니다. 연 ${pr(loanRate)} 대출을 그만큼 갚는다면 이자가 월 ${won(exLoanInterest)} 줄어듭니다. 상한 월세 ${won(exConv.monthlyRent)}과 비교하면, 예금에 넣을 때는 월세 쪽이 월 ${won(exConv.monthlyRent - exDepositIncome)} 더 들고, 대출을 갚을 때는 차이가 월 ${won(exConv.monthlyRent - exLoanInterest)}으로 줄어듭니다.`,
        `6단계, 세액공제: 한 씨의 총급여가 4,500만 원이고 월세 세액공제 요건을 갖췄다면, 1년 월세 ${won(exCredit.paid)}의 ${pr(exCredit.rate)}인 ${won(exCredit.credit)}과 지방소득세 ${won(exCredit.localTaxCredit)}을 돌려받을 수 있습니다. 낼 세금이 충분하다면 실제 월세 부담은 그만큼 줄어듭니다.`,
      ],
    },
    {
      heading: "전세 환산 보증금은 전환율에 따라 크게 달라집니다",
      body: [
        "보증금 5천만 원에 월세 80만 원인 집을 전세 조건으로 바꿔 보면, 어떤 전환율을 쓰느냐에 따라 결과가 크게 달라집니다. 전환율이 높을수록 같은 월세가 보증금으로 적게 환산되기 때문입니다.",
      ],
      table: {
        caption: `보증금 ${krw(r2dDeposit)}·월세 ${krw(r2dRent)}의 전세 환산`,
        head: ["전환율(연)", "월세의 보증금 환산액", "전세 환산 보증금"],
        rows: r2dRates.map((r) => {
          const x = rentToDeposit(r2dDeposit, r2dRent, r);
          return [r === cap ? `${pr(r)} (현재 법정 상한)` : pr(r), krw(x.added), krw(x.jeonseEquivalent)];
        }),
        note: "전세 환산 보증금 = 보증금 + 월세 × 12 ÷ 전환율, 만 원 단위 반올림. 법정 상한 외의 비율은 비교를 위한 가정이며, 실제 시장 전환율은 지역과 주택 유형마다 다릅니다.",
      },
      after: [
        "법정 전환율 상한은 보증금을 월세로 바꾸는 경우에 대한 규정입니다. 월세를 낮추고 보증금을 올리는 반대 방향에는 이 상한이 적용되지 않아 당사자가 협의해 정합니다. 다만 갱신하면서 보증금을 올리는 것이라면 증액 한도(5%)에 걸리는지 따로 확인해야 합니다.",
      ],
    },
    {
      heading: "전환 협의 전에 챙길 것",
      body: [
        "① 기준금리 날짜: 상한은 전환하는 때의 한국은행 기준금리로 계산합니다. 한국은행 누리집의 기준금리 추이에서 그날 금리를 확인하세요.",
        "② 줄어드는 보증금만 계산: 전환율은 월세로 바뀌는 보증금에만 곱합니다. 남는 보증금까지 넣어 계산하면 월세가 지나치게 크게 나옵니다.",
        "③ 관리비는 따로: 월세와 관리비를 섞어 말하면 전환율 비교가 틀어집니다. 계약서에 두 금액을 나눠 적습니다.",
        "④ 돌려받는 날짜: 보증금 일부를 돌려받는 날과 월세를 내기 시작하는 날을 계약서에 함께 적어 두면 날짜 차이로 생기는 분쟁을 막을 수 있습니다.",
        "⑤ 세액공제 서류: 월세 세액공제를 받으려면 바뀐 조건이 적힌 계약서와 월세 이체 내역이 필요합니다. 월세는 계좌이체로 내고 기록을 남깁니다.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 · 주택임대차보호법(제7조, 제7조의2, 제10조의2)", url: "https://www.law.go.kr/법령/주택임대차보호법" },
    { label: "국가법령정보센터 · 주택임대차보호법 시행령(제9조 월차임 전환 시 산정률)", url: "https://www.law.go.kr/법령/주택임대차보호법시행령" },
    { label: "한국은행 · 한국은행 기준금리 추이", url: "https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643" },
  ],
};

// 도구 페이지
const toolAmounts = [30_000_000, 50_000_000, 100_000_000, 150_000_000, 200_000_000];
const listings: [string, number, number][] = [
  ["A", 100_000_000, 500_000],
  ["B", 200_000_000, 100_000],
  ["C", 50_000_000, 700_000],
];
const eq = (dep: number, rent: number, r: number) => rentToDeposit(dep, rent, r).jeonseEquivalent;
const drop = listings.map(([name, d, m]) => ({ name, drop: eq(d, m, cap) - eq(d, m, 0.06) }));
const biggest = drop.reduce((a, b) => (b.drop > a.drop ? b : a));
const smallest = drop.reduce((a, b) => (b.drop < a.drop ? b : a));
const oneEok = depositToRent(100_000_000, 0, cap);
const oneEokCredit = calcRentTaxCredit(45_000_000, oneEok.monthlyRent, 12);

export const rentConversionToolExtra: ToolExtra = {
  updated: "2026-11-23",
  sections: [
    {
      heading: "지금 기준금리로 계산한 상한 월세",
      body: [
        `기준금리 칸에는 계산하는 날의 한국은행 기준금리를 넣어야 합니다. ${BASE_RATE_CHECKED} 확인한 기준금리는 연 ${pr(BASE_RATE)}(${BASE_RATE_CHANGED} 변경)이고, 이때 법정 전환율 상한은 연 ${pr(cap)}입니다. 계산기에 처음 들어 있는 값은 입력 예시이므로 그날 금리로 바꿔 넣으세요.`,
      ],
      table: {
        caption: `전환하는 보증금별 월세(상한 연 ${pr(cap)}와 비교)`,
        head: ["월세로 바꾸는 보증금", `연 ${pr(cap)}(상한)`, "연 6%라면", "연 7%라면"],
        rows: toolAmounts.map((a) => [krw(a), won(monthly(a, cap)), won(monthly(a, 0.06)), won(monthly(a, 0.07))]),
        note: "월세 = 바꾸는 보증금 × 전환율 ÷ 12, 원 단위 반올림. 연 6%·7%는 상한을 넘는 제안을 비교하기 위한 가정입니다.",
      },
      after: [
        "계약 기간 중이거나 갱신하면서 제안받은 월세가 가운데 칸(상한)보다 크다면 법정 상한을 넘는 조건입니다. 새로 맺는 계약이라면 상한이 적용되지 않으니 비교용으로만 보세요.",
      ],
    },
    {
      heading: "전세 환산 보증금으로 매물 비교하기",
      body: [
        "보증금과 월세가 서로 다른 매물은 '월세를 전세 보증금으로 환산'으로 바꿔 같은 기준으로 비교할 수 있습니다. 아래는 세 매물을 같은 전환율로 환산한 예입니다.",
      ],
      table: {
        caption: "매물별 전세 환산 보증금",
        head: ["매물", "보증금 / 월세", `연 ${pr(cap)}로 환산`, "연 6%로 환산"],
        rows: listings.map(([name, d, m]) => [name, `${krw(d)} / ${krw(m)}`, krw(eq(d, m, cap)), krw(eq(d, m, 0.06))]),
        note: "전세 환산 보증금 = 보증금 + 월세 × 12 ÷ 전환율, 만 원 단위 반올림. 관리비는 넣지 않았습니다.",
      },
      after: [
        `전환율을 연 ${pr(cap)}에서 6%로 올리면 월세가 큰 매물 ${biggest.name}의 환산액이 ${krw(biggest.drop)} 줄어 가장 많이 내려가고, 월세가 작은 매물 ${smallest.name}는 ${krw(smallest.drop)}만 줄어듭니다. 어떤 전환율로 비교하느냐에 따라 매물 사이의 차이도 크게 달라진다는 뜻입니다.`,
        "내 상황에 맞는 전환율은 보증금을 마련하는 비용입니다. 대출로 보증금을 낸다면 대출 금리를, 가진 돈으로 낸다면 세금을 뗀 예금 금리를 넣어 비교하세요.",
      ],
    },
    {
      heading: "연간 월세 합계로 세액공제까지 따져 보기",
      body: [
        `결과 표의 '연간 월세 합계'는 월세 세액공제 계산기에 그대로 옮겨 쓸 수 있습니다. 보증금 1억 원을 상한 연 ${pr(cap)}로 월세로 바꾸면 월세는 ${won(oneEok.monthlyRent)}, 1년 합계는 ${won(oneEok.monthlyRent * 12)}입니다.`,
        `총급여가 5,500만 원 이하이고 공제 요건을 갖췄다면 이 중 ${pr(oneEokCredit.rate)}인 ${won(oneEokCredit.credit)}과 지방소득세 ${won(oneEokCredit.localTaxCredit)}을 연말정산에서 돌려받을 수 있어, 1년 실제 부담은 약 ${won(oneEok.monthlyRent * 12 - oneEokCredit.credit - oneEokCredit.localTaxCredit)}이 됩니다. 세액공제는 낼 세금이 있어야 적용되고, 집이 국민주택규모 이하이거나 기준시가 4억 원 이하여야 하는 등 요건이 따로 있습니다.`,
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 · 주택임대차보호법 시행령(제9조 월차임 전환 시 산정률)", url: "https://www.law.go.kr/법령/주택임대차보호법시행령" },
    { label: "한국은행 · 한국은행 기준금리 추이", url: "https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643" },
  ],
};
