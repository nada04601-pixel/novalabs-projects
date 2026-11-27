import { RATES } from "@/data/rates/2026";
import { calcWeeklyHolidayPay } from "@/lib/calculators/weeklyHolidayPay";
import { convertWage, monthlyPaidHours } from "@/lib/calculators/wageConvert";
import type { ContentSection, Source } from "@/data/content";
import type { ToolExtra } from "../types";
import { hr, man, n, netOf, NEXT_MIN_WAGE, p, taxSteps, won } from "./helpers";

const UPDATED = "2026-11-23";
const Y = RATES.year;
const MW = RATES.minimumWage;
const MEAL = RATES.incomeTax.mealTaxFreeLimit;

// ───────────────────────── 연봉 실수령액 계산기 (net-salary) ─────────────────────────

const exAnnual = 40_000_000;
const t = taxSteps(exAnnual);
const r = t.r;
const pensionBase = Math.floor(Math.min(Math.max(t.taxableMonthly, RATES.pension.minBase), RATES.pension.maxBase) / 1000) * 1000;

const famAnnual = 50_000_000;
const famCases: { label: string; dependents: number; children: number }[] = [
  { label: "본인만", dependents: 1, children: 0 },
  { label: "본인 + 배우자", dependents: 2, children: 0 },
  { label: "본인 + 배우자 + 부모 1명", dependents: 3, children: 0 },
  { label: "본인 + 배우자 + 자녀 1명", dependents: 3, children: 1 },
  { label: "본인 + 배우자 + 자녀 2명", dependents: 4, children: 2 },
];
const famBase = netOf(famAnnual, MEAL, 1, 0);

const ntAnnual = 40_000_000;
const ntCases = [0, 100_000, MEAL, 400_000];
const ntBase = netOf(ntAnnual, 0);

const netSalarySections: ContentSection[] = [
  {
    heading: "계산 예시: 연봉 4,000만 원을 넣으면",
    body: [
      `연봉 ${man(exAnnual)}, 비과세 식대 월 ${n(MEAL)}원, 부양가족 1명(본인), 자녀 0명을 넣었을 때 계산기가 거치는 순서를 그대로 펼쳐 보았습니다. 앞쪽은 매달 빠지는 4대보험, 뒤쪽은 1년 세금을 추정해 12로 나누는 단계입니다.`,
    ],
    table: {
      caption: `연봉 ${man(exAnnual)}의 계산 단계(${Y}년 요율)`,
      head: ["단계", "계산", "금액"],
      rows: [
        ["월 세전 급여", "연봉 ÷ 12", won(r.monthlyGross)],
        ["과세 대상 월 급여", `월 세전 − 비과세 ${n(MEAL)}`, won(t.taxableMonthly)],
        ["국민연금", `기준소득월액 ${n(pensionBase)} × ${p(RATES.pension.rate)}`, won(r.pension)],
        ["건강보험", `과세 대상 × ${p(RATES.health.rate, 3)}`, won(r.health)],
        ["장기요양보험", `건강보험료 × ${p(RATES.longTermCare.rateOfHealth)}`, won(r.longTermCare)],
        ["고용보험", `과세 대상 × ${p(RATES.employment.rate, 1)}`, won(r.employment)],
        ["연 총급여", "과세 대상 × 12", won(t.gross)],
        ["근로소득공제", "총급여 구간별 공제율", won(t.deduction)],
        ["근로소득금액", "총급여 − 근로소득공제", won(t.incomeAmount)],
        ["인적공제·보험료 공제", `${n(RATES.incomeTax.personalDeduction)} + 연간 4대보험료`, won(t.personal + t.pensionYear + t.otherInsYear)],
        ["과세표준", "근로소득금액 − 공제", won(t.taxBase)],
        ["산출세액", "누진세율 적용", won(t.calculated)],
        ["근로소득세액공제", "산출세액 비율, 총급여별 한도", won(t.credit)],
        ["결정세액(연)", "산출세액 − 세액공제", won(t.determined)],
        ["월 소득세", "결정세액 ÷ 12", won(r.incomeTax)],
        ["지방소득세", "소득세 × 10%", won(r.localTax)],
        ["월 실수령액", "월 세전 − 공제 합계", won(r.monthlyNet)],
      ],
      note: "중간 단계 금액은 원 단위로 반올림해 보여 주고, 보험료와 월 세액은 10원 미만을 버립니다. 연말정산 때 받는 표준세액공제, 카드·의료비 공제 같은 항목은 넣지 않은 추정이라 실제 1년 세금과는 차이가 날 수 있습니다.",
    },
    after: [
      `이 예시에서 한 달 공제 합계는 ${won(r.totalDeduction)}으로 월 세전의 ${p(r.totalDeduction / r.monthlyGross, 1)}입니다. 이 가운데 4대보험이 ${won(r.pension + r.health + r.longTermCare + r.employment)}, 소득세와 지방소득세가 ${won(r.incomeTax + r.localTax)}입니다.`,
    ],
  },
  {
    heading: "부양가족과 자녀 수에 따라 달라지는 금액",
    body: [
      "부양가족 수는 인적공제(1명당 150만 원)를 늘려 과세표준을 낮추고, 9세 이상 20세 이하 자녀 수(2026년분 기준)는 세액공제로 세금을 바로 줄입니다. 4대보험료는 가족 수와 관계없으므로 달라지는 것은 소득세와 지방소득세뿐입니다.",
    ],
    table: {
      caption: `연봉 ${man(famAnnual)}에서 가족 구성별 소득세와 실수령액`,
      head: ["가족 구성", "입력값(부양가족·자녀)", "월 소득세", "지방소득세", "월 실수령액", "본인만일 때보다"],
      rows: famCases.map((c) => {
        const x = netOf(famAnnual, MEAL, c.dependents, c.children);
        return [c.label, `${c.dependents}명 · ${c.children}명`, won(x.incomeTax), won(x.localTax), won(x.monthlyNet), c.dependents === 1 && c.children === 0 ? "-" : `+${won(x.monthlyNet - famBase.monthlyNet)}`];
      }),
      note: `식대 비과세 월 ${n(MEAL)}원 기준입니다. 부양가족 수는 본인을 포함하며, 소득 요건을 채운 가족만 넣을 수 있습니다. 자녀는 부양가족 수에도 함께 셉니다.`,
    },
    after: [
      "같은 회사, 같은 연봉이라도 동료와 월급이 몇만 원씩 다른 이유가 대부분 이것입니다. 다만 회사가 매달 떼는 세금은 근로자가 낸 부양가족 신고서를 따르므로, 가족이 늘었다면 회사에 다시 신고해야 월급에 반영됩니다.",
    ],
  },
  {
    heading: "비과세 금액을 바꾸면 달라지는 금액",
    body: [
      "비과세 칸에 넣는 금액은 4대보험료와 소득세를 매기는 기준에서 모두 빠집니다. 식대 외에 자가운전보조금처럼 비과세로 처리되는 수당이 있다면 그 금액까지 더해 넣어야 실제와 가까워집니다.",
    ],
    table: {
      caption: `연봉 ${man(ntAnnual)}에서 월 비과세 금액별 공제와 실수령액`,
      head: ["월 비과세", "4대보험", "소득세·지방소득세", "월 실수령액", "비과세 0원일 때보다"],
      rows: ntCases.map((nt) => {
        const x = netOf(ntAnnual, nt);
        return [won(nt), won(x.pension + x.health + x.longTermCare + x.employment), won(x.incomeTax + x.localTax), won(x.monthlyNet), nt === 0 ? "-" : `+${won(x.monthlyNet - ntBase.monthlyNet)}`];
      }),
      note: "본인 1명, 자녀 0명 기준입니다. 월 비과세 40만 원은 식대 20만 원과 요건을 채운 자가운전보조금 20만 원을 함께 받는 경우를 가정했습니다.",
    },
  },
];

const netSalarySources: Source[] = [
  { label: "국민연금공단 - 2026년 4대 보험료율과 기준소득월액 상·하한", url: "https://nps.or.kr/pnsinfo/ntpsklg/getOHAF0097M0.do" },
  { label: "국민건강보험공단 - 2026년 달라지는 건강·장기요양제도 안내", url: "https://www.nhis.or.kr/renewal_popup/poster/20260204_poster_longdesc_1.html" },
  { label: "국세청 - 근로소득 과세표준과 기본세율", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6594&cntntsId=7873" },
  { label: "국세청 - 근로소득 원천징수방법(간이세액표)", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=6583&cntntsId=7862" },
];

// ───────────────────────── 주휴수당 계산기 (weekly-holiday-pay) ─────────────────────────

const patterns: { label: string; h: number; d: number }[] = [
  { label: "평일 하루 4시간 × 주 5일", h: 4, d: 5 },
  { label: "주말 하루 8시간 × 주 2일", h: 8, d: 2 },
  { label: "주말 하루 7시간 × 주 2일", h: 7, d: 2 },
  { label: "하루 6시간 × 주 3일", h: 6, d: 3 },
  { label: "하루 8시간 × 주 5일", h: 8, d: 5 },
  { label: "하루 9시간 × 주 5일", h: 9, d: 5 },
];
const over = calcWeeklyHolidayPay(MW, 9, 5);
const overExtraHours = over.weeklyHours - 40;
const overPremiumWeekly = overExtraHours * MW * 0.5;
const weekend7 = calcWeeklyHolidayPay(MW, 7, 2);
const weekend8 = calcWeeklyHolidayPay(MW, 8, 2);
const now20 = calcWeeklyHolidayPay(MW, 4, 5);
const next20 = calcWeeklyHolidayPay(NEXT_MIN_WAGE, 4, 5);

const holidayToolSections: ContentSection[] = [
  {
    heading: "근무 형태별 입력 예시와 결과",
    body: [
      `하루 근무 시간과 주 근무 일수를 바꿔 넣었을 때 계산기에 나오는 값을 ${Y}년 최저시급 ${won(MW)} 기준으로 모았습니다. 내 근무 형태와 가장 가까운 줄을 찾아 결과를 미리 가늠해 볼 수 있습니다.`,
    ],
    table: {
      caption: `근무 형태별 주휴수당과 월 환산 급여(시급 ${won(MW)})`,
      head: ["근무 형태", "주 근무", "주휴시간", "주휴수당(주)", "주급", "월 환산 급여"],
      rows: patterns.map((x) => {
        const c = calcWeeklyHolidayPay(MW, x.h, x.d);
        return [x.label, hr(c.weeklyHours), c.eligible ? hr(c.holidayHours) : "없음", won(c.holidayPay), won(c.weeklyPay), won(c.monthlyPay)];
      }),
      note: "월 환산 급여는 (주 근무시간 + 주휴시간) × 365 ÷ 7 ÷ 12 × 시급입니다. 세전 금액이며 원 단위로 반올림했습니다.",
    },
    after: [
      `주말 하루 7시간씩 이틀이면 주 ${hr(weekend7.weeklyHours)}이라 주휴수당이 없고, 하루 8시간으로 늘리면 주 ${hr(weekend8.weeklyHours)}이 되어 주휴수당 ${won(weekend8.holidayPay)}이 붙습니다. 월 환산 급여로는 ${won(weekend8.monthlyPay - weekend7.monthlyPay)} 차이가 납니다. 경계에 있는 근무 형태라면 계약서의 소정근로시간을 꼭 확인하세요.`,
    ],
  },
  {
    heading: "주 40시간을 넘게 입력하면 어떻게 계산되나",
    body: [
      `하루 9시간, 주 5일처럼 주 40시간을 넘게 넣으면 주휴시간은 8시간에서 더 늘지 않습니다. 넘는 ${overExtraHours}시간은 시급 그대로 곱해 주급과 월 환산 급여에 들어갑니다. 위 표의 마지막 줄이 이 경우입니다.`,
      `상시 근로자 5명 이상 사업장에서는 주 40시간을 넘는 연장근로에 통상임금의 50%를 더 줘야 하는데, 이 계산기는 그 가산분을 넣지 않습니다. 최저시급 기준으로 매주 ${overExtraHours}시간 연장근로라면 가산분만 주 ${won(overPremiumWeekly)}입니다. 연장근로가 있다면 연장·야간·휴일수당 계산기로 따로 계산해 더하세요. 상시 4명 이하 사업장은 가산 규정이 적용되지 않아 일한 시간만큼 시급을 받습니다.`,
    ],
  },
  {
    heading: `${Y + 1}년 최저시급을 넣어 보면`,
    body: [
      `${Y + 1}년 최저임금은 시간당 ${won(NEXT_MIN_WAGE)}입니다. 시급 칸에 이 금액을 넣으면 새해 금액을 미리 볼 수 있습니다. 평일 하루 4시간, 주 5일이라면 주휴수당은 주 ${won(now20.holidayPay)}에서 ${won(next20.holidayPay)}으로, 월 환산 급여는 ${won(now20.monthlyPay)}에서 ${won(next20.monthlyPay)}으로 ${won(next20.monthlyPay - now20.monthlyPay)} 늘어납니다.`,
      "주휴수당은 시급에 비례하므로 시급이 오른 비율만큼 그대로 늘어납니다. 근무 시간이나 일수는 그대로 두고 시급만 바꿔 넣으면 됩니다.",
    ],
  },
];

const holidayToolSources: Source[] = [
  { label: "고용노동부 빠른인터넷상담 - 주휴수당 발생 요건(주 15시간, 개근)", url: "https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202405031250375970355" },
  { label: "국가법령정보센터 - 대법원 2025. 8. 14. 선고 2022다291153 판결(주휴시간 산정)", url: "https://www.law.go.kr/LSW//precInfoP.do?precSeq=608507" },
  { label: "고용노동부 고객상담센터 - 5인 미만 사업장 가산수당 적용 제외", url: "https://1350.moel.go.kr/rtmview.do?id=1000000868" },
  { label: "최저임금위원회 - 연도별 최저임금 결정현황", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do" },
];

// ───────────────────────── 시급·월급·연봉 변환기 (wage-converter) ─────────────────────────

const weeklyHoursRows = [10, 15, 20, 25, 30, 35, 39, 40];
const h39 = monthlyPaidHours(39);

const posts: { name: string; desc: string; basis: "hourly" | "monthly" | "annual"; amount: number; weekly: number }[] = [
  { name: "A", desc: "시급 11,000원, 주 25시간", basis: "hourly", amount: 11_000, weekly: 25 },
  { name: "B", desc: "월급 200만 원, 주 35시간", basis: "monthly", amount: 2_000_000, weekly: 35 },
  { name: "C", desc: "연봉 2,900만 원, 주 40시간", basis: "annual", amount: 29_000_000, weekly: 40 },
];
const postResults = posts.map((x) => ({ ...x, r: convertWage(x.basis, x.amount, x.weekly) }));
const ranked = [...postResults].sort((a, b) => b.r.hourly - a.r.hourly);
const highestMonthly = [...postResults].sort((a, b) => b.r.monthly - a.r.monthly)[0];
const postA = postResults[0];
const postB = postResults[1];

const incAnnual = 29_000_000;
const incWrong = convertWage("annual", incAnnual, 40);
const incRight = convertWage("annual", (incAnnual * 12) / 13, 40);

const wageSections: ContentSection[] = [
  {
    heading: "최저시급을 넣었을 때 주 근무시간별 결과",
    body: [
      `시급 칸에 ${Y}년 최저시급 ${won(MW)}을 넣고 주 소정근로시간만 바꿔 본 결과입니다. 주 15시간부터는 주휴시간이 더해져 월 환산 시간이 일한 시간보다 늘어납니다.`,
    ],
    table: {
      caption: `주 소정근로시간별 월 환산 시간과 세전 급여(시급 ${won(MW)})`,
      head: ["주 소정근로시간", "월 환산 시간", "월급", "연봉"],
      rows: weeklyHoursRows.map((w) => {
        const c = convertWage("hourly", MW, w);
        return [`${w}시간`, hr(c.hours, 1), won(c.monthly), won(c.annual)];
      }),
      note: "월 환산 시간은 (주 소정근로시간 + 주휴시간) × 365 ÷ 7 ÷ 12이고, 주 40시간만 급여 실무에서 쓰는 209시간을 씁니다. 주 15시간 미만은 주휴시간이 없습니다. 원 단위로 반올림했습니다.",
    },
    after: [
      `주 39시간은 공식대로 계산하면 약 ${hr(h39, 1)}인데 주 40시간은 209시간이라, 1시간 차이에 비해 월 환산 시간이 크게 벌어집니다. 주 40시간의 정확한 값은 약 208.57시간이고 이를 올림해 209시간을 쓰는 관행 때문입니다. 주 40시간 근무자의 월급은 이 관행에 맞춰 계산하는 것이 일반적이므로 변환기도 그대로 따릅니다.`,
    ],
  },
  {
    heading: "채용 공고 세 개를 시급으로 비교한 예",
    body: [
      "공고마다 급여 표기가 다를 때는 모두 시급으로 바꾸면 비교가 쉬워집니다. 아래 세 공고를 변환기에 넣어 보았습니다.",
    ],
    table: {
      caption: "급여 표기가 다른 공고 세 개를 같은 기준으로 환산",
      head: ["공고", "조건", "시급", "월급", "연봉"],
      rows: postResults.map((x) => [x.name, x.desc, won(x.r.hourly), won(x.r.monthly), won(x.r.annual)]),
      note: "모두 세전, 주휴수당 포함 기준이며 원 단위로 반올림했습니다. 연봉 공고는 퇴직금 별도로 가정했습니다.",
    },
    after: [
      `시급으로 보면 ${ranked.map((x) => `${x.name}(${won(x.r.hourly)})`).join(" > ")} 순입니다. 한 달에 받는 금액은 근무 시간이 가장 긴 ${highestMonthly.name}가 가장 많지만, 같은 시간을 일했을 때의 대우는 시급으로 비교해야 정확합니다.`,
      `B 공고의 월급 ${won(postB.r.monthly)}은 A 공고를 월급으로 바꾼 ${won(postA.r.monthly)}보다 많아 보이지만, 주 ${postB.weekly}시간 기준이라 시급으로는 ${won(postB.r.hourly)}으로 A보다 ${won(postA.r.hourly - postB.r.hourly)} 낮습니다. 월급 공고는 몇 시간 기준인지 꼭 함께 보세요.`,
    ],
  },
  {
    heading: "퇴직금 포함 연봉을 그대로 넣으면 생기는 차이",
    body: [
      `연봉 ${man(incAnnual)}이 퇴직금 포함 금액인데 그대로 넣으면 시급이 ${won(incWrong.hourly)}으로 나옵니다. 퇴직금 몫을 빼고 ${man(incAnnual)} × 12 ÷ 13 = ${won((incAnnual * 12) / 13)}을 넣으면 실제 시급은 ${won(incRight.hourly)}, 월급은 ${won(incRight.monthly)}입니다.`,
      `퇴직금 몫은 퇴직할 때 받는 돈이라 최저임금 계산에도 들어가지 않습니다. 이 경우 시급 차이가 ${won(incWrong.hourly - incRight.hourly)}이나 되므로, 연봉을 넣기 전에 계약서에서 퇴직금 포함 여부와 고정 연장근로수당이 들어 있는지 먼저 확인하세요. 고정 연장근로수당이 들어 있다면 그 시간도 근무 시간에 포함되어 실제 시급은 더 낮아집니다.`,
    ],
  },
];

const wageSources: Source[] = [
  { label: "고용노동부 빠른인터넷상담 - 월급의 시간급 환산 기준시간(최저임금법 시행령 제5조)", url: "https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202509080138159080628" },
  { label: "최저임금위원회 - 연도별 최저임금 결정현황(2026년 월 환산액 209시간 기준)", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do" },
  { label: "고용노동부 빠른인터넷상담 - 주휴수당 발생 요건(주 15시간)", url: "https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202405031250375970355" },
];

export const toolPagesA: Record<string, ToolExtra> = {
  "net-salary": { updated: UPDATED, sections: netSalarySections, sources: netSalarySources },
  "weekly-holiday-pay": { updated: UPDATED, sections: holidayToolSections, sources: holidayToolSources },
  "wage-converter": { updated: UPDATED, sections: wageSections, sources: wageSources },
};
