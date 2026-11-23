import { calcSavings, type InterestType } from "@/lib/calculators/savings";
import { calcSavingsGoal } from "@/lib/calculators/savingsGoal";
import type { GuideExtra, ToolExtra } from "../types";
import { SRC, TAX_EXEMPT, TAX_NORMAL, krw, pc, rt, won } from "./fmt";

// 목표 저축 가이드(monthly-savings-plan)와 목표 저축 계산기(savings-goal) 보강.

const R = 0.035; // 계산기 기본 금리와 같은 예시 값
const goal = (target: number, months: number, type: InterestType = "simple", tax = TAX_NORMAL, rate = R) => calcSavingsGoal(target, months, rate, type, tax);
const inst = (amount: number, months: number, rate = R, tax = TAX_NORMAL) =>
  calcSavings({ kind: "installment", amount, annualRate: rate, months, interestType: "simple", taxRate: tax });
const dep = (amount: number, months: number, rate: number) =>
  calcSavings({ kind: "deposit", amount, annualRate: rate, months, interestType: "simple", taxRate: TAX_NORMAL });

// A. 목표 금액 × 기간
const TARGETS = [3_000_000, 5_000_000, 10_000_000, 30_000_000, 50_000_000];
const PERIODS = [12, 24, 36];
const g3y30 = goal(30_000_000, 36);

// B. 1,000만 원, 기간별 이자 효과
const B_T = 10_000_000;
const bRows = [1, 2, 3, 5].map((y) => {
  const g = goal(B_T, y * 12);
  return { y, plain: g.withoutInterest, monthly: g.monthly, saved: g.withoutInterest - g.monthly, netInt: g.interest - g.tax };
});

// C. D씨: 3년 뒤 3,000만 원
const D_T = 30_000_000;
const D_M = 36;
const dBase = goal(D_T, D_M);
const dLonger = goal(D_T, 48);
const dSmaller = goal(25_000_000, D_M);
const dPlainMonthly = Math.ceil(D_T / D_M);
const dExempt = goal(D_T, D_M, "simple", TAX_EXEMPT);

// 1년 적금 + 예금 굴리기 vs 3년 적금(같은 금리, 월 100만 원)
const LAD_M = 1_000_000;
const y1 = inst(LAD_M, 12).afterTax; // 매년 1년 적금 만기금(세후)
const afterY2 = dep(y1, 12, R).afterTax + y1; // 1년차 만기금을 1년 예금 → 2년차 말
const ladderTotal = dep(afterY2, 12, R).afterTax + y1; // 2년차 말 목돈을 다시 1년 예금 + 3년차 적금 만기금
const threeYear = inst(LAD_M, 36).afterTax;
const ladderGain = ladderTotal - threeYear;

// D. 월 저축액으로 거꾸로 보기
const MONTHLY = [200_000, 300_000, 500_000, 1_000_000];
const YEARS = [1, 2, 3, 5];

// 물가 가정
const INFL = 0.02;
const inflNeed = D_T * (1 + INFL) ** 3;

export const goalGuide: GuideExtra = {
  updated: "2026-11-23",
  mode: "append",
  sections: [
    {
      heading: "목표 금액·기간별 월 저축액 표",
      body: [
        `자주 세우는 목표 금액과 기간 조합으로 매달 넣어야 할 금액을 계산했습니다. 적금 금리는 연 ${rt(R)}(예시) 단리이고, 이자소득세 ${pc(TAX_NORMAL, 1)}를 뺀 만기 세후 수령액이 목표 금액 이상이 되도록 100원 단위로 올렸습니다.`,
      ],
      table: {
        caption: `목표 금액을 만들기 위한 월 저축액(연 ${rt(R)} 단리 적금, 예시)`,
        head: ["목표 금액(세후)", ...PERIODS.map((m) => `${m / 12}년(${m}개월)`)],
        rows: TARGETS.map((t) => [krw(t), ...PERIODS.map((m) => won(goal(t, m).monthly))]),
        note: "목표 저축 계산기와 같은 방식으로 계산했습니다. 실제 적금은 기간별로 금리가 다르고 월 납입 한도가 있는 상품이 많아, 큰 금액은 여러 계좌로 나눠야 할 수 있습니다.",
      },
      after: [
        `예를 들어 3년 동안 ${krw(30_000_000)}을 모으려면 매달 ${won(g3y30.monthly)}이 필요합니다. 이자 없이 36으로 나눈 금액(${won(g3y30.withoutInterest)})보다 ${won(g3y30.withoutInterest - g3y30.monthly)} 적습니다.`,
      ],
    },
    {
      heading: "기간별로 본 이자의 몫",
      body: [
        `같은 ${krw(B_T)}을 1년, 2년, 3년, 5년에 걸쳐 모을 때 적금 이자가 얼마나 거드는지 비교했습니다. 금리는 연 ${rt(R)}로 기간 내내 같다고 가정했습니다.`,
      ],
      table: {
        caption: `${krw(B_T)} 모으기: 이자 없이 vs 연 ${rt(R)} 적금(예시)`,
        head: ["기간", "이자 없이 매달", "적금으로 매달", "매달 줄어드는 금액", "만기 세후 이자", "목표 중 이자로 채우는 비율"],
        rows: bRows.map(({ y, plain, monthly, saved, netInt }) => [`${y}년`, won(plain), won(monthly), won(saved), won(netInt), pc(netInt / B_T, 1)]),
        note: "5년 적금은 흔하지 않아, 5년 칸은 같은 금리가 계속된다고 가정한 계산입니다.",
      },
      after: [
        `매달 줄어드는 금액은 1년이면 ${won(bRows[0].saved)}, 5년이면 ${won(bRows[3].saved)}으로 기간이 달라도 1만 원대에 머뭅니다. 기간이 길어지면 이자가 붙는 시간은 늘지만, 매달 넣는 돈 자체가 작아지기 때문입니다.`,
        `대신 목표 가운데 이자로 채우는 비율은 1년 ${pc(bRows[0].netInt / B_T, 1)}에서 5년 ${pc(bRows[3].netInt / B_T, 1)}로 커집니다. 어느 기간이든 목표의 대부분은 내가 넣는 원금으로 채워지므로, 금리를 고르는 일보다 월 저축액을 먼저 확보하는 일이 결과를 좌우합니다.`,
      ],
    },
    {
      heading: "3년 뒤 3,000만 원, D씨의 계획 세우기",
      body: [
        `D씨는 3년(${D_M}개월) 뒤 전세 보증금 증액분으로 ${krw(D_T)}이 필요합니다. 연 ${rt(R)} 단리 적금(예시)을 기준으로 단계별로 계산해 보겠습니다.`,
        `① 목표를 세후 금액으로 정합니다. 필요한 돈은 만기에 손에 쥐는 ${krw(D_T)}입니다.`,
        `② 이자 없이 나누면 매달 ${won(dPlainMonthly)}이 필요합니다.`,
        `③ 목표 저축 계산기에 넣으면 월 ${won(dBase.monthly)}이 나옵니다. 이렇게 넣으면 원금 합계 ${won(dBase.principal)}에 세후 이자 ${won(dBase.interest - dBase.tax)}이 붙어 만기에 ${won(dBase.afterTax)}을 받습니다.`,
        `④ 월 ${won(dBase.monthly)}이 부담된다면 기간이나 목표를 조정합니다. 아래 표처럼 기간을 1년 늘리거나 목표를 줄였을 때의 금액을 비교해 감당할 수 있는 조합을 고릅니다.`,
      ],
      table: {
        caption: `D씨의 선택지(연 ${rt(R)} 단리, 일반과세, 예시)`,
        head: ["선택지", "월 저축액", "원금 합계", "만기 세후 수령액"],
        rows: [
          [`3년·${krw(D_T)}`, won(dBase.monthly), won(dBase.principal), won(dBase.afterTax)],
          [`4년·${krw(D_T)}`, won(dLonger.monthly), won(dLonger.principal), won(dLonger.afterTax)],
          [`3년·${krw(25_000_000)}`, won(dSmaller.monthly), won(dSmaller.principal), won(dSmaller.afterTax)],
          [`이자 없이 3년·${krw(D_T)}`, won(dPlainMonthly), won(dPlainMonthly * D_M), won(dPlainMonthly * D_M)],
        ],
        note: "월 저축액은 100원 단위로 올렸습니다. 4년 칸은 4년 동안 같은 금리의 적금을 유지한다고 가정했습니다.",
      },
      after: [
        `위에서 소개한 '1년 적금이 끝날 때마다 예금으로 옮기는 방법'도 같은 금리로 계산해 보면, 매달 ${krw(LAD_M)}씩 3년을 넣을 때 3년 적금 하나는 ${won(threeYear)}, 1년 적금 세 번과 예금을 이어 쓰는 방법은 ${won(ladderTotal)}입니다. 차이는 ${won(ladderGain)}(${pc(ladderGain / threeYear, 2)})로, 1년마다 받은 이자가 다음 해 예금 원금에 더해지기 때문입니다.`,
        "금리가 같다면 두 방법의 차이는 이 정도로 작습니다. 실제로는 1년 상품과 3년 상품의 금리 차이, 그리고 중간에 돈을 꺼낼 수 있는지가 결과를 더 크게 좌우하므로, 가입 시점의 두 금리를 각각 넣어 비교해 보세요.",
      ],
    },
    {
      heading: "매달 넣을 수 있는 돈으로 거꾸로 보기",
      body: [
        "목표 금액이 아직 막연하다면 매달 무리 없이 넣을 수 있는 금액부터 정하고, 기간별로 얼마가 모이는지 보는 방법도 있습니다. 모이는 금액을 보고 나서 목표를 정하면 지키기 어려운 계획을 세울 가능성이 줄어듭니다.",
      ],
      table: {
        caption: `월 저축액별 만기 세후 수령액(연 ${rt(R)} 단리 적금, 예시)`,
        head: ["월 저축액", ...YEARS.map((y) => `${y}년 뒤`)],
        rows: MONTHLY.map((m) => [won(m), ...YEARS.map((y) => krw(inst(m, y * 12).afterTax))]),
        note: `일반과세 ${pc(TAX_NORMAL, 1)} 기준, 만 원 단위에서 반올림했습니다. 5년 칸은 같은 금리가 계속된다고 가정한 값입니다.`,
      },
    },
    {
      heading: "계획이 틀어지는 흔한 이유",
      body: [
        "목표를 세전 금액으로 잡는 경우가 있습니다. 적금 안내의 '만기 예상 금액'이 세전인지 세후인지 확인하세요. 목표 저축 계산기는 이자소득세를 뺀 세후 금액을 기준으로 맞춥니다.",
        `물가를 빼먹는 경우도 있습니다. 지금 ${krw(D_T)}이면 되는 목표라도 필요한 금액이 해마다 ${rt(INFL)}씩 오른다고 가정하면 3년 뒤에는 ${krw(inflNeed)}이 필요합니다. 기간이 긴 목표일수록 목표 금액에 여유를 두는 편이 안전합니다.`,
        `비과세 대상인데 일반과세로 계산하는 경우도 있습니다. 기초연금을 받는 65세 이상, 등록 장애인 등 비과세종합저축 가입 대상이라면 1인당 원금 5천만 원까지 이자에 세금이 붙지 않습니다. D씨의 목표를 비과세로 계산하면 월 ${won(dExempt.monthly)}으로, 일반과세보다 매달 ${won(dBase.monthly - dExempt.monthly)} 줄어듭니다.`,
        "목돈이 커지면 보호 한도도 확인하세요. 예금자보호는 금융회사별로 원금과 소정의 이자를 합쳐 1인당 1억 원까지입니다. 목표 금액이 이보다 크다면 만기 수령액이 한도를 넘지 않도록 금융회사를 나누는 방법을 생각해 볼 수 있습니다.",
      ],
    },
  ],
  sources: [SRC.finlife, SRC.ntsRate, SRC.taxLaw, SRC.kdic],
};

// ===== 목표 저축 계산기 =====
// 계산기 기본값: 목표 1,000만 원, 24개월, 연 3.5%, 단리, 일반과세
const T = 10_000_000;
const M = 24;
const combos = [
  { label: "단리·일반과세(기본값)", type: "simple" as InterestType, tax: TAX_NORMAL },
  { label: "월복리·일반과세", type: "monthlyCompound" as InterestType, tax: TAX_NORMAL },
  { label: "단리·비과세", type: "simple" as InterestType, tax: TAX_EXEMPT },
  { label: "월복리·비과세", type: "monthlyCompound" as InterestType, tax: TAX_EXEMPT },
].map((c) => ({ ...c, g: goal(T, M, c.type, c.tax) }));
const base = combos[0].g;
const compound = combos[1].g;

// 이미 모아 둔 돈이 있을 때
const HAVE = 3_000_000;
const HAVE_R = 0.03; // 예금 금리 예시
const haveDep = calcSavings({ kind: "deposit", amount: HAVE, annualRate: HAVE_R, months: M, interestType: "simple", taxRate: TAX_NORMAL });
const rest = T - haveDep.afterTax;
const restGoal = goal(rest, M);

export const goalTool: ToolExtra = {
  updated: "2026-11-23",
  sections: [
    {
      heading: "계산 예시: 2년 뒤 1,000만 원",
      body: [
        `계산기 기본값은 목표 ${krw(T)}, ${M}개월, 연 ${rt(R)}, 단리, 일반과세입니다. 이자 방식과 과세만 바꿔 가며 필요한 월 납입액을 비교했습니다.`,
      ],
      table: {
        caption: `목표 ${krw(T)}, ${M}개월, 연 ${rt(R)}(예시)`,
        head: ["이자 방식·과세", "필요한 월 납입액", "원금 합계", "만기 세후 수령액", "목표보다 많은 금액"],
        rows: [
          ...combos.map(({ label, g }) => [label, won(g.monthly), won(g.principal), won(g.afterTax), won(g.afterTax - T)]),
          ["이자 없이 모을 때", won(base.withoutInterest), won(base.withoutInterest * M), won(base.withoutInterest * M), won(base.withoutInterest * M - T)],
        ],
        note: "월 납입액은 100원 단위로 올렸습니다. 이자는 원 단위 미만을, 세금은 10원 미만을 버렸습니다.",
      },
      after: [
        `월복리로 바꾸면 필요한 월 납입액이 ${won(base.monthly - compound.monthly)} 줄어듭니다. 2년 적금에서는 이자 방식보다 매달 넣는 금액 자체가 결과를 훨씬 크게 좌우한다는 것을 숫자로 확인할 수 있습니다.`,
      ],
    },
    {
      heading: "결과가 목표보다 조금 많은 이유",
      body: [
        `계산기는 월 납입액을 100원 단위로 올려서 보여 줍니다. 그래서 결과 금액을 그대로 넣으면 만기 세후 수령액이 목표를 넘고, 기본값에서는 ${won(base.afterTax - T)}이 더 모입니다. 100원 단위로 내리면 목표에 조금 못 미치므로, 자동이체 금액은 계산 결과보다 낮추지 않는 것이 좋습니다.`,
        "실제 적금은 이자를 날짜 수로 계산하거나 납입일이 늦어지면 이자가 줄어드는 경우가 있어, 계산 결과와 몇백 원에서 몇천 원 차이가 날 수 있습니다. 목표가 빠듯하다면 월 납입액을 천 원 단위로 조금 넉넉하게 정해 두세요.",
      ],
    },
    {
      heading: "이미 모아 둔 돈이 있을 때 계산하는 순서",
      body: [
        `이미 ${krw(HAVE)}이 있고 2년 뒤 ${krw(T)}을 만들고 싶다고 해 보겠습니다. 먼저 모아 둔 돈이 2년 뒤 얼마가 되는지 구합니다. ${krw(HAVE)}을 연 ${rt(HAVE_R)}(예시) 2년 단리 예금에 넣으면 세후 ${won(haveDep.afterTax)}이 됩니다.`,
        `다음으로 목표에서 이 금액을 뺀 ${won(rest)}을 목표 금액 칸에 넣습니다. 같은 ${M}개월, 연 ${rt(R)} 조건이면 필요한 월 납입액은 ${won(restGoal.monthly)}입니다. 모아 둔 돈 없이 시작할 때(${won(base.monthly)})보다 매달 ${won(base.monthly - restGoal.monthly)} 적게 넣어도 됩니다.`,
        "모아 둔 돈의 예금 금리와 새로 가입할 적금 금리가 다르다면 각각의 실제 금리를 넣어 계산하세요. 예금 이자는 예금·적금 이자 계산기에서 예금을 골라 구할 수 있습니다.",
      ],
    },
  ],
  sources: [SRC.finlife, SRC.ntsRate, SRC.taxLaw],
};
