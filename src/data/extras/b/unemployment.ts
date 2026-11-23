import { RATES } from "@/data/rates/2026";
import { calcUnemployment, type InsuredPeriod } from "@/lib/calculators/unemployment";
import { calcLeaveAllowance } from "@/lib/calculators/annualLeave";
import { calcSeverance } from "@/lib/calculators/severance";
import type { GuideExtra, ToolExtra } from "../types";
import { addDays, ko, koMD, man, monthsBefore, n, won } from "./fmt";

// 실업급여 보강 글: 일액·일수는 실업급여 계산기(calcUnemployment) 식으로 계산합니다.

const PERIODS: { key: InsuredPeriod; label: string }[] = [
  { key: "lt1", label: "1년 미만" },
  { key: "1to3", label: "1년 이상 3년 미만" },
  { key: "3to5", label: "3년 이상 5년 미만" },
  { key: "5to10", label: "5년 이상 10년 미만" },
  { key: "10plus", label: "10년 이상" },
];

type U = { wages3m: number; days3m?: number; dailyHours?: number; period?: InsuredPeriod; over50?: boolean };
const run = (u: U) =>
  calcUnemployment({
    wages3m: u.wages3m,
    days3m: u.days3m ?? 92,
    dailyHours: u.dailyHours ?? 8,
    period: u.period ?? "1to3",
    over50OrDisabled: u.over50 ?? false,
  });

const base = run({ wages3m: 0 });
const LOWER = base.lower; // 하루 8시간 하한액
const UPPER = base.upper; // 상한액
const BASE_CAP = Math.round(RATES.unemployment.dailyMax / 0.6); // 기초일액 상한(시행령 제68조): 상한액 = 기초일액 상한 × 60%
// 1일 통상임금 = 월 통상임금 ÷ 209 × 8
const dailyOrdinary = (monthly: number) => calcLeaveAllowance(monthly, 209, 8, 1).daily;
// 평균임금과 통상임금 중 큰 쪽을 기초일액으로 삼아 계산합니다(고용보험법 제45조제2항). 92일치로 바꿔 계산기에 넣습니다.
const withOrdinary = (avgDaily: number, ordinary: number, u: Omit<U, "wages3m"> = {}) =>
  run({ ...u, wages3m: Math.max(avgDaily, ordinary) * (u.days3m ?? 92) });

// ── 가이드: 월급별 일액 ────────────────────────────────
const monthly = [RATES.minimumWage * 209, 2_500_000, 2_800_000, 2_900_000, 3_000_000, 3_500_000, 5_000_000];
const monthlyRows = monthly.map((m) => {
  const avgOnly = run({ wages3m: m * 3 });
  const ord = dailyOrdinary(m);
  const legal = withOrdinary(avgOnly.avgDaily, ord);
  return { m, avgOnly, ord, legal };
});
// 경계: 월급 전액이 통상임금일 때와 평균임금만 볼 때
const toMonthlyByOrdinary = (dailyBase: number) => (dailyBase / 8) * 209;
const toMonthlyByAverage = (dailyBase: number) => (dailyBase * 92) / 3;
const lowEdgeOrd = toMonthlyByOrdinary(LOWER / 0.6);
const highEdgeOrd = toMonthlyByOrdinary(BASE_CAP);
const lowEdgeAvg = toMonthlyByAverage(LOWER / 0.6);
const highEdgeAvg = toMonthlyByAverage(BASE_CAP);

// ── 가이드: 52세 예시 ──────────────────────────────────
const EX_LAST = "2026-10-31";
const EX_PAY = 3_400_000;
const exDays3m = calcSeverance({ startDate: "2019-11-01", endDate: addDays(EX_LAST, 1), last3MonthsWage: 0, annualBonus: 0, annualLeavePay: 0 })!.periodDays;
const exA = { label: `기본급 ${man(EX_PAY)}`, ordinaryMonthly: EX_PAY };
const exB = { label: `기본급 ${man(2_500_000)} + 연장근로수당 ${man(EX_PAY - 2_500_000)}`, ordinaryMonthly: 2_500_000 };
const exCalc = [exA, exB].map((p) => {
  const avgOnly = run({ wages3m: EX_PAY * 3, days3m: exDays3m, period: "5to10", over50: true });
  const ord = dailyOrdinary(p.ordinaryMonthly);
  const r = withOrdinary(avgOnly.avgDaily, ord, { days3m: exDays3m, period: "5to10", over50: true });
  const baseDaily = Math.min(Math.max(avgOnly.avgDaily, ord), BASE_CAP);
  return { ...p, avgOnly, ord, r, baseDaily };
});
const [ra, rb] = exCalc;
const PAID_BEFORE_JOB = 100;
const earlyBonus = Math.floor((ra.r.daily * (ra.r.days - PAID_BEFORE_JOB)) / 2); // 조기재취업수당 = 일액 × 남은 일수 × 1/2

// ── 가이드: 신청 기한 ──────────────────────────────────
const dayOptions = Array.from(new Set(PERIODS.flatMap((p) => [run({ wages3m: 0, period: p.key }).days, run({ wages3m: 0, period: p.key, over50: true }).days]))).sort((a, b) => a - b);
const WAIT = 7;
const YEAR = 365;

// ── 가이드: 2027년 최저임금 ────────────────────────────
// 최저임금위원회 고시(2026.8.5): 2027년 적용 최저임금 시간급 10,700원
const MIN_WAGE_2027 = 10_700;
const lower2027 = MIN_WAGE_2027 * 0.8 * 8;

export const unemploymentGuide: GuideExtra = {
  updated: "2026-11-23",
  mode: "append",
  sections: [
    {
      heading: "나이와 가입 기간별 소정급여일수표",
      body: [
        "구직급여를 받을 수 있는 날 수(소정급여일수)는 이직일 당시 나이와 고용보험 가입 기간(피보험기간)으로 정해집니다. 고용보험법 별표 1의 일수를 정리하면 다음과 같습니다.",
      ],
      table: {
        caption: "구직급여 소정급여일수 (2019년 10월 1일 이후 이직자)",
        head: ["고용보험 가입 기간", "50세 미만", "50세 이상·장애인"],
        rows: PERIODS.map((p) => [p.label, `${run({ wages3m: 0, period: p.key }).days}일`, `${run({ wages3m: 0, period: p.key, over50: true }).days}일`]),
        note: "나이는 이직일 현재 만 나이입니다. 장애인은 나이와 관계없이 50세 이상 칸을 적용합니다.",
      },
      after: [
        "여기서 가입 기간은 수급 조건을 따질 때 쓰는 '피보험 단위기간 180일'과 다른 개념입니다. 단위기간은 임금을 받은 날만 세지만, 소정급여일수를 정하는 피보험기간은 이직 당시 회사에 고용된 기간 전체를 셉니다(고용보험법 제50조).",
        `직장을 옮긴 사람은 이전 직장의 고용보험 자격을 잃은 날부터 3년 안에 지금 직장에서 다시 가입했다면 두 기간을 합칩니다. 다만 이전 직장을 그만두고 구직급여를 받은 적이 있다면 그 이전 기간은 합치지 않습니다. 예를 들어 지금 회사에 4년을 다닌 50세 미만 근로자가 그 전에 2년 다닌 직장을 그만두고 3년 안에 지금 회사에 들어왔고 그때 실업급여를 받지 않았다면, 가입 기간은 6년이 되어 소정급여일수가 ${run({ wages3m: 0, period: "3to5" }).days}일에서 ${run({ wages3m: 0, period: "5to10" }).days}일로 늘어납니다.`,
      ],
    },
    {
      heading: "월급별 구직급여 일액 비교",
      body: [
        "구직급여 일액은 기초일액(이직 전 평균임금)의 60%이지만, 고용보험법 제45조제2항은 평균임금이 통상임금보다 적으면 통상임금을 기초일액으로 삼도록 정하고 있습니다. 1일 통상임금은 월 통상임금 ÷ 209 × 8로 구하므로, 기본급 위주로 받는 사람은 이 값이 3개월 임금을 달력 일수로 나눈 평균임금보다 큰 경우가 많습니다.",
        `기초일액에는 상한 ${won(BASE_CAP)}이 있어(고용보험법 시행령 제68조) 일액은 그 60%인 ${won(UPPER)}을 넘지 않고, 아래로는 최저시급의 80% × 하루 소정근로시간인 하한액(하루 8시간이면 ${won(LOWER)})이 보장됩니다. 아래 표는 월급 전액이 통상임금이고 퇴직 전 3개월이 92일인 경우입니다.`,
      ],
      table: {
        caption: `월급별 구직급여 일액 (${RATES.year}년 이직, 하루 8시간, 산정 기간 92일)`,
        head: ["월급(세전)", "1일 평균임금", "1일 통상임금", "평균임금만 볼 때", "통상임금과 비교한 뒤"],
        rows: monthlyRows.map((r, i) => [
          i === 0 ? `${won(r.m)}(최저임금)` : man(r.m),
          won(r.avgOnly.avgDaily),
          won(r.ord),
          won(r.avgOnly.daily),
          won(r.legal.daily),
        ]),
        note: "'평균임금만 볼 때'는 이 사이트 실업급여 계산기에서 월 통상임금 칸을 비우고 3개월 임금만 넣은 결과입니다. 원 단위 미만 버림.",
      },
      after: [
        `월급이 모두 통상임금인 사람은 월 약 ${man(lowEdgeOrd)} 이하이면 하한액, 약 ${man(highEdgeOrd)} 이상이면 상한액을 받습니다. 평균임금만으로 계산하면 이 경계가 월 약 ${man(lowEdgeAvg)}과 ${man(highEdgeAvg)}으로 올라가 실제보다 적게 나올 수 있습니다. 하한액과 상한액의 차이가 하루 ${won(UPPER - LOWER)}뿐이라, 하루 8시간 일한 직장인이라면 대부분 하루 ${won(LOWER)}~${won(UPPER)} 사이를 받습니다.`,
      ],
    },
    {
      heading: "52세 권고사직자의 실업급여 계산 예시",
      body: [
        `만 52세에 같은 회사를 7년 다니다 경영 악화로 권고사직을 받고 ${ko(EX_LAST)}까지 일한 사람을 예로 들겠습니다. 퇴직 전 3개월(8월 1일~10월 31일, ${exDays3m}일) 동안 매달 ${man(EX_PAY)}을 받았습니다. 같은 월급이라도 임금 구성에 따라 결과가 달라지는 것을 보려고, 전액이 기본급인 경우(A)와 기본급에 매달 연장근로수당이 더해진 경우(B)를 나란히 계산했습니다.`,
      ],
      table: {
        caption: "50세 이상, 가입 기간 5년 이상 10년 미만, 하루 8시간",
        head: ["단계", `A: ${ra.label}`, `B: ${rb.label}`],
        rows: [
          ["① 1일 평균임금(3개월 임금 ÷ 일수)", won(ra.avgOnly.avgDaily), won(rb.avgOnly.avgDaily)],
          ["② 1일 통상임금(월 통상임금 ÷ 209 × 8)", won(ra.ord), won(rb.ord)],
          [`③ 기초일액(①·② 중 큰 쪽, 상한 ${won(BASE_CAP)})`, won(ra.baseDaily), won(rb.baseDaily)],
          ["④ 구직급여 일액(③ × 60%, 하한·상한 적용)", won(ra.r.daily), won(rb.r.daily)],
          ["⑤ 소정급여일수", `${ra.r.days}일`, `${rb.r.days}일`],
          ["⑥ 총액(④ × ⑤)", won(ra.r.total), won(rb.r.total)],
          ["30일 기준 금액", won(ra.r.monthly), won(rb.r.monthly)],
        ],
        note: "원 단위 미만 버림, 세금은 붙지 않습니다. 실제 지급은 실업인정일마다 그 기간의 일수만큼 나눠 받습니다.",
      },
      after: [
        `${ra.ord > ra.avgOnly.avgDaily ? "A는 1일 통상임금이 평균임금보다 커서 통상임금이 기초일액이 되고" : "A는 평균임금이 기초일액이 되고"}${ra.r.daily === UPPER ? ", 그 60%가 상한액을 넘어 상한액을 받습니다" : ""}. B는 ${rb.ord > rb.avgOnly.avgDaily ? "통상임금" : "평균임금"}을 기준으로 계산됩니다. 계산기에 3개월 임금만 넣으면 두 사람 모두 ${won(ra.avgOnly.daily)}으로 나오지만, 법에 따른 총액은 ${won(ra.r.total - rb.r.total)} 차이가 납니다. 이직확인서에 적힌 임금과 통상임금 내역이 실제와 맞는지 확인하는 것이 중요한 이유입니다.`,
        `A가 ${PAID_BEFORE_JOB}일분을 받은 뒤 새 직장에 들어가 12개월 이상 일하면, 남은 ${ra.r.days - PAID_BEFORE_JOB}일이 소정급여일수의 절반 이상이므로 조기재취업수당으로 ${won(ra.r.daily)} × ${ra.r.days - PAID_BEFORE_JOB}일 × 1/2 = ${won(earlyBonus)}을 받을 수 있습니다(고용보험법 시행령 제84조·제85조). 실업 신고일부터 14일이 지난 뒤 재취업해야 하고, 이전 회사나 그 관련 회사에 다시 고용된 경우 등은 제외되며, 청구는 재취업 후 12개월이 지나서 합니다.`,
      ],
    },
    {
      heading: "스스로 그만둬도 인정되는 이직 사유",
      body: [
        "자기 사정으로 그만두면 원칙적으로 구직급여를 받을 수 없지만, 고용보험법 시행규칙 별표 2가 정한 정당한 사유가 있으면 받을 수 있습니다. 사유마다 조건이 구체적으로 정해져 있으니 아래 기준과 내 상황을 맞춰 보세요.",
        "첫째, 다음 일이 이직 전 1년 안에 2개월 이상 있었던 경우입니다. 실제 근로조건이 채용 때 제시된 조건이나 그동안 적용받던 조건보다 낮아진 경우, 임금이 체불된 경우, 최저임금보다 적게 받은 경우, 근로기준법의 연장근로 한도를 넘겨 일한 경우, 휴업으로 평균임금의 70% 미만을 받은 경우가 여기에 해당합니다.",
        "둘째, 통근이 어려워진 경우입니다. 사업장 이전, 다른 지역으로의 전근, 배우자나 부양할 친족과 함께 살기 위한 이사 등으로 통상의 교통수단을 이용해 왕복 3시간 이상 걸리게 되면 인정됩니다. 셋째, 부모나 동거 친족이 아파 30일 이상 간호해야 하는데 휴가나 휴직이 허용되지 않은 경우, 임신·출산이나 8세 이하 또는 초등학교 2학년 이하 자녀의 육아, 병역 의무 이행 등으로 일하기 어려운데 휴가나 휴직이 허용되지 않은 경우도 해당합니다.",
        "넷째, 본인의 건강 문제로 업무를 하기 어렵고 업무 전환이나 휴직이 허용되지 않아 그만둔 사실이 의사 소견서 등으로 확인되는 경우, 성희롱·성폭력이나 직장 내 괴롭힘을 당한 경우, 종교·성별·장애·노조활동 등을 이유로 차별받은 경우, 회사의 도산·폐업이 확실하거나 대량 감원이 예정된 경우, 경영 악화 등으로 권고사직이나 희망퇴직에 응한 경우, 정년이나 계약기간 만료로 더 다닐 수 없게 된 경우도 인정됩니다. 이 밖에도 같은 상황이라면 다른 근로자도 그만두었을 것이라고 객관적으로 인정되는 경우가 포함됩니다.",
        "반대로 형법이나 직무 관련 법률을 어겨 금고 이상의 형을 받거나 정당한 사유 없이 오래 무단결근해 해고된 경우, 다른 회사로 옮기거나 자영업을 하려고 그만둔 경우에는 받을 수 없습니다(고용보험법 제58조). 정당한 사유는 고용센터가 개별 사정을 보고 판단하므로 급여명세서, 출퇴근 기록, 진단서, 회사와 주고받은 문서처럼 사실을 보여 줄 자료를 미리 챙기세요.",
      ],
    },
    {
      heading: "신청 기한과 달라지는 기준",
      body: [
        `구직급여는 이직 다음 날부터 12개월 안에서만 받을 수 있고, 실업을 신고한 날부터 ${WAIT}일은 대기 기간이라 지급되지 않습니다. 그래서 받을 수 있는 일수가 길수록 신청을 미룰 수 있는 여유가 줄어듭니다.`,
      ],
      table: {
        caption: "소정급여일수별로 신청을 미룰 수 있는 대략적인 여유",
        head: ["소정급여일수", `12개월(${YEAR}일) − 대기 ${WAIT}일 − 소정급여일수`],
        rows: dayOptions.map((dd) => [`${dd}일`, `약 ${YEAR - WAIT - dd}일`]),
        note: "실업인정일 일정이나 수급기간 연장 사유는 고려하지 않은 단순 계산입니다. 실제로는 이보다 여유 있게 신청하세요.",
      },
      after: [
        "65세 이후에 새로 고용된 사람은 구직급여 대상이 아닙니다(고용보험법 제10조제2항). 다만 65세 전부터 같은 회사에서 고용보험을 유지하다가 65세 이후에도 계속 일한 경우는 받을 수 있습니다.",
        `기준이 되는 최저임금은 이직일에 적용되던 금액입니다. 2027년 최저시급은 ${n(MIN_WAGE_2027)}원으로 고시되어, 2027년 1월 1일 이후 이직하는 하루 8시간 근로자의 하한액은 ${won(lower2027)}으로 계산됩니다. 이는 지금 상한액 ${won(RATES.unemployment.dailyMax)}보다 많은데, 고용보험법 제46조제2항에 따라 일액이 하한액보다 낮을 수는 없으므로 하한액이 지급됩니다. 상한액이 다시 조정되는지는 고용노동부 발표를 확인하세요.`,
        "2026년 3월 공포된 개정 고용보험법은 2028년 1월 1일 이후 이직하는 사람부터 기초일액을 정하는 규정(제45조제1항)을 바꾸도록 했습니다. 2027년 말까지 이직하는 사람은 지금 방식대로 계산합니다.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 - 고용보험법(제40조, 제45조, 제46조, 제50조, 제58조, 별표 1)", url: "https://www.law.go.kr/법령/고용보험법" },
    { label: "국가법령정보센터 - 고용보험법 시행령(제68조 기초일액 상한, 제84조·제85조 조기재취업 수당)", url: "https://www.law.go.kr/법령/고용보험법시행령" },
    { label: "국가법령정보센터 - 고용보험법 시행규칙(별표 2 정당한 이직 사유)", url: "https://www.law.go.kr/법령/고용보험법시행규칙" },
    { label: "고용노동부 자주 묻는 질문 - 실업급여의 지급기간 및 지급금액", url: "https://www.moel.go.kr/faq/faqView.do?seqRepeat=204" },
    { label: "최저임금위원회 - 연도별 최저임금 결정현황", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do" },
  ],
};

// ── 도구: 총액 범위 ────────────────────────────────────
const range = (period: InsuredPeriod, over50: boolean) => {
  const lo = run({ wages3m: 0, period, over50 });
  const hi = run({ wages3m: 1_000_000_000, period, over50 });
  return `${man(lo.total)} ~ ${man(hi.total)}`;
};
const shortest = run({ wages3m: 0, period: "lt1" });
const longest = run({ wages3m: 1_000_000_000, period: "10plus", over50: true });

// ── 도구: 시간별 하한액 ────────────────────────────────
const hoursRows = [3, 4, 5, 6, 7, 8].map((h) => ({ h, r: run({ wages3m: 0, dailyHours: h }) }));

// ── 도구: 3개월 일수 ───────────────────────────────────
const monthEnds = Array.from({ length: 12 }, (_, i) => {
  const next = `2026-${String(i + 2).padStart(2, "0")}-01`.replace("2026-13-01", "2027-01-01");
  const last = addDays(next, -1);
  const days = calcSeverance({ startDate: "2020-01-01", endDate: next, last3MonthsWage: 0, annualBonus: 0, annualLeavePay: 0 })!.periodDays;
  return { last, from: monthsBefore(next, 3), days };
});

export const unemploymentTool: ToolExtra = {
  updated: "2026-11-23",
  sections: [
    {
      heading: "가입 기간·나이별 예상 총액 범위",
      body: [
        `${RATES.year}년에 이직한 하루 8시간 근로자라면 구직급여 일액은 하한액 ${won(LOWER)}과 상한액 ${won(UPPER)} 사이에서 정해집니다. 그래서 총액은 월급보다 받을 수 있는 일수에 따라 크게 달라집니다. 가장 적게 받는 경우와 가장 많이 받는 경우를 계산하면 다음과 같습니다.`,
      ],
      table: {
        caption: "가입 기간·나이별 구직급여 총액 범위 (하루 8시간, 하한액~상한액)",
        head: ["고용보험 가입 기간", "50세 미만", "50세 이상·장애인"],
        rows: PERIODS.map((p) => [p.label, range(p.key, false), range(p.key, true)]),
        note: "만 원 단위 반올림. 실제 일액은 이직 전 임금에 따라 이 범위 안에서 정해집니다.",
      },
      after: [
        `가입 1년 미만 하한액 수급자는 ${man(shortest.total)}, 가입 10년 이상인 50세 이상 상한액 수급자는 ${man(longest.total)}으로 약 ${(longest.total / shortest.total).toFixed(1)}배 차이가 납니다. 그 차이는 대부분 일수(${shortest.days}일과 ${longest.days}일)에서 생깁니다.`,
      ],
    },
    {
      heading: "하루 소정근로시간별 하한액",
      body: [
        "하한액은 최저시급의 80%에 이직 전 하루 소정근로시간을 곱해 정하므로, 짧게 일한 사람은 하한액도 낮아집니다. 계산기의 '하루 소정근로시간' 칸을 바꾸면 이 값이 바뀝니다. 8시간을 넘게 넣어도 하한액은 8시간 기준에서 멈춥니다.",
      ],
      table: {
        caption: `하루 소정근로시간별 구직급여 하한액 (${RATES.year}년 최저시급 ${n(RATES.minimumWage)}원)`,
        head: ["하루 소정근로시간", "1일 하한액", "30일 기준"],
        rows: hoursRows.map(({ h, r }) => [`${h}시간`, won(r.lower), won(r.lower * 30)]),
        note: "하루 소정근로시간은 고용노동부령이 정한 방법으로 산정하며, 근무일마다 시간이 다르면 평균으로 계산합니다.",
      },
      after: [
        "평균임금의 60%가 하한액보다 많으면 60% 금액을 받습니다. 시급이 높은 단시간 근로자는 하한액이 아니라 평균임금 기준으로 정해질 수 있으니 3개월 임금을 함께 넣어 확인하세요.",
      ],
    },
    {
      heading: "3개월 일수 칸에 넣을 숫자",
      body: [
        "3개월 일수는 마지막 근무일부터 거꾸로 3개월의 달력 일수입니다. 2월이 끼면 89~90일, 31일이 있는 달이 많으면 92일이 됩니다. 달 말일까지 일하고 그만둔 경우를 정리했습니다.",
      ],
      table: {
        caption: "마지막 근무일(2026년 월말)별 3개월 산정 기간과 일수",
        head: ["마지막 근무일", "산정 기간", "일수"],
        rows: monthEnds.map((m) => [ko(m.last), `${koMD(m.from)} ~ ${koMD(m.last)}`, `${m.days}일`]),
        note: "월 중간에 그만두었다면 마지막 근무일 다음 날의 3개월 전 같은 날부터 마지막 근무일까지를 셉니다.",
      },
      after: [
        "월급이 대부분 기본급과 고정 수당이라면 1일 통상임금(월 통상임금 ÷ 209 × 8)이 1일 평균임금보다 클 수 있습니다. 고용보험법은 이때 통상임금을 기준으로 하도록 정하고 있습니다. 계산기의 '월 통상임금' 칸을 채우면 둘을 비교해 큰 쪽으로 구직급여 일액을 계산합니다.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 - 고용보험법(제45조, 제46조, 제50조, 별표 1)", url: "https://www.law.go.kr/법령/고용보험법" },
    { label: "국가법령정보센터 - 고용보험법 시행령(제68조 기초일액 상한)", url: "https://www.law.go.kr/법령/고용보험법시행령" },
    { label: "고용노동부 자주 묻는 질문 - 실업급여의 지급기간 및 지급금액", url: "https://www.moel.go.kr/faq/faqView.do?seqRepeat=204" },
  ],
};
