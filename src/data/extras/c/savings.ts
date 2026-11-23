import { calcSavings, type InterestType, type SavingsKind } from "@/lib/calculators/savings";
import type { GuideExtra, ToolExtra } from "../types";
import { SRC, TAX_COOP_2026, TAX_COOP_2027, TAX_COOP_EXEMPT, TAX_EXEMPT, TAX_NORMAL, TAX_PREF, krw, pc, rt, won } from "./fmt";

// 적금 이자 가이드(installment-savings-interest), 단리·복리 가이드(simple-vs-compound-interest),
// 예금·적금 이자 계산기(savings-interest) 보강.

const sv = (kind: SavingsKind, amount: number, annualRate: number, months: number, interestType: InterestType = "simple", taxRate = TAX_NORMAL) =>
  calcSavings({ kind, amount, annualRate, months, interestType, taxRate });
const net = (x: { interest: number; tax: number }) => x.interest - x.tax;

// ===== 적금 이자 가이드 =====
// A. 1년 동안 같은 돈: 예금 한 번에 vs 적금 매달
const YEAR_TOTAL = 12_000_000;
const A_RATES = [0.03, 0.035, 0.04, 0.045, 0.05];
const aRows = A_RATES.map((r) => {
  const d = sv("deposit", YEAR_TOTAL, r, 12);
  const i = sv("installment", YEAR_TOTAL / 12, r, 12);
  return { r, d: net(d), i: net(i) };
});
const aRatio = aRows[2].i / aRows[2].d;

// B. 월 50만 원, 연 4%, 기간별
const B_AMT = 500_000;
const B_R = 0.04;
const bRows = [12, 24, 36].map((m) => ({ m, x: sv("installment", B_AMT, B_R, m) }));
const b12 = bRows[0].x;
const b36 = bRows[2].x;

// C. A씨: 월 30만 원, 연 4%, 12개월 회차별
const C_AMT = 300_000;
const C_R = 0.04;
const C_M = 12;
const cUnit = (C_AMT * C_R) / 12; // 한 달 치 이자
const cRows = Array.from({ length: C_M }, (_, k) => ({ k: k + 1, left: C_M - k, int: cUnit * (C_M - k) }));
const cRes = sv("installment", C_AMT, C_R, C_M);

// D. 6개월째 해지(중도해지 이율 가정)
const D_EARLY_R = 0.01; // 가정 값
const D_M = 6;
const dEarly = sv("installment", C_AMT, D_EARLY_R, D_M);
const dKeptRate = sv("installment", C_AMT, C_R, D_M);

export const installmentGuide: GuideExtra = {
  updated: "2026-11-23",
  mode: "append",
  sections: [
    {
      heading: "1년 동안 같은 돈을 넣을 때 예금과 적금의 세후 이자",
      body: [
        `1년 동안 모두 ${krw(YEAR_TOTAL)}을 넣는다고 할 때, 처음에 ${krw(YEAR_TOTAL)}을 한 번에 예금하는 경우와 매달 ${krw(YEAR_TOTAL / 12)}씩 적금에 넣는 경우의 세후 이자를 금리별로 비교했습니다. 금리는 모두 예시입니다.`,
      ],
      table: {
        caption: `1년 납입 총액 ${krw(YEAR_TOTAL)}: 예금과 적금의 세후 이자`,
        head: ["연 금리(예시)", `예금 ${krw(YEAR_TOTAL)} 세후 이자`, `적금 월 ${krw(YEAR_TOTAL / 12)} 세후 이자`, "적금 ÷ 예금"],
        rows: aRows.map(({ r, d, i }) => [`연 ${rt(r)}`, won(d), won(i), pc(i / d, 1)]),
        note: `단리, 일반과세(이자소득세 ${pc(TAX_NORMAL, 1)}) 기준입니다. 이자는 원 단위 미만을, 세금은 10원 미만을 버렸습니다(이 사이트 계산기와 같은 방식).`,
      },
      after: [
        `금리가 달라도 적금 세후 이자는 예금의 약 ${pc(aRatio, 0)}로 거의 일정합니다. 적금에 넣은 돈의 평균 예치 기간이 6.5개월이라 예금(12개월)의 13/24, 곧 약 ${(13 / 24).toFixed(2)}배가 되기 때문입니다.`,
        `거꾸로 말하면, 같은 원금 합계에서 적금 이자가 예금 이자를 따라잡으려면 적금 금리가 예금 금리의 약 ${(24 / 13).toFixed(2)}배는 되어야 합니다. 이미 목돈이 있다면 금리만 놓고 볼 때 예금 쪽이 유리하고, 적금은 목돈을 만드는 과정에 쓰는 도구라고 보는 편이 정확합니다.`,
      ],
    },
    {
      heading: "적금 기간을 늘리면 이자는 원금보다 빨리 늘어납니다",
      body: [
        "적금 이자는 납입 개월 수를 n이라 할 때 n(n+1)/2에 비례합니다. 그래서 기간을 두 배로 늘리면 원금은 두 배가 되지만 이자는 네 배 가까이 늘어납니다. 같은 월 납입액과 같은 금리로 기간만 바꿔 계산했습니다.",
      ],
      table: {
        caption: `월 ${krw(B_AMT)}, 연 ${rt(B_R)}(예시) 단리 적금의 기간별 이자`,
        head: ["기간", "원금 합계", "세전 이자", "세후 이자", "원금 대비 세후 이자"],
        rows: bRows.map(({ m, x }) => [`${m}개월`, won(x.principal), won(x.interest), won(net(x)), pc(net(x) / x.principal)]),
        note: `일반과세 ${pc(TAX_NORMAL, 1)} 기준입니다. 실제로는 기간별로 금리가 다르게 정해지므로, 같은 금리라는 가정은 기간의 효과만 보기 위한 것입니다.`,
      },
      after: [
        `12개월을 36개월로 늘리면 원금은 3배가 되지만 세전 이자는 ${(b36.interest / b12.interest).toFixed(1)}배가 됩니다. 다만 기간이 길수록 중간에 해지할 위험도 커지는데, 만기 전에 깨면 아래처럼 이자가 크게 줄어듭니다.`,
      ],
    },
    {
      heading: "직장인 A씨의 1년 적금, 회차별 이자 따라가기",
      body: [
        `A씨가 매달 ${krw(C_AMT)}씩 ${C_M}개월 동안 연 ${rt(C_R)} 단리 적금에 넣는다고 해 보겠습니다(금리는 예시). 1회차에 넣은 ${krw(C_AMT)}은 만기까지 ${C_M}개월, 마지막 ${C_M}회차에 넣은 돈은 1개월만 은행에 머뭅니다.`,
        `회차마다 이자는 ${krw(C_AMT)} × ${rt(C_R)} ÷ 12 × 남은 개월 수입니다. 한 달 치 이자가 ${won(cUnit)}이므로 1회차 돈에는 ${won(cUnit * C_M)}, ${C_M}회차 돈에는 ${won(cUnit)}이 붙습니다.`,
      ],
      table: {
        caption: `월 ${krw(C_AMT)}, 연 ${rt(C_R)}(예시), ${C_M}개월 단리 적금의 회차별 세전 이자`,
        head: ["납입 회차", "만기까지 개월 수", "이 회차 돈의 세전 이자"],
        rows: [...cRows.map(({ k, left, int }) => [`${k}회차`, `${left}개월`, won(int)]), ["합계", `${cRows.reduce((s, r) => s + r.left, 0)}개월분`, won(cRes.interest)]],
        note: "남은 개월 수를 모두 더한 값(78)이 n(n+1)/2 공식의 바로 그 숫자입니다.",
      },
      after: [
        `세전 이자 ${won(cRes.interest)}에서 이자소득세 ${pc(TAX_NORMAL, 1)}인 ${won(cRes.tax)}을 떼면 세후 이자는 ${won(net(cRes))}이고, 만기에 받는 돈은 원금 ${won(cRes.principal)}을 더한 ${won(cRes.afterTax)}입니다.`,
        `원금 합계 대비 세후 이자는 ${pc(net(cRes) / cRes.principal)}로, 표면 금리 ${rt(C_R)}의 절반(${rt(C_R / 2)})에도 못 미칩니다. 세금을 떼기 전으로 봐도 ${pc(cRes.interest / cRes.principal)}라서, 적금 금리를 '원금 합계에 대한 1년 수익률'로 읽으면 실제로 받는 이자보다 훨씬 크게 기대하게 됩니다.`,
      ],
    },
    {
      heading: "중도해지하면 이자는 얼마나 남을까",
      body: [
        `적금을 만기 전에 깨면 약정 금리 대신 금융회사가 정한 중도해지 이율이 적용됩니다. 중도해지 이율은 상품과 경과 기간에 따라 다르므로, 아래는 A씨가 ${D_M}회 납입 뒤 해지하고 중도해지 이율이 연 ${rt(D_EARLY_R)}라고 가정해 계산한 것입니다.`,
      ],
      table: {
        caption: `A씨(월 ${krw(C_AMT)})가 ${D_M}개월째 해지하는 경우`,
        head: ["구분", "원금", "세전 이자", "세후 이자"],
        rows: [
          [`${D_M}개월째 해지, 연 ${rt(D_EARLY_R)} 가정`, won(dEarly.principal), won(dEarly.interest), won(net(dEarly))],
          [`${D_M}개월분에 약정 ${rt(C_R)}가 그대로라면`, won(dKeptRate.principal), won(dKeptRate.interest), won(net(dKeptRate))],
          [`${C_M}개월 만기까지 유지(연 ${rt(C_R)})`, won(cRes.principal), won(cRes.interest), won(net(cRes))],
        ],
        note: `중도해지 이율 연 ${rt(D_EARLY_R)}는 계산을 위한 가정입니다. 실제로는 기본금리에 경과 기간별 비율을 곱하거나 별도 이율표를 쓰는 등 상품마다 다릅니다.`,
      },
      after: [
        `해지하면 같은 ${D_M}개월을 넣고도 세후 이자가 ${won(net(dKeptRate))}에서 ${won(net(dEarly))}으로 줄어듭니다. 해지할 가능성이 있다면 처음부터 금액을 나눠 적금 두 개로 가입해 두면, 급할 때 하나만 깨고 나머지는 약정 금리를 지킬 수 있습니다.`,
      ],
    },
    {
      heading: "적금에 가입하기 전 확인할 것",
      body: [
        "정액적립식인지 자유적립식인지 보세요. 자유적립식은 넣은 날부터 만기까지의 기간에만 이자가 붙으므로, 같은 금리라도 만기 직전에 몰아서 넣으면 이자가 거의 없습니다. 이자를 제대로 받으려면 초반에 넣는 금액이 커야 합니다.",
        "만기 후 이율을 확인하세요. 만기가 지나도 찾지 않으면 약정 금리보다 낮은 만기 후 이율이 적용되는 것이 일반적입니다. 만기일에 맞춰 다음 예금이나 적금으로 옮길 계획을 미리 세워 두면 이자가 낮은 기간을 줄일 수 있습니다.",
        "예금자보호 한도를 확인하세요. 같은 금융회사에 넣은 예금과 적금은 원금과 소정의 이자를 합쳐 1인당 1억 원까지 보호됩니다. 금리를 비교할 때는 금융감독원 '금융상품한눈에'에서 저축 금액, 기간, 이자 계산 방식(단리·복리)을 넣어 금융회사별 적금을 한꺼번에 찾아볼 수 있습니다.",
      ],
    },
  ],
  sources: [SRC.incomeTaxLaw, SRC.ntsRate, SRC.kdic, SRC.finlife],
};

// ===== 단리·복리 가이드 =====
const P = 10_000_000;
const R = 0.035;
const cmpRows = [1, 2, 3, 5, 10, 20].map((y) => {
  const s = sv("deposit", P, R, y * 12, "simple", 0);
  const c = sv("deposit", P, R, y * 12, "monthlyCompound", 0);
  return { y, s: s.interest, c: c.interest, eq: c.interest / P / y };
});
const cmp1 = cmpRows[0];
const cmp20 = cmpRows[cmpRows.length - 1];

const EFF_RATES = [0.02, 0.03, 0.04, 0.05, 0.06];
const eff = (r: number) => (1 + r / 12) ** 12 - 1;
const eff4 = eff(0.04) - 0.04;

// C씨: 1년 단리 예금을 만기마다 세후 원리금 전부 다시 넣기, 5년
const LADDER_Y = 5;
const ladder: { y: number; start: number; interest: number; tax: number; end: number }[] = [];
{
  let start = P;
  for (let y = 1; y <= LADDER_Y; y++) {
    const x = sv("deposit", start, R, 12);
    ladder.push({ y, start, interest: x.interest, tax: x.tax, end: x.afterTax });
    start = x.afterTax;
  }
}
const ladderEnd = ladder[ladder.length - 1].end;
const oneYear = sv("deposit", P, R, 12);
const spentEachYear = net(oneYear) * LADDER_Y; // 이자를 매년 찾아 쓴 경우의 세후 이자 합계
const mc5 = sv("deposit", P, R, LADDER_Y * 12, "monthlyCompound");

// 적금 월 50만 원 단리 vs 월복리
const I_AMT = 500_000;
const instRows = [12, 24, 36, 60].map((m) => {
  const s = sv("installment", I_AMT, R, m);
  const c = sv("installment", I_AMT, R, m, "monthlyCompound");
  const units = (m * (m + 1)) / 2;
  return { m, s: net(s), c: net(c), eq: (c.interest / (I_AMT * units)) * 12 };
});
const inst36 = instRows[2];

export const compoundGuide: GuideExtra = {
  updated: "2026-11-23",
  mode: "append",
  sections: [
    {
      heading: "1천만 원 예금, 기간별로 본 단리와 월복리",
      body: [
        `위의 3년 예시를 기간별로 넓혀 보았습니다. 원금 ${krw(P)}, 연 ${rt(R)}(예시)로 같고 세금을 떼기 전 이자를 비교했습니다. 오른쪽 끝 칸은 월복리 이자를 단리로 받으려면 금리가 몇 %여야 하는지 거꾸로 구한 값입니다.`,
      ],
      table: {
        caption: `예금 ${krw(P)}, 연 ${rt(R)}(예시): 단리와 월복리의 세전 이자`,
        head: ["기간", "단리 이자", "월복리 이자", "차이", "월복리를 단리로 환산한 연 금리"],
        rows: cmpRows.map(({ y, s, c, eq }) => [`${y}년`, won(s), won(c), won(c - s), pc(eq, 3)]),
        note: "세전 기준이며 원 단위 미만은 버렸습니다. 실제로 10년, 20년 동안 같은 금리로 월복리 이자를 주는 예금은 드물어, 긴 기간은 복리의 원리를 보여 주기 위한 계산입니다.",
      },
      after: [
        `1년에서는 월복리가 단리보다 ${won(cmp1.c - cmp1.s)} 많을 뿐이고, 단리로 환산하면 연 ${pc(cmp1.eq, 3)}입니다. 즉 1년짜리 예금이라면 월복리 ${rt(R)}와 단리 ${pc(cmp1.eq, 3)}가 같은 이자를 줍니다.`,
        `반면 20년이 되면 차이가 ${krw(cmp20.c - cmp20.s)}으로 커지고, 단리로 환산한 금리도 연 ${pc(cmp20.eq, 2)}까지 올라갑니다. 복리의 효과는 처음에는 작다가 시간이 지날수록 가파르게 커집니다.`,
      ],
    },
    {
      heading: "표시 금리와 실제 1년 수익률",
      body: [
        "월복리 상품의 연 금리는 12로 나눠 매달 적용하는 금리라서, 1년 동안 실제로 불어나는 비율은 표시 금리보다 조금 높습니다. 이것을 실효 연 수익률이라고 하며 (1 + 연 금리 ÷ 12)^12 − 1로 구합니다.",
      ],
      table: {
        caption: "월복리 표시 금리별 1년 실효 수익률",
        head: ["표시 금리(예시)", "실효 연 수익률(세전)", "표시 금리와의 차이", `세후 실효 수익률(${pc(TAX_NORMAL, 1)})`],
        rows: EFF_RATES.map((r) => [`연 ${rt(r)}`, pc(eff(r), 3), `${((eff(r) - r) * 100).toFixed(3)}%포인트`, pc(eff(r) * (1 - TAX_NORMAL), 3)]),
        note: "1년 동안 같은 금리가 유지되고, 세금은 만기에 이자 전체에서 한 번 뗀다고 가정했습니다.",
      },
      after: [
        `연 4%라도 복리로 늘어나는 몫은 ${(eff4 * 100).toFixed(2)}%포인트 정도입니다. 광고에 나온 '연 ○%'가 단리인지 복리인지, 세전인지 세후인지부터 확인하면 서로 다른 상품을 같은 기준으로 놓고 비교할 수 있습니다.`,
      ],
    },
    {
      heading: "만기마다 원리금을 다시 넣는 C씨의 5년",
      body: [
        `월복리 상품이 아니어도 만기 때마다 원금과 이자를 함께 다시 넣으면 복리와 같은 효과가 납니다. C씨가 ${krw(P)}을 1년 단리 정기예금(연 ${rt(R)}, 예시)에 넣고, 만기마다 세후 원리금을 모두 다시 1년 예금에 넣는다고 해 보겠습니다. 금리는 5년 내내 같다고 가정합니다.`,
        `첫해 이자는 ${won(P)} × ${rt(R)} = ${won(ladder[0].interest)}이고, 이자소득세 ${won(ladder[0].tax)}을 떼면 연말에 ${won(ladder[0].end)}이 됩니다. 둘째 해에는 이 금액이 새 원금이 되어 이자가 ${won(ladder[1].interest)}으로 조금 늘어납니다.`,
      ],
      table: {
        caption: `C씨: ${krw(P)}, 연 ${rt(R)}(예시) 1년 예금을 5년 동안 다시 넣기`,
        head: ["연차", "연초 원금", "세전 이자", "이자소득세", "연말 세후 원리금"],
        rows: ladder.map(({ y, start, interest, tax, end }) => [`${y}년차`, won(start), won(interest), won(tax), won(end)]),
        note: `세금은 매년 만기 때 ${pc(TAX_NORMAL, 1)}를 떼는 것으로 계산했습니다(10원 미만 버림).`,
      },
      after: [
        `5년 뒤 C씨의 돈은 ${won(ladderEnd)}입니다. 이자를 매년 찾아 써서 원금이 ${krw(P)}으로 그대로였다면 5년 동안 받은 세후 이자는 ${won(spentEachYear)}이므로, 다시 넣은 덕분에 ${won(ladderEnd - P - spentEachYear)}을 더 받은 셈입니다.`,
        `같은 5년을 월복리 연 ${rt(R)} 예금 하나로 묶고 세금을 만기에 한 번만 뗀다고 가정하면 ${won(mc5.afterTax)}이 됩니다. 이자가 매달 불어나고, 중간에 세금이 빠지지 않은 채로 이자에 다시 이자가 붙기 때문입니다. 다만 긴 만기 상품은 금리가 따로 정해지고 중간에 꺼내기 어려우므로, 실제로는 금리 차이와 돈을 쓸 시점을 함께 따져야 합니다.`,
      ],
    },
    {
      heading: "적금은 월복리여도 차이가 작은 이유",
      body: [
        `적금은 매달 넣은 돈마다 머무는 기간이 달라, 나중에 넣은 돈일수록 복리가 작용할 시간이 짧습니다. 월 ${krw(I_AMT)}을 연 ${rt(R)}(예시)로 넣을 때 단리와 월복리의 세후 이자를 비교했습니다.`,
      ],
      table: {
        caption: `적금 월 ${krw(I_AMT)}, 연 ${rt(R)}(예시): 단리와 월복리의 세후 이자`,
        head: ["기간", "단리 세후 이자", "월복리 세후 이자", "차이", "월복리를 단리로 환산한 연 금리"],
        rows: instRows.map(({ m, s, c, eq }) => [`${m}개월`, won(s), won(c), won(c - s), pc(eq, 3)]),
        note: `일반과세 ${pc(TAX_NORMAL, 1)}, 이자는 원 단위 미만·세금은 10원 미만 버림. 환산 금리는 월복리 세전 이자와 같은 이자를 주는 단리 적금 금리입니다.`,
      },
      after: [
        `3년 적금에서 월복리로 더 받는 세후 이자는 ${won(inst36.c - inst36.s)}이고, 단리로 바꾸면 금리가 연 ${rt(R)}에서 ${pc(inst36.eq, 3)}로 오르는 정도입니다. 서로 다른 적금을 비교할 때는 '복리'라는 말보다 이 환산 금리를 단리 상품의 금리와 나란히 놓고 보면 어느 쪽이 실제로 이자를 더 주는지 바로 알 수 있습니다.`,
      ],
    },
    {
      heading: "복리 계산에서 자주 하는 착각",
      body: [
        "월복리 예금이라도 이자는 보통 만기에 한꺼번에 받습니다. 중간에 해지하면 복리로 불어난 이자가 아니라 중도해지 이율로 다시 계산하므로, 복리 효과는 만기까지 유지했을 때만 온전히 얻을 수 있습니다.",
        "만기마다 다시 넣는 방식은 다음 해에도 같은 금리를 받을 수 있다는 보장이 없습니다. 위의 C씨 계산은 금리가 5년 내내 같다는 가정이고, 실제로는 재예치할 때의 금리에 따라 결과가 달라집니다.",
        "투자 상품의 '연평균 수익률'을 예금 금리와 같은 것으로 보면 안 됩니다. 예금 금리는 약정된 이자이지만, 투자 상품의 수익률은 지난 성과를 평균한 값이라 앞으로도 그렇다는 보장이 없고 원금 손실이 날 수도 있습니다.",
      ],
    },
  ],
  sources: [SRC.ntsRate, SRC.incomeTaxLaw, SRC.finlife],
};

// ===== 예금·적금 이자 계산기 =====
// 계산기 기본값: 적금, 월 50만 원, 연 3.5%, 12개월, 단리
const DEF_AMT = 500_000;
const DEF_R = 0.035;
const DEF_M = 12;
const taxRows = [
  { label: "일반과세(계산기 항목)", rate: TAX_NORMAL },
  { label: "세금우대(계산기 항목)", rate: TAX_PREF },
  { label: "비과세(계산기 항목)", rate: TAX_EXEMPT },
  { label: "조합 예탁금 비과세 대상(직접 계산)", rate: TAX_COOP_EXEMPT },
  { label: "조합 예탁금 2026년 가입·요건 미충족(직접 계산)", rate: TAX_COOP_2026 },
].map((t) => ({ ...t, x: sv("installment", DEF_AMT, DEF_R, DEF_M, "simple", t.rate) }));
const defNormal = taxRows[0].x;
const defExempt = taxRows[2].x;
const coopManualTax = Math.floor((defExempt.interest * TAX_COOP_EXEMPT) / 10) * 10;

export const savingsTool: ToolExtra = {
  updated: "2026-11-23",
  sections: [
    {
      heading: "계산 예시: 기본값으로 과세 구분만 바꾸면",
      body: [
        `계산기를 처음 열면 적금, 월 ${won(DEF_AMT)}, 연 ${rt(DEF_R)}, ${DEF_M}개월, 단리가 들어 있습니다. 이 조건에서 원금 합계는 ${won(defNormal.principal)}, 세전 이자는 ${won(defNormal.interest)}이고, 과세 구분에 따라 손에 쥐는 돈이 아래처럼 달라집니다. 계산기 목록에 없는 두 세율은 같은 방식으로 직접 계산한 값입니다.`,
      ],
      table: {
        caption: `적금 월 ${won(DEF_AMT)}, 연 ${rt(DEF_R)}, ${DEF_M}개월, 단리`,
        head: ["과세 구분", "세율", "세금", "세후 이자", "만기 수령액"],
        rows: taxRows.map(({ label, rate, x }) => [label, pc(rate, 1), won(x.tax), won(net(x)), won(x.afterTax)]),
        note: "세금은 10원 미만을 버렸습니다. 조합 예탁금 세율에는 농어촌특별세가 포함되어 있으며, 실제 원천징수는 소득세와 농어촌특별세를 따로 계산해 끝전이 조금 다를 수 있습니다.",
      },
      after: [
        `일반과세와 비과세의 차이는 ${won(defNormal.tax)}입니다. 적금 이자 자체가 크지 않으면 세금 차이도 그만큼 작아서, 우대 조건이 까다로운 비과세·저율과세 상품보다 기본금리가 높은 일반 상품이 세후로 더 나은 경우도 있습니다. 두 상품을 각각 넣어 세후 수령액으로 비교해 보세요.`,
      ],
    },
    {
      heading: "과세 구분은 이렇게 고르세요(2026년 기준)",
      body: [
        `일반과세 ${pc(TAX_NORMAL, 1)}: 은행 예금·적금 대부분이 여기에 해당합니다. 소득세 14%와 지방소득세 1.4%를 합친 세율입니다.`,
        `비과세 0%: 비과세종합저축처럼 이자에 세금이 없는 경우에 고릅니다. 2026년부터 새로 가입하는 비과세종합저축은 65세 이상이면서 기초연금을 받는 사람, 등록 장애인, 독립유공자와 그 유족·가족, 국가유공자 중 상이자, 기초생활수급자 등만 가입할 수 있고, 모든 금융회사를 합쳐 1인당 원금 5천만 원까지입니다.`,
        `세금우대 ${pc(TAX_PREF, 1)}: 소득세 9%에 농어촌특별세를 더한 세율입니다. 2014년까지만 가입할 수 있었던 세금우대종합저축의 남은 계약, 그리고 2027년 이후 가입하는 조합 예탁금 가운데 조합원·소득 요건을 채우지 못한 경우(${pc(TAX_COOP_2027, 1)})가 여기에 해당합니다.`,
        `농협·수협·산림조합·신협·새마을금고의 조합 예탁금(1인당 3천만 원까지)은 2026~2028년에 가입해도 농협·수협·산림조합 조합원이거나 직전 해 총급여 7천만 원 이하 등 소득 요건을 채우면 이자소득세가 없고, 보통 농어촌특별세 ${pc(TAX_COOP_EXEMPT, 1)}만 냅니다. 이 세율은 목록에 없으므로 비과세로 계산한 세전 이자에 ${pc(TAX_COOP_EXEMPT, 1)}를 곱해 빼면 됩니다. 기본값이라면 ${won(defExempt.interest)} × ${pc(TAX_COOP_EXEMPT, 1)} ≒ ${won(coopManualTax)}입니다. 요건을 채우지 못하고 2026년에 가입했다면 ${pc(TAX_COOP_2026, 1)}로 같은 방식으로 계산합니다.`,
      ],
    },
    {
      heading: "끝전 처리와 계산 범위",
      body: [
        "이 계산기는 이자를 원 단위 미만에서 버리고, 세금은 10원 미만에서 버립니다. 적금은 회차마다 남은 개월 수만큼 이자를 따로 구해 더하고, 월복리를 고르면 회차마다 (1 + 연 금리 ÷ 12)^(남은 개월 수) − 1을 적용합니다.",
        "납입일이 늦어지거나 자유적립식처럼 회차마다 넣는 금액이 다른 경우, 우대금리가 기간 중간에 바뀌는 경우, 만기 후 이율은 반영하지 않습니다. 이런 상품은 금융회사가 안내하는 만기 예상 금액과 함께 보세요.",
      ],
    },
  ],
  sources: [SRC.taxLaw, SRC.nongteuk, SRC.ntsRate],
};
