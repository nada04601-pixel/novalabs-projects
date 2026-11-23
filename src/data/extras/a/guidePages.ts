import { RATES } from "@/data/rates/2026";
import { calcWeeklyHolidayPay, WEEKS_PER_MONTH } from "@/lib/calculators/weeklyHolidayPay";
import { monthlyPaidHours } from "@/lib/calculators/wageConvert";
import type { ContentSection, Source } from "@/data/content";
import type { GuideExtra } from "../types";
import {
  annualLabel,
  EMPLOYER_STABILITY_RATE_UNDER150,
  hr,
  insuranceOf,
  man,
  MIN_WAGE_HISTORY,
  n,
  netOf,
  NEXT_MIN_WAGE,
  p,
  PENSION_STEP,
  PENSION_TARGET,
  safeFloor10,
  taxSteps,
  won,
} from "./helpers";

const UPDATED = "2026-11-23";
const Y = RATES.year;
const MW = RATES.minimumWage;
const MEAL = RATES.incomeTax.mealTaxFreeLimit;

// ───────────────────────── 연봉과 실수령액 (salary-vs-take-home) ─────────────────────────
// 원래 글의 "퇴직금 포함 시 월 실수령액 약 25만 원 이상 차이" 문장이 계산기 결과(약 20만 원)와 달라
// 글 전체를 다시 싣고(replace) 그 문장만 계산값으로 고쳤습니다. 나머지 원래 문단은 그대로입니다.

const salaryRows = [24_000_000, 30_000_000, 36_000_000, 40_000_000, 45_000_000, 50_000_000, 60_000_000, 70_000_000, 80_000_000, 90_000_000, 100_000_000];

const sep40 = netOf(40_000_000);
const inc40 = netOf((40_000_000 * 12) / 13);
const grossGap40 = sep40.monthlyGross - inc40.monthlyGross;
const netGap40 = sep40.monthlyNet - inc40.monthlyNet;

const steps = [30_000_000, 40_000_000, 50_000_000, 60_000_000, 70_000_000, 80_000_000, 90_000_000, 100_000_000];
const raises = steps.slice(1).map((to, i) => {
  const from = steps[i];
  const a = netOf(from);
  const b = netOf(to);
  const grossUp = b.monthlyGross - a.monthlyGross;
  const netUp = b.monthlyNet - a.monthlyNet;
  return { from, to, grossUp, netUp, keep: netUp / grossUp, pensionUp: b.pension - a.pension };
});
const firstRaise = raises[0];
const minRaise = raises.reduce((a, b) => (b.keep < a.keep ? b : a));
const bracketRate = (base: number) => RATES.incomeTax.brackets.find((b) => base <= b.upTo)!.rate;
const minFrom = taxSteps(minRaise.from);
const minTo = taxSteps(minRaise.to);
const cappedRaise = raises.find((r) => r.pensionUp < firstRaise.pensionUp / 2);

// 두 회사 제안 비교: A는 퇴직금 별도, B는 퇴직금 포함
const offerA = 45_000_000;
const offerB = 48_000_000;
const offerBBase = (offerB * 12) / 13;
const offerBSeverance = offerB / 13;
const offerASeverance = offerA / 12; // 1년 근무 퇴직금을 월 세전 급여로 어림
const netA = netOf(offerA);
const netB = netOf(offerBBase);
const totalA = offerA + offerASeverance;
const totalB = offerB;

// 퇴직금 포함 연봉과 최저임금
const minAnnual = MW * 209 * 12;
const inclusiveLow = 26_000_000;
const inclusiveLowHourly = Math.floor((inclusiveLow * 12) / 13 / 12 / 209);

// 원천징수 비율 예시(연봉 5,000만 원)
const w50 = netOf(50_000_000);
const w80 = safeFloor10(w50.incomeTax * 0.8);
const w120 = safeFloor10(w50.incomeTax * 1.2);

const salarySections: ContentSection[] = [
  {
    heading: "연봉은 세전 금액입니다",
    body: [
      "연봉 계약서의 금액은 세금과 보험료를 빼기 전 금액입니다. 실제로 받는 월급은 여기서 4대보험료와 소득세, 지방소득세를 뺀 금액이라 연봉을 12로 나눈 값보다 적습니다. 연봉이 높을수록 누진세율이 적용되어 빠지는 비율도 커집니다.",
    ],
  },
  {
    heading: "연봉별 월 실수령액 예시",
    body: [
      `본인 1명, 식대 비과세 월 ${n(MEAL)}원, 퇴직금 별도 기준으로 연봉 실수령액 계산기에 넣어 보면 연봉 3,000만 원은 월 약 ${man(netOf(30_000_000).monthlyNet)}, 4,000만 원은 약 ${man(netOf(40_000_000).monthlyNet)}, 5,000만 원은 약 ${man(netOf(50_000_000).monthlyNet)}, 7,000만 원은 약 ${man(netOf(70_000_000).monthlyNet)}입니다.`,
      `같은 조건에서 월 급여 대비 공제 비율은 연봉 3,000만 원일 때 약 ${p(netOf(30_000_000).totalDeduction / netOf(30_000_000).monthlyGross, 0)}, 7,000만 원일 때 약 ${p(netOf(70_000_000).totalDeduction / netOf(70_000_000).monthlyGross, 0)}입니다. 연봉이 1,000만 원 오른다고 월급이 ${man(10_000_000 / 12)}씩 늘어나지 않는 이유가 여기에 있습니다. 부양가족이 많으면 소득세가 줄어 실수령액이 조금 늘어납니다.`,
    ],
    table: {
      caption: `연봉 2,400만~1억 원의 월 공제액과 실수령액(${Y}년 요율, 연봉 실수령액 계산기로 계산)`,
      head: ["연봉", "월 세전", "4대보험", "소득세·지방소득세", "월 실수령액", "공제 비율"],
      rows: salaryRows.map((a) => {
        const r = netOf(a);
        const ins = r.pension + r.health + r.longTermCare + r.employment;
        return [annualLabel(a), won(r.monthlyGross), won(ins), won(r.incomeTax + r.localTax), won(r.monthlyNet), p(r.totalDeduction / r.monthlyGross, 1)];
      }),
      note: `본인 1명(자녀 없음), 식대 비과세 월 ${n(MEAL)}원, 퇴직금 별도 기준입니다. 보험료와 세금은 10원 미만을 버렸고, 월 세전은 원 단위로 반올림했습니다. 소득세는 국세청 간이세액표가 아니라 연 세액을 추정해 12로 나눈 값이라 실제 급여명세서와 조금 다를 수 있습니다.`,
    },
    after: [
      `표에서 공제 비율은 연봉 2,400만 원일 때 ${p(netOf(24_000_000).totalDeduction / netOf(24_000_000).monthlyGross, 1)}에서 1억 원일 때 ${p(netOf(100_000_000).totalDeduction / netOf(100_000_000).monthlyGross, 1)}까지 올라갑니다. 4대보험은 월급에 거의 같은 비율로 붙지만, 소득세는 누진세율이라 연봉이 오를수록 비중이 커지기 때문입니다.`,
    ],
  },
  {
    heading: "퇴직금 포함 여부를 확인하세요",
    body: [
      `일부 회사는 연봉에 퇴직금을 포함해 계약합니다. 이 경우 연봉을 13으로 나눈 금액이 매달 기준 급여가 되고, 1/13은 퇴직금으로 적립됩니다. 같은 연봉 4,000만 원이라도 퇴직금 별도인 곳과 포함인 곳은 세전 월급이 약 ${man(grossGap40)}, 실수령액으로는 약 ${man(netGap40)} 차이 납니다(본인 1명, 식대 비과세 월 ${n(MEAL)}원 기준).`,
    ],
  },
  {
    heading: "비과세 항목이 실수령액을 바꿉니다",
    body: [
      `식대는 월 ${n(MEAL)}원까지 비과세입니다. 비과세 금액은 소득세뿐 아니라 4대보험료 계산에서도 빠지기 때문에, 같은 연봉이라도 비과세 항목이 많으면 실수령액이 늘어납니다. 차량유지비(자가운전보조금), 출산·보육수당 등도 요건을 충족하면 비과세입니다.`,
    ],
  },
  {
    heading: "고정 연장근로수당이 들어 있는지 보세요",
    body: [
      "포괄임금제나 고정 연장근로수당(고정 OT)으로 계약하면 연봉 안에 일정 시간의 연장근로 대가가 미리 들어 있습니다. 연봉 숫자는 높아 보이지만 기본급은 낮고, 그 시간만큼 일하는 것이 전제일 수 있습니다. 계약서에서 기본급과 고정 수당이 각각 얼마인지, 몇 시간분인지 확인하세요.",
      "기본급이 낮으면 기본급을 기준으로 정하는 상여금이나 수당도 함께 낮아질 수 있습니다. 연봉 총액이 같아도 구성에 따라 실제 대우가 다르다는 점을 기억해 두세요.",
    ],
  },
  {
    heading: "이직 제안을 비교하는 방법",
    body: [
      "두 회사의 제안을 비교할 때는 연봉 숫자만 보지 말고 퇴직금 포함 여부, 비과세 항목, 성과급 지급 조건, 복지 포인트를 함께 적어 두세요. 그다음 각각의 기본 연봉을 실수령액 계산기에 넣어 월 실수령액으로 비교하면 판단이 쉬워집니다.",
      "성과급은 지급이 확정되지 않은 경우가 많으므로 고정 급여와 분리해서 보는 것이 안전합니다. 출퇴근 시간과 교통비, 재택근무 여부처럼 숫자로 드러나지 않는 비용도 월 단위로 환산해 보면 비교가 한결 공정해집니다.",
    ],
  },
  {
    heading: "연봉 협상할 때 말하는 법",
    body: [
      "희망 연봉을 말할 때는 기준을 분명히 하는 것이 좋습니다. '퇴직금 별도, 기본급 기준 얼마'처럼 조건을 붙여 말하면 나중에 서로 다른 숫자를 떠올리는 일을 막을 수 있습니다. 현재 연봉을 말할 때도 성과급과 고정 수당을 나눠 설명하면 오해가 줄어듭니다.",
      "제안받은 금액이 기대보다 낮다면 연봉 외에 조정할 수 있는 항목이 있는지 물어보세요. 입사 축하금, 직급, 연봉 재검토 시점, 교육비나 장비 지원처럼 총보상에 영향을 주는 조건은 연봉 숫자보다 협의가 쉬운 경우가 있습니다.",
    ],
  },
  // ── 2026-11-23 보강 ──
  {
    heading: "연봉이 1,000만 원 오를 때 실제로 늘어나는 돈",
    body: [
      `연봉이 1,000만 원 오르면 세전 월급은 약 ${man(firstRaise.grossUp)} 늘어납니다. 그런데 늘어난 금액에도 4대보험과 소득세가 붙기 때문에 통장에 더 들어오는 돈은 이보다 적습니다. 같은 1,000만 원이라도 어느 구간에서 오르느냐에 따라 손에 남는 몫이 다릅니다.`,
    ],
    table: {
      caption: "연봉 1,000만 원 인상 구간별 월 실수령액 증가",
      head: ["연봉 구간", "월 세전 증가", "월 실수령액 증가", "증가분 중 남는 비율"],
      rows: raises.map((r) => [`${annualLabel(r.from)} → ${annualLabel(r.to)}`, won(r.grossUp), won(r.netUp), p(r.keep, 1)]),
      note: `본인 1명, 식대 비과세 월 ${n(MEAL)}원, 퇴직금 별도 기준으로 연봉 실수령액 계산기에 넣은 결과의 차이입니다.`,
    },
    after: [
      `${annualLabel(firstRaise.from)}에서 ${annualLabel(firstRaise.to)}으로 오를 때는 늘어난 세전 월급의 약 ${p(firstRaise.keep, 0)}가 남지만, 가장 적게 남는 ${annualLabel(minRaise.from)}에서 ${annualLabel(minRaise.to)} 구간은 약 ${p(minRaise.keep, 0)}입니다. 이 구간에서 과세표준이 ${p(bracketRate(minFrom.taxBase), 0)} 세율 구간에서 ${p(bracketRate(minTo.taxBase), 0)} 구간으로 넘어가고, 총급여가 7,000만 원을 넘으면서 근로소득세액공제도 연 ${won(minFrom.credit)}에서 ${won(minTo.credit)}으로 줄기 때문입니다.`,
      cappedRaise
        ? `${annualLabel(cappedRaise.from)}에서 ${annualLabel(cappedRaise.to)}으로 오르는 구간에서는 국민연금이 월 ${won(cappedRaise.pensionUp)}만 늘어납니다. 과세 대상 월급이 국민연금 기준소득월액 상한 ${n(RATES.pension.maxBase)}원을 넘으면 연금 보험료가 더 오르지 않기 때문입니다. 그래서 고연봉 구간에서는 세금 비중이 커지는 대신 보험료 증가는 줄어듭니다.`
        : "",
      "연봉 협상에서 인상 폭을 이야기할 때는 세전 금액과 함께 이 비율을 떠올려 두면, 인상 뒤 월급을 미리 현실적으로 예상할 수 있습니다.",
    ].filter(Boolean),
  },
  {
    heading: "예시: 퇴직금 포함 4,800만 원과 퇴직금 별도 4,500만 원",
    body: [
      `한 사람이 두 회사에서 제안을 받았다고 해 보겠습니다. A회사는 연봉 ${man(offerA)}에 퇴직금 별도, B회사는 연봉 ${man(offerB)}에 퇴직금 포함입니다. 숫자만 보면 B회사가 ${man(offerB - offerA)} 많아 보입니다.`,
      `1단계로 B회사 연봉에서 퇴직금을 뺍니다. ${man(offerB)} × 12 ÷ 13 = ${won(offerBBase)}이 실제로 12개월에 나눠 받는 급여이고, ${won(offerBSeverance)}은 퇴직금 몫입니다.`,
      `2단계로 두 금액을 실수령액 계산기에 넣으면 A회사는 월 ${won(netA.monthlyNet)}, B회사는 월 ${won(netB.monthlyNet)}입니다. 매달 손에 쥐는 돈은 오히려 A회사가 ${won(netA.monthlyNet - netB.monthlyNet)} 많습니다.`,
      `3단계로 퇴직금까지 더해 1년 총액을 봅니다. 퇴직금은 1년 근무에 30일분 평균임금 이상이므로 A회사는 대략 월 세전 급여인 ${won(offerASeverance)}이 더해져 약 ${man(totalA)}, B회사는 퇴직금을 포함해 ${man(totalB)}입니다. 총액으로도 A회사가 약 ${man(totalA - totalB)} 앞섭니다.`,
    ],
    table: {
      caption: "두 제안을 같은 기준으로 바꿔 비교",
      head: ["항목", "A회사(퇴직금 별도)", "B회사(퇴직금 포함)"],
      rows: [
        ["계약서 연봉", won(offerA), won(offerB)],
        ["퇴직금을 뺀 연봉", won(offerA), won(offerBBase)],
        ["월 세전 급여", won(netA.monthlyGross), won(netB.monthlyGross)],
        ["월 실수령액", won(netA.monthlyNet), won(netB.monthlyNet)],
        ["1년 퇴직금(어림)", won(offerASeverance), won(offerBSeverance)],
        ["퇴직금까지 더한 1년 총액", won(totalA), won(totalB)],
      ],
      note: `본인 1명, 식대 비과세 월 ${n(MEAL)}원, 성과급·수당 없음 기준입니다. A회사 퇴직금은 평균임금을 월 세전 급여(연봉 ÷ 12)로 보고 어림한 값입니다.`,
    },
    after: [
      `퇴직금 포함 연봉은 최저임금을 따질 때도 주의해야 합니다. 주 40시간 근무자의 ${Y}년 최저임금을 1년으로 환산하면 ${won(minAnnual)}입니다. 퇴직금 포함 연봉 ${man(inclusiveLow)}은 이보다 많아 보이지만, 퇴직금 몫을 빼고 209시간으로 나누면 시간당 약 ${won(inclusiveLowHourly)}이라 최저시급 ${won(MW)}에 못 미칩니다.`,
    ],
  },
  {
    heading: "실수령액이 계산과 다르게 들어오는 경우",
    body: [
      `매달 떼는 소득세 비율을 바꾼 경우입니다. 근로자는 간이세액표 세액의 80%, 100%, 120% 가운데 하나를 골라 회사에 신청할 수 있고, 고르지 않으면 100%가 적용됩니다. 연봉 5,000만 원이면 계산기 기준 월 소득세가 약 ${won(w50.incomeTax)}인데, 80%를 고르면 약 ${won(w80)}, 120%를 고르면 약 ${won(w120)}이 빠집니다. 1년 세금 총액은 연말정산에서 맞춰지므로 덜 떼면 2월에 더 내고, 더 떼면 돌려받는 돈이 늘어납니다.`,
      "상여금을 받는 달도 다릅니다. 상여는 그 상여가 대상으로 하는 기간의 급여와 합쳐 월평균을 낸 뒤 세액을 다시 계산하기 때문에, 상여가 나온 달에는 평소보다 세금이 크게 빠집니다. 연봉에 상여가 나뉘어 들어 있는 회사라면 상여가 없는 달의 월급은 연봉 ÷ 12보다 적습니다.",
      "비과세 한도를 넘는 경우도 있습니다. 식대를 월 30만 원 받는다면 비과세는 20만 원까지이고 나머지 10만 원은 과세 급여에 들어갑니다. 급여명세서에 식대 전액이 비과세로 적혀 있지 않은지 한 번 살펴보세요.",
    ],
  },
];

const salarySources: Source[] = [
  { label: "국세청 - 근로소득 과세표준과 기본세율", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6594&cntntsId=7873" },
  { label: "국세청 - 근로소득 원천징수방법(간이세액표, 80·100·120% 선택)", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6583&cntntsId=7862" },
  { label: "국민연금공단 - 2026년 4대 보험료율과 기준소득월액 상·하한", url: "https://nps.or.kr/pnsinfo/ntpsklg/getOHAF0097M0.do" },
  { label: "최저임금위원회 - 연도별 최저임금 결정현황", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do" },
];

// ───────────────────────── 4대보험 요율 (2026-social-insurance-rates) ─────────────────────────
// 원래 글의 "월 300만 원이면 고용보험 약 26,990원"은 3,000,000 × 0.009의 소수 계산 오차로 10원이 덜 나온 값이라
// 글 전체를 다시 싣고(replace) 보험료를 safeFloor10으로 계산했습니다. 원래 문단은 그대로입니다.

const insRows = [2_000_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000, 5_000_000, 6_000_000, 7_000_000, 8_000_000];
const pensionCap = safeFloor10(RATES.pension.maxBase * RATES.pension.rate);
const firstCapped = insRows.find((m) => m > RATES.pension.maxBase)!;

// 예시: 월급 350만 원 중 식대 20만 원
const exPay = 3_500_000;
const exBase = exPay - MEAL;
const exIns = insuranceOf(exBase);
const exPensionBase = exIns.pensionBase;
const exEmployerStability = safeFloor10(exBase * EMPLOYER_STABILITY_RATE_UNDER150);
const exEmployerTotal = exIns.pension + exIns.health + exIns.longTermCare + exIns.employment + exEmployerStability;

const employerOf = (m: number) => {
  const i = insuranceOf(m);
  return i.total + safeFloor10(m * EMPLOYER_STABILITY_RATE_UNDER150);
};

// 국민연금 보험료율 인상 일정
const pensionTotal = RATES.pension.rate * 2;
const pensionSchedule: { year: number; total: number }[] = [];
for (let k = 0; pensionTotal + k * PENSION_STEP <= PENSION_TARGET + 1e-9; k++) {
  pensionSchedule.push({ year: Y + k, total: Math.round((pensionTotal + k * PENSION_STEP) * 10_000) / 10_000 });
}
const pensionLastYear = pensionSchedule[pensionSchedule.length - 1].year;
const ex300 = 3_000_000;

// 흔한 실수 예시
const wrongLtc = Math.round(ex300 * RATES.longTermCare.rateOfHealth);
const yearlyPensionStep = safeFloor10(ex300 * (PENSION_STEP / 2));
const ins300 = insuranceOf(ex300);
const rightLtc = insuranceOf(ex300).longTermCare;
const ltcOfIncome = RATES.health.rate * 2 * RATES.longTermCare.rateOfHealth;
const wrongPension800 = 8_000_000 * RATES.pension.rate;
const mealGap = insuranceOf(3_000_000).total - insuranceOf(3_000_000 - MEAL).total;

const insuranceSections: ContentSection[] = [
  {
    heading: "4대보험은 회사와 나눠 냅니다",
    body: [
      "직장인의 4대보험은 국민연금, 건강보험(장기요양보험 포함), 고용보험, 산재보험입니다. 이 중 산재보험은 회사가 전액 부담하고, 나머지 세 가지는 회사와 근로자가 나눠 냅니다. 급여명세서에서 빠지는 것은 근로자 부담분입니다.",
      "보험료는 비과세 수당을 뺀 월 보수(과세 대상 급여)를 기준으로 매깁니다. 그래서 식대처럼 비과세로 처리되는 금액이 클수록 보험료도 조금씩 줄어듭니다.",
    ],
  },
  {
    heading: `${RATES.year}년 근로자 부담 요율`,
    body: [
      `국민연금은 근로자 부담 ${p(RATES.pension.rate)}입니다. 연금개혁에 따라 보험료율이 매년 0.5%포인트씩 오르기 시작했고, 이 중 절반을 근로자가 냅니다. 기준소득월액에는 하한 ${n(RATES.pension.minBase)}원과 상한 ${n(RATES.pension.maxBase)}원이 있어, 월급이 상한보다 많아도 상한액 기준으로만 냅니다. 상·하한은 매년 7월에 바뀝니다.`,
      `건강보험은 근로자 부담 ${p(RATES.health.rate, 3)}이고, 장기요양보험료는 건강보험료에 ${p(RATES.longTermCare.rateOfHealth)}를 곱해 함께 걷습니다. 고용보험(실업급여분)은 근로자 부담 ${p(RATES.employment.rate, 1)}입니다.`,
    ],
  },
  {
    heading: "월급 300만 원이면 얼마나 빠질까",
    body: [
      `비과세 없이 월 300만 원을 받는다고 가정하면 국민연금 약 ${n(ins300.pension)}원, 건강보험 약 ${n(ins300.health)}원, 장기요양보험 약 ${n(ins300.longTermCare)}원, 고용보험 약 ${n(ins300.employment)}원이 빠집니다. 여기에 소득세와 지방소득세가 더해집니다.`,
      "내 연봉에 맞는 정확한 공제 내역은 연봉 실수령액 계산기에 연봉과 비과세액을 넣어 확인할 수 있습니다.",
    ],
  },
  {
    heading: "회사는 얼마를 더 낼까",
    body: [
      "국민연금, 건강보험, 장기요양보험은 회사도 근로자와 같은 금액을 냅니다. 고용보험은 실업급여분을 반씩 나눠 내고, 고용안정·직업능력개발사업 보험료는 회사가 규모에 따라 0.25%에서 0.85%를 혼자 냅니다. 산재보험료는 업종별 요율에 따라 회사가 전액 부담합니다.",
      "그래서 회사 입장에서 직원 한 명의 인건비는 연봉보다 대략 10% 안팎 더 듭니다. 채용 공고에서 말하는 연봉과 회사가 실제로 쓰는 비용이 다른 이유입니다.",
    ],
  },
  {
    heading: "입사한 달과 퇴사한 달의 보험료",
    body: [
      "건강보험은 자격을 얻은 날이 속한 달의 다음 달부터 보험료를 매기고, 1일에 입사한 경우에만 그 달부터 냅니다. 그래서 15일에 입사하면 첫 월급에는 건강보험료가 빠지지 않는 경우가 많습니다. 국민연금도 1일 입사가 아니면 입사한 달은 보통 부과하지 않습니다.",
      "퇴사할 때는 건강보험 퇴직정산이 이뤄집니다. 그해 받은 보수를 기준으로 보험료를 다시 계산해 마지막 월급에서 더 떼거나 돌려줍니다. 마지막 월급이 평소보다 적거나 많은 이유가 대부분 이것입니다.",
    ],
  },
  {
    heading: "알아두면 좋은 점",
    body: [
      "건강보험료는 매년 4월에 전년도 보수 총액을 기준으로 정산합니다. 전년도에 연봉이 올랐거나 성과급을 받았다면 4월 급여에서 추가로 빠질 수 있고, 반대로 돌려받기도 합니다.",
      "국민연금은 근로자가 낸 보험료가 그대로 노후 연금 수령액에 반영됩니다. 단순히 사라지는 돈이 아니라 연금 적립이라는 점에서 다른 보험료와 성격이 다릅니다.",
    ],
  },
  {
    heading: "급여명세서에서 확인하는 순서",
    body: [
      "급여명세서를 받으면 먼저 지급 항목 가운데 비과세로 표시된 금액을 찾고, 지급 합계에서 이를 뺀 과세 대상 금액을 구해 보세요. 이 금액에 요율을 곱한 값과 명세서의 보험료가 크게 다르다면 보수월액이 아직 갱신되지 않았거나 정산분이 섞여 있는 경우가 많습니다.",
      "국민연금과 건강보험은 매달 실제 월급이 아니라 신고된 보수월액을 기준으로 부과하기 때문에, 연봉이 오른 직후 몇 달은 예전 기준으로 빠지다가 나중에 정산되기도 합니다. 의문이 있다면 회사 급여 담당자에게 신고된 보수월액을 물어보거나 각 공단 홈페이지에서 직접 조회할 수 있습니다.",
    ],
  },
  // ── 2026-11-23 보강 ──
  {
    heading: "월 보수별 근로자 부담 보험료 한눈에 보기",
    body: [
      "아래 표는 비과세 수당을 뺀 월 보수(과세 대상 급여)를 기준으로 근로자가 내는 보험료를 계산한 것입니다. 내 급여명세서에서 지급 합계가 아니라 과세 대상 금액을 찾아 가장 가까운 줄을 보면 됩니다.",
    ],
    table: {
      caption: `${Y}년 월 보수별 근로자 부담 4대보험료(산재보험 제외)`,
      head: ["월 보수", "국민연금", "건강보험", "장기요양", "고용보험", "합계", "보수 대비"],
      rows: insRows.map((m) => {
        const i = insuranceOf(m);
        return [man(m), won(i.pension), won(i.health), won(i.longTermCare), won(i.employment), won(i.total), p(i.total / m, 2)];
      }),
      note: `국민연금은 기준소득월액(천 원 미만 버림) × ${p(RATES.pension.rate)}, 상한 ${n(RATES.pension.maxBase)}원·하한 ${n(RATES.pension.minBase)}원(${Y}년 7월~${Y + 1}년 6월)을 적용했습니다. 건강보험 ${p(RATES.health.rate, 3)}, 장기요양은 건강보험료 × ${p(RATES.longTermCare.rateOfHealth)}, 고용보험 ${p(RATES.employment.rate, 1)}이며 모두 10원 미만은 버렸습니다.`,
    },
    after: [
      `월 보수가 기준소득월액 상한 ${n(RATES.pension.maxBase)}원을 넘는 ${man(firstCapped)} 줄부터는 국민연금이 상한액인 월 ${won(pensionCap)}에 묶입니다. 그래서 보수 대비 합계 비율이 그보다 낮은 보수에서는 약 ${p(insuranceOf(3_000_000).total / 3_000_000, 1)}로 거의 같다가, 상한을 넘는 보수부터 조금씩 내려갑니다. 건강보험과 고용보험은 상한이 훨씬 높아 일반적인 월급에서는 비율이 그대로입니다.`,
    ],
  },
  {
    heading: "예시: 월급 350만 원, 식대 20만 원인 직원",
    body: [
      `월급 ${man(exPay)} 가운데 식대 ${man(MEAL)}이 비과세로 처리되는 직원을 예로 들어 보겠습니다. 보험료는 비과세를 뺀 ${won(exBase)}을 기준으로 계산합니다.`,
      `국민연금은 기준소득월액 ${won(exPensionBase)}에 ${p(RATES.pension.rate)}를 곱해 ${won(exIns.pension)}입니다. 건강보험은 ${won(exBase)} × ${p(RATES.health.rate, 3)} = ${n(exBase * RATES.health.rate)}원에서 10원 미만을 버린 ${won(exIns.health)}이고, 장기요양보험은 이 건강보험료에 ${p(RATES.longTermCare.rateOfHealth)}를 곱한 뒤 10원 미만을 버려 ${won(exIns.longTermCare)}입니다. 고용보험은 ${won(exBase)} × ${p(RATES.employment.rate, 1)} = ${won(exIns.employment)}입니다.`,
      `근로자 부담 합계는 ${won(exIns.total)}입니다. 상시 근로자 150명 미만 기업이라면 회사는 같은 금액에 고용안정·직업능력개발사업 보험료 ${won(exEmployerStability)}을 더해 ${won(exEmployerTotal)}을 냅니다. 산재보험료를 빼고도 근로자와 회사를 합치면 한 달에 ${won(exIns.total + exEmployerTotal)}이 이 직원의 보험료로 나갑니다.`,
    ],
    table: {
      caption: `월 과세 보수 ${won(exBase)}의 보험료 나눠 보기`,
      head: ["항목", "계산", "근로자", "회사"],
      rows: [
        ["국민연금", `${n(exPensionBase)} × ${p(RATES.pension.rate)}`, won(exIns.pension), won(exIns.pension)],
        ["건강보험", `${n(exBase)} × ${p(RATES.health.rate, 3)}`, won(exIns.health), won(exIns.health)],
        ["장기요양보험", `건강보험료 × ${p(RATES.longTermCare.rateOfHealth)}`, won(exIns.longTermCare), won(exIns.longTermCare)],
        ["고용보험(실업급여)", `${n(exBase)} × ${p(RATES.employment.rate, 1)}`, won(exIns.employment), won(exIns.employment)],
        ["고용안정·직업능력개발", `${n(exBase)} × ${p(EMPLOYER_STABILITY_RATE_UNDER150)}`, "없음", won(exEmployerStability)],
        ["합계", "", won(exIns.total), won(exEmployerTotal)],
      ],
      note: "회사 부담은 상시 근로자 150명 미만 기업 기준이며, 업종마다 다른 산재보험료는 넣지 않았습니다. 10원 미만은 버렸습니다.",
    },
  },
  {
    heading: "회사 부담까지 더하면 한 달에 얼마가 나갈까",
    body: [
      "근로자 한 명에게 매달 나가는 4대보험료 전체를 보면 근로자 몫과 회사 몫이 거의 같습니다. 회사가 직원 채용 비용을 잡을 때 월급 외에 이 정도를 더 준비해야 한다는 뜻이기도 합니다.",
    ],
    table: {
      caption: "월 보수별 근로자·회사 부담 4대보험료(산재보험 제외)",
      head: ["월 보수", "근로자 부담", "회사 부담", "합계", "보수 대비 합계"],
      rows: [2_500_000, 3_000_000, 4_000_000, 5_000_000, 7_000_000].map((m) => {
        const w = insuranceOf(m).total;
        const e = employerOf(m);
        return [man(m), won(w), won(e), won(w + e), p((w + e) / m, 1)];
      }),
      note: `회사 부담은 고용안정·직업능력개발사업 보험료를 150명 미만 기업 요율(${p(EMPLOYER_STABILITY_RATE_UNDER150)})로 넣은 값이며, 산재보험료는 빠져 있습니다. 10원 미만은 버렸습니다.`,
    },
  },
  {
    heading: "국민연금 보험료율은 해마다 오릅니다",
    body: [
      `국민연금 보험료율 인상은 ${Y}년 ${p(pensionTotal, 1)}에서 ${pensionLastYear}년 ${p(PENSION_TARGET, 0)}에 이를 때까지 이어집니다. 근로자 몫은 해마다 ${p(PENSION_STEP / 2)}포인트씩 늘어나므로, 월 보수가 ${man(ex300)}으로 그대로여도 연금 보험료가 매년 약 ${won(yearlyPensionStep)}씩 늘어납니다. 연봉이 오르지 않았는데 1월 급여명세서의 국민연금이 늘었다면 이 때문입니다.`,
    ],
    table: {
      caption: `국민연금 보험료율 인상 일정과 월 보수 ${man(ex300)} 기준 근로자 부담`,
      head: ["연도", "전체 보험료율", "근로자 부담률", "근로자 월 보험료"],
      rows: pensionSchedule.map((s) => [`${s.year}년`, p(s.total, 1), p(s.total / 2, 2), won(safeFloor10(ex300 * (s.total / 2)))]),
      note: `월 보수 ${man(ex300)}이 그대로라고 가정했고 10원 미만은 버렸습니다. 상한을 넘는 고소득자는 그해 7월에 정해지는 상한액에 따라 금액이 달라집니다.`,
    },
    after: [
      `건강보험료율은 ${Y + 1}년에도 ${Y}년과 같은 ${p(RATES.health.rate * 2, 2)}로 동결하기로 했습니다(보건복지부, ${Y}년 9월 발표). 장기요양보험료율과 국민연금 상·하한은 따로 정해지므로 새해 급여명세서를 받으면 함께 확인해 보세요.`,
    ],
  },
  {
    heading: "보험료를 직접 계산할 때 자주 하는 실수",
    body: [
      `장기요양보험료를 월급에 바로 곱하는 실수가 가장 흔합니다. ${p(RATES.longTermCare.rateOfHealth)}는 건강보험료에 곱하는 비율이라, 월 보수 ${man(ex300)}에 그대로 곱하면 ${won(wrongLtc)}이라는 엉뚱한 값이 나옵니다. 실제 근로자 부담은 ${won(rightLtc)}입니다. 소득에 바로 곱하고 싶다면 소득 대비 요율 ${p(ltcOfIncome, 4)}의 절반인 ${p(ltcOfIncome / 2, 4)}를 쓰면 거의 같은 값이 나옵니다.`,
      `국민연금 상한을 잊는 실수도 있습니다. 월 보수가 800만 원이면 800만 원 × ${p(RATES.pension.rate)} = ${won(wrongPension800)}이 아니라 상한액 ${n(RATES.pension.maxBase)}원을 기준으로 한 ${won(pensionCap)}만 냅니다.`,
      `비과세를 빼지 않고 계산하면 보험료가 실제보다 크게 나옵니다. 월급 300만 원 가운데 식대 ${man(MEAL)}이 비과세라면 4대보험 합계가 약 ${won(mealGap)} 줄어듭니다.`,
      "끝자리가 몇 원씩 다른 것은 대부분 버림 규칙 때문입니다. 국민연금은 소득월액의 천 원 미만을 버린 기준소득월액에 요율을 곱하고, 보험료는 10원 미만을 버립니다. 명세서와 몇십 원 차이가 난다면 계산이 틀렸다기보다 버림 순서가 다른 경우가 많습니다.",
    ],
  },
];

const insuranceSources: Source[] = [
  { label: "국민연금공단 - 2026년 4대 보험료율과 기준소득월액 상·하한", url: "https://nps.or.kr/pnsinfo/ntpsklg/getOHAF0097M0.do" },
  { label: "국민건강보험공단 - 2026년 달라지는 건강·장기요양제도 안내", url: "https://www.nhis.or.kr/renewal_popup/poster/20260204_poster_longdesc_1.html" },
  { label: "근로복지공단 - 고용·산재보험료율", url: "https://www.comwel.or.kr/comwel/paym/paym/tari.jsp" },
  { label: "정책브리핑(보건복지부) - 2027년 건강보험료율 동결", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148971715" },
];

// ───────────────────────── 최저임금 (2026-minimum-wage) ─────────────────────────

const history = MIN_WAGE_HISTORY.map((x, i, arr) => {
  const prev = i > 0 ? arr[i - 1].hourly : undefined;
  return { ...x, diff: prev ? x.hourly - prev : undefined, rate: prev ? (x.hourly - prev) / prev : undefined };
});
const firstYear = MIN_WAGE_HISTORY[0];
const lastYear = MIN_WAGE_HISTORY[MIN_WAGE_HISTORY.length - 1];

const mw209 = MW * 209;
const next209 = NEXT_MIN_WAGE * 209;
const compareRows: [string, number, number][] = [
  ["시급", MW, NEXT_MIN_WAGE],
  ["일급(하루 8시간)", MW * 8, NEXT_MIN_WAGE * 8],
  ["주급(주 40시간 + 주휴 8시간)", MW * 48, NEXT_MIN_WAGE * 48],
  ["월급(209시간)", mw209, next209],
  ["연봉(월급 × 12)", mw209 * 12, next209 * 12],
];

const mwNoMeal = netOf(mw209 * 12, 0);
const mwMeal = netOf(mw209 * 12, MEAL);

const probation = MW * 0.9;
const probationMonthly = probation * 209;

const pt30Hours = monthlyPaidHours(30);
const pt30Pay = 1_650_000;
const pt30Hourly = Math.floor(pt30Pay / pt30Hours);
const pt30Wrong = Math.floor(pt30Pay / 209);
const hours40Exact = ((40 + 8) * 365) / 7 / 12;
const hours40Rounded = Math.round(hours40Exact * 100) / 100;
const min40Exact = Math.ceil(MW * hours40Rounded);

const minimumWageSections: ContentSection[] = [
  {
    heading: "연도별 최저임금과 월 환산액",
    body: [
      `최저임금위원회 결정현황에 따르면 ${Y + 1}년 최저임금은 시간당 ${won(NEXT_MIN_WAGE)}으로, ${Y + 1}년 1월 1일부터 적용됩니다. ${firstYear.year}년 ${won(firstYear.hourly)}과 비교하면 ${lastYear.year - firstYear.year}년 사이에 ${p((lastYear.hourly - firstYear.hourly) / firstYear.hourly, 1)} 올랐습니다.`,
    ],
    table: {
      caption: "연도별 최저임금(시간급)과 주 40시간 기준 환산액",
      head: ["연도", "시급", "전년 대비", "월 환산(209시간)", "연 환산"],
      rows: history.map((x) => [
        `${x.year}년`,
        won(x.hourly),
        x.diff !== undefined && x.rate !== undefined ? `+${n(x.diff)}원(${p(x.rate, 1)})` : "-",
        won(x.hourly * 209),
        won(x.hourly * 209 * 12),
      ]),
      note: "시급은 최저임금위원회 연도별 결정현황 기준입니다. 전년 대비 비율은 전년 시급으로 나눠 소수 첫째 자리까지 반올림해 고시된 인상률과 소수 둘째 자리가 다를 수 있습니다.",
    },
  },
  {
    heading: `${Y + 1}년 최저임금으로 바뀌는 금액`,
    body: [
      `${Y + 1}년에는 시급이 ${won(NEXT_MIN_WAGE - MW)} 오릅니다. 주 40시간 근무자의 최저 월급은 ${won(mw209)}에서 ${won(next209)}으로 ${won(next209 - mw209)} 늘어납니다. 시급제 아르바이트라면 1월 첫 근무일부터 새 시급을 받아야 하고, 월급제라도 시간당으로 환산한 금액이 새 최저임금보다 낮아지면 1월분 급여부터 맞춰야 합니다.`,
    ],
    table: {
      caption: `${Y}년과 ${Y + 1}년 최저임금 비교`,
      head: ["항목", `${Y}년`, `${Y + 1}년`, "차이"],
      rows: compareRows.map(([label, a, b]) => [label, won(a), won(b), won(b - a)]),
      note: "주급은 주 40시간에 유급 주휴 8시간을 더한 48시간분입니다. 모두 세전 금액입니다.",
    },
  },
  {
    heading: "최저임금 월급을 받으면 손에 쥐는 돈",
    body: [
      `주 40시간 근무로 ${Y}년 최저 월급 ${won(mw209)}을 받으면 4대보험료와 소득세가 빠집니다. 같은 월급이라도 그 안에서 식대 ${man(MEAL)}을 비과세로 나눠 주면 보험료와 세금이 줄어 실수령액이 달라집니다.`,
    ],
    table: {
      caption: `${Y}년 최저 월급(${won(mw209)})의 공제와 실수령액`,
      head: ["항목", "비과세 없음", `식대 ${man(MEAL)} 비과세`],
      rows: [
        ["월 세전", won(mwNoMeal.monthlyGross), won(mwMeal.monthlyGross)],
        ["국민연금", won(mwNoMeal.pension), won(mwMeal.pension)],
        ["건강보험", won(mwNoMeal.health), won(mwMeal.health)],
        ["장기요양보험", won(mwNoMeal.longTermCare), won(mwMeal.longTermCare)],
        ["고용보험", won(mwNoMeal.employment), won(mwMeal.employment)],
        ["소득세", won(mwNoMeal.incomeTax), won(mwMeal.incomeTax)],
        ["지방소득세", won(mwNoMeal.localTax), won(mwMeal.localTax)],
        ["월 실수령액", won(mwNoMeal.monthlyNet), won(mwMeal.monthlyNet)],
      ],
      note: "본인 1명(자녀 없음) 기준으로 연봉 실수령액 계산기에 넣은 결과입니다. 소득세는 연 세액을 12로 나눈 추정값이며 10원 미만은 버렸습니다.",
    },
    after: [
      `식대를 비과세로 나누면 같은 ${won(mw209)}이라도 실수령액이 ${won(mwMeal.monthlyNet - mwNoMeal.monthlyNet)} 늘어납니다. 매달 정기적으로 주는 식대는 최저임금에 들어가는 임금이므로, 식대를 포함한 합계가 최저 월급 이상이면 최저임금 기준도 지킨 것입니다.`,
    ],
  },
  {
    heading: "수습 기간 감액은 얼마까지 가능할까",
    body: [
      `감액이 허용되는 경우에도 줄일 수 있는 한도는 최저임금의 10%입니다. ${Y}년 기준으로 시급은 ${won(probation)}, 주 40시간 월급은 ${won(probationMonthly)}까지 낮출 수 있어 정상 금액보다 한 달에 ${won(mw209 - probationMonthly)}, 3개월 동안 ${won((mw209 - probationMonthly) * 3)} 적습니다.`,
      "감액은 수습을 시작한 날부터 3개월까지만 할 수 있고, 그 뒤에는 수습 기간이 남아 있다고 적혀 있어도 전액을 줘야 합니다. 6개월 계약처럼 근로계약 기간이 1년 미만이면 수습이라는 이름을 붙여도 감액할 수 없습니다. 계약서에 수습 감액이 적혀 있다면 계약 기간과 수습 기간을 함께 확인하세요.",
    ],
  },
  {
    heading: "주 40시간이 아닌데 209시간으로 나누는 실수",
    body: [
      "월급이 최저임금 이상인지 볼 때는 월급을 그 사람의 월 기준시간으로 나눠야 합니다. 209시간은 주 40시간 근무자에게만 맞는 숫자입니다. 근무 시간이 짧은 사람의 월급을 209시간으로 나누면 시급이 실제보다 훨씬 낮게 보입니다.",
      `예를 들어 주 30시간 일하고 월급 ${man(pt30Pay)}을 받는 사람을 보겠습니다. 1단계로 주휴시간을 구하면 30 ÷ 40 × 8 = 6시간입니다. 2단계로 월 기준시간은 (30 + 6) × 365 ÷ 7 ÷ 12 = ${hr(pt30Hours, 2)}입니다. 3단계로 ${won(pt30Pay)} ÷ ${hr(pt30Hours, 2)} = 시간당 약 ${won(pt30Hourly)}이므로 ${Y}년 최저시급 ${won(MW)} 이상입니다. 같은 월급을 209시간으로 나누면 약 ${won(pt30Wrong)}이 나와 최저임금 위반처럼 보이지만, 이것은 잘못된 계산입니다.`,
      `주 40시간 근무자도 엄밀한 기준시간은 (40 + 8) × 365 ÷ 7 ÷ 12 = 약 ${hr(hours40Rounded, 2)}입니다. 고용노동부는 이 값을 기준으로 시간급이 최저임금 이상이면 위반이 아니라고 답한 적이 있어, ${won(min40Exact)}처럼 고시된 월 환산액(${won(mw209)})보다 몇천 원 적은 월급이 곧바로 위반이 되지는 않습니다. 다만 급여 실무에서는 209시간 기준 금액을 주는 경우가 대부분입니다.`,
    ],
  },
];

const minimumWageSources: Source[] = [
  { label: "최저임금위원회 - 연도별 최저임금 결정현황", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do" },
  { label: "고용노동부 빠른인터넷상담 - 월급의 시간급 환산 기준시간(208.57시간)", url: "https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202509080138159080628" },
  { label: "고용노동부 빠른인터넷상담 - 수습 기간 최저임금 감액 요건", url: "https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202410251006263540208" },
  { label: "국민연금공단 - 2026년 4대 보험료율", url: "https://nps.or.kr/pnsinfo/ntpsklg/getOHAF0097M0.do" },
];

// ───────────────────────── 주휴수당 (weekly-holiday-pay-guide) ─────────────────────────

const weeklyRows = [14, 15, 16, 20, 24, 25, 30, 35, 40];
const hp = (weekly: number, wage = MW) => calcWeeklyHolidayPay(wage, weekly / 5, 5);
const hp15 = hp(15);
const hp14 = hp(14);

// 하루 8시간, 주 3일
const threeDays = calcWeeklyHolidayPay(MW, 8, 3);
const oneDayWay = 8 * MW;

// 예시: 하루 5시간, 주 4일
const ex = calcWeeklyHolidayPay(MW, 5, 4);
const exFourWeeks = ex.weeklyPay * 4;

const holidaySections: ContentSection[] = [
  {
    heading: "주 소정근로시간별 주휴수당 표",
    body: [
      `${Y}년 최저시급 ${won(MW)}을 기준으로 주 소정근로시간에 따른 주휴시간과 주휴수당을 계산했습니다. 주휴시간은 주 소정근로시간 ÷ 40 × 8로 구하고, 주 40시간 이상이어도 8시간을 넘지 않습니다.`,
    ],
    table: {
      caption: `주 소정근로시간별 주휴수당(${Y}년 최저시급 ${won(MW)} 기준)`,
      head: ["주 소정근로시간", "주휴시간", "주휴수당(1주)", "주휴 포함 주급", "한 달 주휴수당"],
      rows: weeklyRows.map((w) => {
        const r = hp(w);
        return [`${w}시간`, r.eligible ? hr(r.holidayHours) : "없음", won(r.holidayPay), won(r.weeklyPay), won(r.holidayPay * WEEKS_PER_MONTH)];
      }),
      note: "한 달 주휴수당은 1주 주휴수당에 한 달 평균 주 수(365 ÷ 7 ÷ 12 ≒ 4.345주)를 곱한 값입니다. 모두 세전 금액이며 원 단위로 반올림했습니다.",
    },
    after: [
      `주 14시간과 15시간은 1시간 차이지만 결과는 크게 다릅니다. 주 14시간이면 주급이 ${won(hp14.weeklyPay)}에서 끝나고, 주 15시간이면 주휴수당 ${won(hp15.holidayPay)}이 붙어 ${won(hp15.weeklyPay)}이 됩니다. 한 달로 보면 주휴수당만 약 ${won(hp15.holidayPay * WEEKS_PER_MONTH)}입니다. 시급이 최저임금보다 높다면 표의 금액에 내 시급 ÷ ${n(MW)}을 곱하면 됩니다.`,
    ],
  },
  {
    heading: "주 5일보다 적게 일하는 경우와 2025년 대법원 판결",
    body: [
      "주휴시간은 흔히 하루 소정근로시간만큼이라고 설명합니다. 주 5일 근무자에게는 두 방식의 결과가 같지만, 주 2~3일만 일하는 사람에게 하루치를 그대로 적용하면 하루 근무 시간이 같은 주 5일 근무자와 주휴수당이 같아지는 문제가 생깁니다.",
      "대법원은 2025년 8월 14일 선고한 2022다291153 판결에서 1주 소정근로일이 5일에 못 미치는 근로자는 소정근로일을 5일로 보고, 1주 소정근로시간을 5로 나누는 방법으로 주휴시간을 정하는 것이 타당하다고 판단했습니다. 주 40시간 이하에서 주 소정근로시간 ÷ 5는 주 소정근로시간 ÷ 40 × 8과 같은 값이므로, 이 사이트의 주휴수당 계산기도 같은 결과를 냅니다.",
      `하루 8시간씩 주 3일(주 24시간) 일한다면 하루치로 계산할 때는 8시간분 ${won(oneDayWay)}이지만, 판결의 방식으로는 24 ÷ 5 = ${hr(threeDays.holidayHours)}이라 주휴수당은 ${won(threeDays.holidayPay)}입니다. 주 2~3일 근무자는 근로계약서나 급여명세서에 적힌 주휴시간이 어느 방식인지 확인해 보세요.`,
    ],
  },
  {
    heading: "예시: 하루 5시간, 주 4일 일하는 아르바이트",
    body: [
      `평일 저녁에 하루 5시간씩 주 4일, 시급 ${won(MW)}을 받는 아르바이트를 예로 들어 보겠습니다.`,
      `1단계로 주 소정근로시간은 5 × 4 = ${hr(ex.weeklyHours)}으로 15시간 이상이라 주휴수당 대상입니다. 2단계로 주휴시간은 ${ex.weeklyHours} ÷ 40 × 8 = ${hr(ex.holidayHours)}입니다. 3단계로 주휴수당은 ${hr(ex.holidayHours)} × ${won(MW)} = ${won(ex.holidayPay)}입니다.`,
      `4단계로 그 주에 정해진 4일을 모두 나왔다면 주급은 근무 ${ex.weeklyHours}시간분 ${won(ex.weeklyHours * MW)}에 주휴수당을 더한 ${won(ex.weeklyPay)}입니다. 5단계로 한 달 평균으로 환산하면 (${ex.weeklyHours} + ${Number(ex.holidayHours.toFixed(1))}) × 365 ÷ 7 ÷ 12 = ${hr(ex.monthlyHours, 2)}, 월 약 ${won(ex.monthlyPay)}입니다.`,
      `한 달을 4주로 보고 주급 × 4로 계산하면 ${won(exFourWeeks)}이라 평균보다 약 ${won(ex.monthlyPay - exFourWeeks)} 적게 보입니다. 1년은 52주가 조금 넘어 한 달 평균이 약 4.345주이기 때문입니다. 실제로 받는 월급은 급여 기간에 들어 있는 주 수와 근무일 수에 따라 달마다 조금씩 달라집니다.`,
    ],
  },
  {
    heading: "입사한 주와 퇴사하는 주",
    body: [
      "1주는 꼭 월요일부터 세지 않습니다. 고용노동부는 회사의 주 단위가 월~일이어도 수요일에 입사한 사람은 입사일부터 다음 주 화요일까지를 1주로 본다고 설명합니다. 그래서 수요일에 입사했다면 첫 주의 개근 여부도 수요일부터 다음 주 화요일까지의 소정근로일로 따집니다.",
      "퇴사하는 주는 근로관계가 그 주 동안 이어졌는지가 기준입니다. 1주 동안 근로관계가 유지되고 소정근로일을 개근했다면 그다음 주에 일할 예정이 없어도 주휴수당이 생깁니다. 고용노동부 예시로는 월~금이 근무일이고 일요일이 주휴일일 때, 금요일까지만 근로관계가 유지되고 토요일에 퇴직하면 주휴수당이 없고, 일요일까지 근로관계가 유지되고 그다음 월요일에 퇴직하면 주휴수당이 생깁니다.",
      "그래서 마지막 근무일이 금요일이라도 퇴직일을 언제로 적는지에 따라 마지막 주 주휴수당이 달라질 수 있습니다. 퇴사 날짜를 정할 때 근로계약 종료일이 어떻게 적히는지 확인해 두세요.",
    ],
  },
  {
    heading: "연차를 쓰거나 회사가 쉰 날이 있는 주",
    body: [
      "주휴수당의 개근은 소정근로일에 스스로 일을 빠지지 않았는지를 봅니다. 지각과 조퇴 외에도 휴일, 휴가, 회사 사정으로 쉰 휴업일은 결근으로 보지 않습니다.",
      "연차휴가를 쓴 날은 출근한 것으로 봅니다. 주 5일 가운데 하루를 연차로 쉬고 나머지 날을 나왔다면 그 주의 주휴수당은 그대로입니다. 다만 그 주의 소정근로일을 모두 연차로 쉬어 한 번도 일하지 않았다면 주휴일을 유급으로 주지 않아도 된다는 것이 고용노동부 설명입니다. 퇴사 전에 남은 연차를 몰아서 쓸 때 이 점을 알아 두면 좋습니다.",
    ],
  },
  {
    heading: "주휴수당을 계산하기 전에 확인할 것",
    body: [
      "근로계약서: 1주 소정근로시간과 함께 주휴일이 무슨 요일인지 적혀 있는지 봅니다. 주휴일이 정해져 있어야 그 주의 개근 기간과 퇴사 주의 계산이 분명해집니다.",
      `'주휴수당 포함 시급'이라는 계약: 주 15시간 이상 40시간 이하로 일하면 주휴시간은 근무시간의 5분의 1(40시간에 8시간)이므로, 주휴수당을 포함했다는 시급은 최저시급의 1.2배 이상이어야 최저임금에 맞습니다. ${Y}년에는 ${won(MW * 1.2)}, ${Y + 1}년에는 ${won(NEXT_MIN_WAGE * 1.2)}입니다.`,
      "급여명세서: 주휴수당이 따로 적혀 있는지, 적혀 있다면 주휴시간에 시급을 곱한 값과 맞는지 확인합니다. 월급제라면 주휴수당이 월급 안에 들어 있는 경우가 많으니 시급으로 환산해 최저임금과 비교합니다.",
      "마지막 근무 주: 퇴직일이 주휴일 전인지 뒤인지에 따라 그 주 주휴수당이 달라지므로, 퇴사 날짜를 정하기 전에 확인합니다.",
    ],
  },
];

const holidaySources: Source[] = [
  { label: "국가법령정보센터 - 대법원 2025. 8. 14. 선고 2022다291153 판결", url: "https://www.law.go.kr/LSW//precInfoP.do?precSeq=608507" },
  { label: "고용노동부 빠른인터넷상담 - 입사·퇴사 주의 주휴수당(1주간 근로관계 존속)", url: "https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202406250229556860148" },
  { label: "고용노동부 빠른인터넷상담 - 1주 단위 기산일과 주휴수당 산정", url: "https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202302011542216101000" },
  { label: "고용노동부 빠른인터넷상담 - 연차를 쓴 주의 주휴일", url: "https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202409091232250370702" },
  { label: "최저임금위원회 - 연도별 최저임금 결정현황", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do" },
];

export const guidePagesA: Record<string, GuideExtra> = {
  "salary-vs-take-home": { updated: UPDATED, mode: "replace", sections: salarySections, sources: salarySources },
  "2026-social-insurance-rates": { updated: UPDATED, mode: "replace", sections: insuranceSections, sources: insuranceSources },
  "2026-minimum-wage": { updated: UPDATED, mode: "append", sections: minimumWageSections, sources: minimumWageSources },
  "weekly-holiday-pay-guide": { updated: UPDATED, mode: "append", sections: holidaySections, sources: holidaySources },
};
