import { calcNetSalary } from "@/lib/calculators/netSalary";
import { calcRentTaxCredit, RENT_CREDIT } from "@/lib/calculators/rentTaxCredit";
import type { GuideExtra, ToolExtra } from "../types";
import { krw, pr, won } from "./fmt";

const HIGH = RENT_CREDIT.highRateLimit; // 5,500만 원(17% 적용 상한)
const LOW_SAMPLE = 60_000_000; // 15% 구간 예시 총급여
const withLocal = (r: { credit: number; localTaxCredit: number }) => r.credit + r.localTaxCredit;
const cell = (r: { credit: number; localTaxCredit: number }) => `${won(r.credit)} (지방세 포함 ${won(withLocal(r))})`;

// 월세 세액공제 계산기와 같은 방식의 1년 소득세 추정(본인 1명, 비과세 없음)
const estTax = (salary: number) =>
  calcNetSalary({ annualSalary: salary, monthlyNonTaxable: 0, dependents: 1, children: 0 }).incomeTax * 12;

// 표 1: 월세·총급여별 공제액
const rents = [300_000, 400_000, 500_000, 600_000, 700_000, 800_000, 900_000, 1_000_000];
const edgeA = calcRentTaxCredit(HIGH, 600_000, 12);
const edgeB = calcRentTaxCredit(HIGH + 1, 600_000, 12);

// 표 2: 총급여별 낼 세금과 공제액(월세 50만 원 × 12개월)
const lowRent = 500_000;
const salaries = [20_000_000, 25_000_000, 30_000_000, 35_000_000, 40_000_000, 50_000_000];
const lowRow = (g: number) => {
  const c = calcRentTaxCredit(g, lowRent, 12).credit;
  const t = estTax(g);
  const used = Math.min(c, t);
  return [krw(g), won(t), won(c), won(used), won(c - used)];
};
// 공제를 모두 쓸 수 있는 총급여(100만 원 단위로 찾음)
let fullUseSalary = 0;
for (let g = 20_000_000; g <= RENT_CREDIT.incomeLimit; g += 1_000_000) {
  if (estTax(g) >= calcRentTaxCredit(g, lowRent, 12).credit) {
    fullUseSalary = g;
    break;
  }
}

// 표 3: 주말부부(2026년 지급분부터)
const hhRent = 700_000 * 12;
const spRent = 400_000 * 12;
const hhSalary = 50_000_000;
const spSalary = 60_000_000;
const over = Math.max(0, hhRent + spRent - RENT_CREDIT.rentLimit);
const spBase = Math.max(0, spRent - over);
const hh = calcRentTaxCredit(hhSalary, hhRent, 1);
const sp = calcRentTaxCredit(spSalary, spBase, 1);

// 계산 예시: 3월 입주
const exSalary = 48_000_000;
const exRent = 650_000;
const exMonths = 10;
const ex = calcRentTaxCredit(exSalary, exRent, exMonths);
const exTax = estTax(exSalary);

export const rentTaxCreditGuideExtra: GuideExtra = {
  updated: "2026-11-23",
  mode: "append",
  sections: [
    {
      heading: "월세·총급여별 공제액 한눈에 보기",
      body: [
        "아래 표는 월세 세액공제 계산기와 같은 식으로, 12개월 동안 같은 월세를 냈을 때 소득세에서 빠지는 금액을 계산한 것입니다. 소득세가 줄면 그 10%인 지방소득세도 함께 줄어 괄호 안에 합계를 적었습니다.",
      ],
      table: {
        caption: "월세 12개월 기준 월세 세액공제액",
        head: ["월세", "1년 월세", `총급여 ${krw(HIGH)} 이하(${pr(RENT_CREDIT.highRate)})`, `${krw(HIGH)} 초과 ${krw(RENT_CREDIT.incomeLimit)} 이하(${pr(RENT_CREDIT.lowRate)})`],
        rows: rents.map((r) => [
          krw(r),
          krw(r * 12),
          cell(calcRentTaxCredit(HIGH, r, 12)),
          cell(calcRentTaxCredit(LOW_SAMPLE, r, 12)),
        ]),
        note: `공제 대상 월세는 연 ${krw(RENT_CREDIT.rentLimit)}까지라, 1년 월세가 이를 넘는 월 90만 원·100만 원은 ${krw(RENT_CREDIT.rentLimit)}까지만 계산했습니다. 낼 세금이 공제액보다 적으면 실제로 줄어드는 세금은 이보다 작습니다.`,
      },
      after: [
        `총급여 ${krw(HIGH)}은 공제율이 바뀌는 경계입니다. 월세 60만 원을 12개월 냈다면 총급여가 ${krw(HIGH)}일 때 공제액은 ${won(edgeA.credit)}이지만, ${krw(HIGH)}을 1원이라도 넘으면 ${won(edgeB.credit)}으로 ${won(edgeA.credit - edgeB.credit)} 줄어듭니다. 총급여는 비과세 소득을 뺀 금액이므로 경계 근처라면 원천징수영수증의 총급여를 확인하세요.`,
      ],
    },
    {
      heading: "총급여가 낮으면 공제를 다 쓰지 못할 수 있습니다",
      body: [
        "월세 세액공제는 계산된 세금에서 빼는 방식이라 원래 낼 세금보다 많이 돌려받을 수 없습니다. 쓰지 못하고 남은 공제액은 다음 해로 넘어가지도 않습니다. 아래 표는 월세 50만 원을 12개월 낸 사람을 기준으로 총급여별 1년 소득세 추정액과 실제로 줄일 수 있는 금액을 비교한 것입니다.",
      ],
      table: {
        caption: "월세 50만 원 × 12개월, 총급여별 공제 효과(소득세 기준)",
        head: ["총급여", "1년 소득세 추정", "월세 세액공제액", "실제로 줄어드는 소득세", "쓰지 못하는 공제"],
        rows: salaries.map(lowRow),
        note: "1년 소득세는 연봉 실수령액 계산기와 같은 방식(본인 1명, 비과세 없음, 근로소득공제·인적공제·4대보험료 공제·근로소득세액공제만 반영)으로 추정했습니다. 부양가족이 있거나 다른 세액공제가 많으면 낼 세금이 더 적어져 쓰지 못하는 공제가 늘어납니다.",
      },
      after: [
        fullUseSalary
          ? `이 가정에서는 총급여가 약 ${krw(fullUseSalary)} 이상이어야 월 50만 원 월세의 공제를 모두 쓸 수 있습니다. 회사가 1년 동안 떼어 간 소득세가 거의 없다면 돌려받을 돈도 거의 없으니, 계산기로 먼저 확인해 보세요.`
          : "회사가 1년 동안 떼어 간 소득세가 거의 없다면 돌려받을 돈도 거의 없으니, 계산기로 먼저 확인해 보세요.",
      ],
    },
    {
      heading: "2026년에 낸 월세부터 달라지는 점",
      body: [
        "2025년 12월 조세특례제한법 개정으로 2026년 1월 1일 이후 낸 월세부터는 세대주의 배우자도 따로 공제를 받을 수 있습니다. 그전에는 부부를 한 세대로 보아 한 사람만 받을 수 있었기 때문에, 일 때문에 따로 사는 부부는 한쪽 월세를 공제받지 못했습니다.",
        "배우자가 추가로 받으려면 배우자 스스로 총급여 8,000만 원 이하 등 공제 요건을 모두 갖추고, 배우자의 주소지가 세대주와 다른 시·군·구에 있어야 합니다. 배우자와 같은 주소에 사는 직계존비속이나 형제자매가 있다면 그 사람들도 12월 31일 현재 집이 없어야 합니다.",
        `두 사람의 월세는 합쳐서 연 ${krw(RENT_CREDIT.rentLimit)}까지만 공제합니다. 합계가 이를 넘으면 넘는 만큼을 배우자의 월세에서 뺍니다.`,
        "2026년 2월 시행령 개정으로, 기본공제를 받는 자녀(입양자·위탁아동 포함)와 손자녀가 3명 이상이면 주거전용면적 100㎡ 이하 주택까지 대상이 넓어졌습니다. 기준시가 4억 원 이하 요건은 그대로여서 둘 중 하나만 갖추면 됩니다. 국세청도 두 내용을 2026년 세법 개정 사항으로 안내하고 있습니다.",
      ],
      table: {
        caption: "주말부부 예시: 세대주 월 70만 원, 배우자 월 40만 원(서로 다른 시에 거주)",
        head: ["구분", "세대주", "배우자"],
        rows: [
          ["총급여", krw(hhSalary), krw(spSalary)],
          ["1년 월세", krw(hhRent), krw(spRent)],
          ["공제 대상 월세", krw(hh.base), krw(sp.base)],
          ["공제율", pr(hh.rate), pr(sp.rate)],
          ["소득세 공제액", won(hh.credit), won(sp.credit)],
          ["지방소득세 포함", won(withLocal(hh)), won(withLocal(sp))],
        ],
        note: `두 사람 월세 합계 ${won(hhRent + spRent)} 가운데 한도 ${won(RENT_CREDIT.rentLimit)}을 넘는 ${won(over)}을 배우자 몫에서 뺐습니다. 두 사람 모두 다른 요건을 갖췄고 낼 세금이 충분하다고 가정했습니다.`,
      },
    },
    {
      heading: "3월에 입주한 직장인의 계산 예시",
      body: [
        "정 씨는 총급여 4,800만 원인 직장인이고, 3월 1일부터 월세 65만 원인 주거용 오피스텔에 살기 시작했습니다. 전입신고를 했고 집은 국민주택규모 이하입니다.",
        `1단계, 그해 낸 월세: ${won(exRent)} × ${exMonths}개월 = ${won(ex.paid)}입니다. 실제로는 계약서의 월세 합계를 계약 일수로 나눈 뒤 그해 산 날수를 곱해 계산하므로 입주 날짜에 따라 조금 달라질 수 있습니다.`,
        `2단계, 한도 확인: ${won(ex.paid)}은 연 ${krw(RENT_CREDIT.rentLimit)} 한도 안이라 모두 공제 대상입니다.`,
        `3단계, 공제율: 총급여가 ${krw(HIGH)} 이하라 ${pr(ex.rate)}를 적용해 소득세 공제액은 ${won(ex.credit)}입니다. 지방소득세 ${won(ex.localTaxCredit)}도 함께 줄어 모두 ${won(withLocal(ex))}입니다.`,
        `4단계, 낼 세금과 비교: 본인 1명 기준으로 추정한 정 씨의 1년 소득세는 약 ${won(exTax)}이라 공제액을 모두 쓸 수 있습니다. 공제 뒤 소득세는 약 ${won(exTax - ex.credit)}으로 줄어듭니다.`,
        `5단계, 결과: 회사가 1년 동안 뗀 소득세가 추정치와 비슷하다면 연말정산에서 월세 공제로 약 ${won(withLocal(ex))}(지방소득세 포함)을 더 돌려받게 됩니다.`,
      ],
    },
    {
      heading: "공제를 받지 못하는 대표적인 경우",
      body: [
        "① 세대 안에 집이 있는 경우: 무주택 여부는 본인만이 아니라 배우자와 같은 주소에서 생계를 같이 하는 가족을 포함한 세대 전체로 12월 31일 기준으로 봅니다.",
        "② 실제로 살지 않는 집: 임대차계약서의 주소와 주민등록 주소가 같아야 합니다. 가족을 위해 대신 빌려 준 집처럼 본인이 살지 않는 집은 대상이 아닙니다.",
        "③ 계약자 명의: 본인이나 본인의 기본공제를 받는 가족 명의로 계약해야 합니다. 기본공제 대상이 아닌 가족이 계약한 집은 대상이 아닙니다.",
        "④ 집 크기와 값: 전용 85㎡(수도권 밖 도시지역이 아닌 읍·면이거나 자녀·손자녀가 3명 이상이면 100㎡)를 넘으면서 기준시가도 4억 원을 넘으면 대상이 아닙니다. 둘 중 하나만 맞으면 됩니다.",
        "⑤ 소득 기준: 총급여가 8,000만 원 이하여도 종합소득금액이 7,000만 원을 넘으면 받을 수 없습니다.",
        "⑥ 다른 공제와 겹치는 경우: 세대주가 주택청약종합저축이나 주택임차차입금 공제를 받았다면 세대원은 월세 세액공제를 받을 수 없습니다. 또 월세 세액공제를 받은 금액은 현금영수증으로 냈더라도 신용카드 등 소득공제에서 빠집니다.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 · 조세특례제한법(제95조의2 월세액에 대한 세액공제)", url: "https://www.law.go.kr/법령/조세특례제한법" },
    { label: "국가법령정보센터 · 조세특례제한법 시행령(제95조 월세 세액공제)", url: "https://www.law.go.kr/법령/조세특례제한법시행령" },
    { label: "국세청 · 월세액 세액공제", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=40613&cntntsId=239025" },
  ],
};

// 도구 페이지
const toolRent = 600_000;
const toolMonths = [12, 10, 8, 6, 3];

export const rentTaxCreditToolExtra: ToolExtra = {
  updated: "2026-11-23",
  sections: [
    {
      heading: "입주 개월 수에 따른 계산 예시",
      body: [
        "그해 중간에 이사했다면 '그해 낸 개월 수'에 실제로 월세를 낸 달 수를 넣습니다. 아래는 월세 60만 원일 때 개월 수에 따라 공제액이 어떻게 달라지는지 계산한 것입니다.",
      ],
      table: {
        caption: "월세 60만 원, 낸 개월 수별 공제액",
        head: ["낸 개월 수", "낸 월세 합계", `${pr(RENT_CREDIT.highRate)} 적용`, `${pr(RENT_CREDIT.lowRate)} 적용`],
        rows: toolMonths.map((m) => [
          `${m}개월`,
          krw(toolRent * m),
          cell(calcRentTaxCredit(HIGH, toolRent, m)),
          cell(calcRentTaxCredit(LOW_SAMPLE, toolRent, m)),
        ]),
        note: `${pr(RENT_CREDIT.highRate)}는 총급여 ${krw(HIGH)} 이하, ${pr(RENT_CREDIT.lowRate)}는 ${krw(HIGH)} 초과 ${krw(RENT_CREDIT.incomeLimit)} 이하에 적용합니다. 실제 공제 대상 월세는 계약서의 월세 합계를 계약 일수로 나눈 뒤 그해 임차 일수를 곱해 계산하므로, 달 중간에 입주했다면 조금 달라질 수 있습니다.`,
      },
    },
    {
      heading: "주말부부라면 각자 계산합니다",
      body: [
        "2026년 1월 1일 이후 낸 월세부터는 일 때문에 다른 시·군·구에 따로 사는 배우자도 요건을 갖추면 자신의 월세로 따로 공제를 받을 수 있습니다. 이 계산기는 한 사람 기준이므로 세대주와 배우자가 각자 총급여와 월세를 넣어 계산하세요.",
        `다만 두 사람의 월세를 합쳐 연 ${krw(RENT_CREDIT.rentLimit)}이 한도입니다. 세대주가 1년에 ${won(hhRent)}, 배우자가 ${won(spRent)}을 냈다면 합계가 ${won(hhRent + spRent)}이라, 배우자는 넘는 ${won(over)}을 뺀 ${won(spBase)}만 공제 대상입니다. 이럴 때는 배우자 계산에서 '그해 낸 개월 수'를 1로 두고 월세 칸에 ${won(spBase)}을 넣으면 됩니다. 배우자 총급여가 ${krw(spSalary)}이라면 공제액은 ${won(sp.credit)}입니다.`,
      ],
    },
    {
      heading: "경고 문구가 보일 때 확인할 것",
      body: [
        "공제액이 추정한 1년 소득세보다 크다는 문구는, 1년 동안 낼 세금이 공제액보다 적을 수 있다는 뜻입니다. 세액공제는 낼 세금까지만 줄여 주고 남는 공제액은 다음 해로 넘어가지 않습니다.",
        "추정 소득세는 본인 1명, 다른 공제가 없는 경우로 계산합니다. 지난해 근로소득 원천징수영수증이 있다면 월세를 넣기 전 결정세액과 공제액을 비교하는 편이 더 정확합니다. 결정세액이 공제액보다 작으면 그 결정세액까지만 줄어듭니다.",
      ],
    },
  ],
  sources: [
    { label: "국세청 · 월세액 세액공제", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=40613&cntntsId=239025" },
    { label: "국가법령정보센터 · 조세특례제한법(제95조의2 월세액에 대한 세액공제)", url: "https://www.law.go.kr/법령/조세특례제한법" },
  ],
};
