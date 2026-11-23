import { RATES } from "@/data/rates/2026";
import { calcNetSalary } from "@/lib/calculators/netSalary";
import type { GuideExtra } from "../types";
import { krw, pr, won } from "./fmt";

// 소득세법 제47조 근로소득공제(한도 2,000만 원). 연봉 실수령액 계산기(netSalary.ts)와 같은 표입니다.
function earnedIncomeDeduction(g: number) {
  let d: number;
  if (g <= 5_000_000) d = g * 0.7;
  else if (g <= 15_000_000) d = 3_500_000 + (g - 5_000_000) * 0.4;
  else if (g <= 45_000_000) d = 7_500_000 + (g - 15_000_000) * 0.15;
  else if (g <= 100_000_000) d = 12_000_000 + (g - 45_000_000) * 0.05;
  else d = 14_750_000 + (g - 100_000_000) * 0.02;
  return Math.min(d, 20_000_000);
}

// 소득세법 제55조 기본세율(RATES.incomeTax.brackets)로 산출세액 계산
function progressiveTax(base: number) {
  let tax = 0;
  let prev = 0;
  for (const b of RATES.incomeTax.brackets) {
    if (base <= prev) break;
    tax += (Math.min(base, b.upTo) - prev) * b.rate;
    prev = b.upTo;
  }
  return tax;
}

// 소득세법 제59조 근로소득세액공제(공제액과 총급여별 한도)
function earnedTaxCredit(tax: number, gross: number) {
  const credit = tax <= 1_300_000 ? tax * 0.55 : 715_000 + (tax - 1_300_000) * 0.3;
  let limit: number;
  if (gross <= 33_000_000) limit = 740_000;
  else if (gross <= 70_000_000) limit = Math.max(660_000, 740_000 - (gross - 33_000_000) * 0.008);
  else if (gross <= 120_000_000) limit = Math.max(500_000, 660_000 - (gross - 70_000_000) * 0.5);
  else limit = Math.max(200_000, 500_000 - (gross - 120_000_000) * 0.5);
  return Math.min(credit, limit);
}

// 표 1: 과세표준 구간별 세율과 누진공제
const brackets = RATES.incomeTax.brackets;
const bracketRows = brackets.map((b, i) => {
  const lower = i === 0 ? 0 : brackets[i - 1].upTo;
  const progressiveDeduction = lower * b.rate - progressiveTax(lower);
  const label =
    i === 0
      ? `${krw(b.upTo)} 이하`
      : b.upTo === Infinity
        ? `${krw(lower)} 초과`
        : `${krw(lower)} 초과 ${krw(b.upTo)} 이하`;
  return [label, pr(b.rate), i === 0 ? "-" : won(progressiveDeduction), won(1_000_000 * b.rate * (1 + RATES.localTaxRate))];
});
const sampleBase = 30_000_000;
const sampleBracket = brackets.find((b) => sampleBase <= b.upTo)!;
const sampleIdx = brackets.indexOf(sampleBracket);
const sampleDeduction = brackets[sampleIdx - 1].upTo * sampleBracket.rate - progressiveTax(brackets[sampleIdx - 1].upTo);

// 계산 예시: 연봉 4,240만 원(식대 월 20만 원 비과세), 본인 1명
const exAnnual = 42_400_000;
const exMeal = RATES.incomeTax.mealTaxFreeLimit;
const exNet = calcNetSalary({ annualSalary: exAnnual, monthlyNonTaxable: exMeal, dependents: 1, children: 0 });
const G = exAnnual - exMeal * 12; // 총급여
const eid = earnedIncomeDeduction(G);
const incomeAmount = G - eid;
const pensionYear = exNet.pension * 12;
const insYear = (exNet.health + exNet.longTermCare + exNet.employment) * 12;
const personal = RATES.incomeTax.personalDeduction;
const taxBase = Math.max(0, incomeAmount - personal - pensionYear - insYear);
const exBracket = brackets.find((b) => taxBase <= b.upTo)!;
const exBracketIdx = brackets.indexOf(exBracket);
const exProgDed = exBracketIdx === 0 ? 0 : brackets[exBracketIdx - 1].upTo * exBracket.rate - progressiveTax(brackets[exBracketIdx - 1].upTo);
const calculated = progressiveTax(taxBase);
const etc = earnedTaxCredit(calculated, G);
const D = Math.floor(Math.max(0, calculated - etc)); // 결정세액(원 미만 버림)

// 원천징수 비율별 결과: 결정세액을 12로 나눈 금액을 매달 100%로 뗐다고 가정
const pensionSaving = 3_000_000;
const pensionCreditRate = G <= 55_000_000 ? 0.15 : 0.12; // 소득세법 제59조의3
const pensionCredit = pensionSaving * pensionCreditRate;
const D2 = Math.max(0, D - pensionCredit);
const ratios = [0.8, 1, 1.2];
const settle = (prepaid: number, decided: number) => {
  const diff = Math.round(prepaid - decided);
  if (diff > 0) return `환급 ${won(diff)}`;
  if (diff < 0) return `추가 납부 ${won(-diff)}`;
  return "0원";
};
const additional80 = Math.round(D - D * 0.8);

export const yearEndTaxGuideExtra: GuideExtra = {
  updated: "2026-11-23",
  mode: "append",
  sections: [
    {
      heading: "과세표준 구간별 세율과 누진공제",
      body: [
        "산출세액은 과세표준을 구간별로 나눠 각 구간의 세율을 곱해 더한 값입니다. 빠르게 계산할 때는 '과세표준 × 그 구간 세율 − 누진공제'를 쓰면 같은 결과가 나옵니다.",
        `아래 표는 ${RATES.year}년 소득세 기본세율로 구간별 누진공제를 계산하고, 소득공제 100만 원이 줄여 주는 세금을 지방소득세까지 더해 적은 것입니다.`,
      ],
      table: {
        caption: `${RATES.year}년 종합소득세 기본세율과 누진공제`,
        head: ["과세표준", "세율", "누진공제", "소득공제 100만 원의 효과"],
        rows: bracketRows,
        note: "누진공제 = 구간 시작 금액 × 그 구간 세율 − 시작 금액까지의 세금. 소득공제 효과는 과세표준이 같은 구간 안에 머무를 때의 값이며, 지방소득세(소득세의 10%)를 포함했습니다.",
      },
      after: [
        `예를 들어 과세표준이 ${krw(sampleBase)}이면 ${krw(sampleBase)} × ${pr(sampleBracket.rate)} − ${won(sampleDeduction)} = ${won(progressiveTax(sampleBase))}이 산출세액입니다. 여기서 세액공제를 빼야 실제로 내는 결정세액이 됩니다.`,
      ],
    },
    {
      heading: "연봉 4,240만 원 직장인의 계산 예시",
      body: [
        "최 씨의 연봉은 4,240만 원이고, 이 중 식대 월 20만 원은 비과세입니다. 부양가족이 없고 다른 공제 자료도 없다고 가정해 연말정산 순서대로 계산해 보겠습니다.",
        `1단계, 총급여: 연봉 ${won(exAnnual)}에서 비과세 식대 ${won(exMeal * 12)}을 빼면 총급여는 ${won(G)}입니다.`,
        `2단계, 근로소득금액: 총급여 1,500만 원 초과 4,500만 원 이하 구간의 근로소득공제는 750만 원 + 1,500만 원 초과분의 15%라 ${won(eid)}입니다. 총급여에서 빼면 근로소득금액은 ${won(incomeAmount)}입니다.`,
        `3단계, 과세표준: 본인 기본공제 ${won(personal)}, 국민연금 보험료 ${won(pensionYear)}, 건강·장기요양·고용보험료 ${won(insYear)}을 빼면 과세표준은 ${won(taxBase)}입니다.`,
        `4단계, 산출세액: ${won(taxBase)} × ${pr(exBracket.rate)} − ${won(exProgDed)} = ${won(calculated)}입니다.`,
        `5단계, 결정세액: 근로소득세액공제 ${won(etc)}을 빼면 결정세액은 ${won(D)}이고, 지방소득세는 그 10%인 ${won(D * RATES.localTaxRate)}입니다. 1년 동안 미리 낸 소득세가 이보다 많으면 차액을 돌려받고, 적으면 더 냅니다.`,
      ],
    },
    {
      heading: "원천징수 비율에 따라 달라지는 결과",
      body: [
        "직장인은 매달 떼는 소득세를 간이세액표 금액의 80%, 100%, 120% 가운데 골라 회사에 신청할 수 있습니다. 80%를 고르면 월급이 조금 늘지만 덜 낸 만큼 연말정산에서 더 내고, 120%를 고르면 반대로 더 돌려받습니다. 위 최 씨의 예로 비교하면 다음과 같습니다.",
      ],
      table: {
        caption: "최 씨(총급여 4,000만 원)의 원천징수 비율별 연말정산 결과(소득세 기준)",
        head: ["원천징수 비율", "1년 동안 미리 낸 소득세", "공제 추가 없음", `연금저축 ${krw(pensionSaving)} 납입`],
        rows: ratios.map((r) => [`${Math.round(r * 100)}%`, won(D * r), settle(D * r, D), settle(D * r, D2)]),
        note: `간이세액표 대신 최 씨의 결정세액(${won(D)})을 12로 나눈 금액을 매달 100%로 뗐다고 가정했습니다. 연금저축은 총급여 5,500만 원 이하라 ${pr(pensionCreditRate)} 세액공제(${won(pensionCredit)})를 적용했습니다. 지방소득세는 표 금액의 10%가 따로 더해지거나 돌려받습니다.`,
      },
      after: [
        "환급을 많이 받았다고 세금을 덜 낸 것은 아닙니다. 1년 동안 미리 더 냈다가 돌려받을 뿐이고, 최종 세금은 결정세액으로 같습니다. 매달 손에 쥐는 돈을 늘리고 싶다면 80%, 연초에 한꺼번에 돌려받고 싶다면 120%를 고르는 식으로 정하면 됩니다. 바꾼 비율은 신청한 뒤 지급하는 월급부터 그해 말까지 적용됩니다.",
      ],
    },
    {
      heading: "추가 납부가 생기는 대표적인 경우",
      body: [
        "① 원천징수 비율을 80%로 고른 경우: 위 표처럼 공제 자료가 많지 않으면 덜 낸 만큼 연말정산에서 냅니다.",
        "② 해 중간에 회사를 옮긴 경우: 새 회사는 전 회사 급여를 모른 채 자기 급여만으로 세금을 뗍니다. 전 회사의 근로소득 원천징수영수증을 내 두 급여를 합치면 과세표준이 더 높은 구간으로 올라가 추가 납부가 생기기 쉽습니다. 전 회사 소득을 합치지 않고 연말정산을 끝냈다면 5월에 종합소득세를 직접 신고해야 합니다.",
        "③ 두 곳에서 동시에 월급을 받는 경우: 주된 근무지가 아닌 곳은 본인 기본공제와 표준세액공제만 있는 것으로 보고 세금을 떼기 때문에, 두 급여를 합쳐 정산하면 세금이 더 나오는 경우가 많습니다.",
        "④ 부양가족 공제를 잘못 넣은 경우: 소득 기준을 넘는 가족을 넣었거나 형제가 같은 부모를 함께 공제했다면, 나중에 공제가 취소되면서 덜 낸 세금과 가산세를 내야 할 수 있습니다.",
        "⑤ 공제 자료가 줄어든 경우: 지난해에는 의료비나 교육비가 많아 환급을 받았는데 올해는 그런 지출이 없다면, 같은 연봉이라도 결과가 추가 납부로 바뀔 수 있습니다.",
      ],
    },
    {
      heading: "추가 납부세액은 석 달에 나눠 낼 수 있습니다",
      body: [
        `연말정산으로 더 낼 소득세가 10만 원을 넘으면 회사는 2월분부터 4월분 월급까지 나눠 원천징수할 수 있습니다. 최 씨가 80%를 골라 ${won(additional80)}을 더 내야 한다면 석 달에 나눠 한 달에 약 ${won(additional80 / 3)}씩 낼 수 있는 셈입니다. 분납을 원하면 공제 자료를 낼 때 회사에 함께 신청하세요.`,
        "더 낼 세금이 그달 월급보다 많아 한 번에 떼지 못하면, 남은 금액은 다음 달 월급에서 이어서 뗍니다.",
      ],
    },
    {
      heading: "연말정산 전에 점검할 것",
      body: [
        "① 지난해 근로소득 원천징수영수증에서 결정세액과 기납부세액을 확인해, 어느 쪽이 컸는지 봅니다.",
        "② 올해 이직했다면 전 회사의 원천징수영수증을 미리 받아 둡니다.",
        "③ 맞벌이라면 자녀와 부모의 기본공제를 누가 받을지 정해 중복을 피합니다.",
        "④ 원천징수 비율을 80%로 바꿨다면 연말에 더 낼 금액을 미리 계산해 둡니다.",
        "⑤ 더 낼 금액이 10만 원을 넘으면 분납을 신청할지 정합니다.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 · 소득세법(제55조 세율, 제59조 근로소득세액공제, 제137조 연말정산)", url: "https://www.law.go.kr/법령/소득세법" },
    { label: "국가법령정보센터 · 소득세법 시행령(제194조 근로소득 간이세액표의 적용)", url: "https://www.law.go.kr/법령/소득세법시행령" },
    { label: "국세청 · 연말정산 종합 안내", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2304&cntntsId=238938" },
  ],
};
