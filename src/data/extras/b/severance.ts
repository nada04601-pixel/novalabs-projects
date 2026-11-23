import { calcSeverance } from "@/lib/calculators/severance";
import { calcLeaveAllowance } from "@/lib/calculators/annualLeave";
import type { GuideExtra, ToolExtra } from "../types";
import { addDays, ko, man, n, pct, won } from "./fmt";

// 퇴직금 보강 글: 숫자는 모두 이 사이트의 퇴직금 계산기(calcSeverance)와 연차수당 계산기(calcLeaveAllowance) 식으로 계산합니다.

// 1일 통상임금 = 월 통상임금 ÷ 209 × 8 (근로기준법 시행령 제6조, 연차수당 계산기와 같은 식)
const dailyOrdinary = (monthly: number) => calcLeaveAllowance(monthly, 209, 8, 1).daily;

type Case = { start: string; end: string; wages3m: number; ordinaryMonthly: number; bonus?: number; leavePay?: number };

// 계산기에 월 통상임금 칸을 비웠을 때(평균임금만)와 채웠을 때(평균임금·통상임금 중 큰 쪽) 결과를 함께 구합니다.
function severance(c: Case) {
  const input = {
    startDate: c.start,
    endDate: c.end,
    last3MonthsWage: c.wages3m,
    annualBonus: c.bonus ?? 0,
    annualLeavePay: c.leavePay ?? 0,
  };
  const r = calcSeverance(input)!;
  const full = calcSeverance({ ...input, monthlyOrdinaryWage: c.ordinaryMonthly })!;
  return { ...r, ordinary: full.ordinaryDailyWage, usesOrdinary: full.usesOrdinary, base: full.dailyWage, legalPay: full.severancePay };
}

// ── 가이드: 통상임금과 비교 ─────────────────────────────
const END = "2026-10-01"; // 퇴직일(9월 30일까지 근무). 산정 기간 7월 1일~9월 30일 = 92일
const salaries = [2_500_000, 3_000_000, 4_000_000, 5_000_000];
const oneYear = salaries.map((m) => severance({ start: "2025-10-01", end: END, wages3m: m * 3, ordinaryMonthly: m }));
const periodDays = oneYear[0].periodDays;
// 3개월 동안 통상임금 밖의 돈이 3개월 통상임금의 몇 %를 넘어야 평균임금이 커지는지(92일 기준)
const breakEven = (dailyOrdinary(3_000_000) * periodDays) / (3_000_000 * 3) - 1;
const shortfall = 1 - oneYear[1].averageDailyWage / oneYear[1].ordinary;

// ── 가이드: 근속·월급별 표 ─────────────────────────────
const years = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const byYears = years.map((y) =>
  salaries.map((m) => severance({ start: `${2026 - y}-10-01`, end: END, wages3m: m * 3, ordinaryMonthly: m })),
);

// ── 가이드: 한 사람 예시 ───────────────────────────────
const ex = {
  start: "2021-07-05",
  lastDay: "2026-11-30",
  ordinaryMonthly: 3_000_000, // 기본급 280만 원 + 직무수당 20만 원
  basic: 2_800_000,
  duty: 200_000,
  overtime: [700_000, 600_000, 800_000], // 9·10·11월 연장근로수당
  unusedLastYear: 5, // 2026년 1월에 수당으로 받은 지난해 미사용 연차
};
const exOvertime = ex.overtime.reduce((a, b) => a + b, 0);
const exWages3m = ex.ordinaryMonthly * 3 + exOvertime;
const exLeavePay = Math.round(calcLeaveAllowance(ex.ordinaryMonthly, 209, 8, ex.unusedLastYear).allowance);
const exR = severance({ start: ex.start, end: addDays(ex.lastDay, 1), wages3m: exWages3m, ordinaryMonthly: ex.ordinaryMonthly, leavePay: exLeavePay });
// 연장근로수당이 이 금액보다 적었다면 통상임금으로 계산하게 됩니다.
const exOvertimeBreakEven = exR.ordinary * exR.periodDays - ex.ordinaryMonthly * 3 - (exLeavePay * 3) / 12;

export const severanceGuide: GuideExtra = {
  updated: "2026-11-23",
  mode: "append",
  sections: [
    {
      heading: "평균임금과 통상임금 중 큰 쪽으로 계산합니다",
      body: [
        "근로기준법은 3개월 임금으로 구한 평균임금이 그 사람의 통상임금보다 적으면 통상임금을 평균임금으로 보도록 정하고 있습니다(제2조제2항). 이때 비교하는 1일 통상임금은 시급에 하루 소정근로시간을 곱한 금액이라, 월급제라면 '월 통상임금 ÷ 209 × 8'로 구합니다(근로기준법 시행령 제6조).",
        "두 숫자는 나누는 기준이 다릅니다. 평균임금은 3개월 임금을 쉬는 날까지 포함한 달력 일수(89~92일)로 나누고, 통상임금은 일하는 날 하루 8시간을 기준으로 합니다. 그래서 기본급과 고정 수당만 받는 사람은 1일 통상임금이 더 큰 경우가 많습니다. 아래 표는 월급 전부가 통상임금이고 다른 수당·상여금이 없는 사람이 1년 일하고 퇴직한 경우입니다.",
      ],
      table: {
        caption: `월급만 받는 사람의 1년 근속 퇴직금 (퇴직일 ${ko(END)}, 산정 기간 ${periodDays}일)`,
        head: ["월급(전액 통상임금)", "1일 평균임금", "1일 통상임금", "평균임금으로만 계산", "큰 쪽으로 계산"],
        rows: oneYear.map((r, i) => [man(salaries[i]), won(r.averageDailyWage), won(r.ordinary), won(r.severancePay), won(r.legalPay)]),
        note: "1일 통상임금 = 월급 ÷ 209 × 8. 퇴직금 = 1일 금액 × 30 × 재직일수 ÷ 365, 원 미만 버림. 세전 금액입니다.",
      },
      after: [
        `${periodDays}일 기준으로 보면, 3개월 동안 통상임금 밖에서 받은 돈(연장근로수당, 직전 1년 상여금·연차수당의 3/12 가산분 등)이 3개월 통상임금 합계의 약 ${pct(breakEven)}를 넘어야 평균임금 쪽이 커집니다. 그보다 적으면 통상임금으로 계산한 금액이 법에서 정한 최소 퇴직금입니다.`,
        `이 사이트의 퇴직금 계산기는 '월 통상임금' 칸을 채우면 1일 평균임금과 1일 통상임금을 비교해 큰 쪽으로 계산합니다. 칸을 비워 두면 평균임금만으로 계산하므로, 위 표처럼 월급만 받는 사람은 법정 금액보다 약 ${pct(shortfall, 0)} 적게 나옵니다. 정기 상여금이 통상임금에 들어가는 회사라면 월 통상임금에 상여금의 12분의 1을 더해 넣으세요.`,
      ],
    },
    {
      heading: "근속연수와 월급별 퇴직금 표",
      body: [
        `퇴직일을 ${ko(END)}(9월 30일까지 근무)로 고정하고 입사일을 1년씩 앞당겨 계산했습니다. 매달 같은 월급(세전)을 받고 상여금·연장근로수당·연차수당은 없다고 가정했으므로, 앞의 설명대로 모든 칸이 통상임금 기준입니다.`,
      ],
      table: {
        caption: "근속연수·월급별 법정 퇴직금 (월급 전액이 통상임금인 경우)",
        head: ["근속", ...salaries.map((m) => `월 ${man(m)}`)],
        rows: byYears.map((row, i) => [`${years[i]}년 (${n(row[0].serviceDays)}일)`, ...row.map((r) => man(r.legalPay))]),
        note: "만 원 단위 반올림. 재직일수에 2월 29일이 들어가면 같은 근속연수라도 하루가 늘어 금액이 조금 커집니다.",
      },
      after: [
        `퇴직금은 재직일수에 정비례합니다. 월 ${man(salaries[1])}을 받는 사람의 1년 치가 ${man(byYears[0][1].legalPay)}이고 10년 치가 ${man(byYears[9][1].legalPay)}인 것처럼, 1년 치 금액을 알면 근속연수를 곱해 대략 가늠할 수 있습니다.`,
        "중요한 것은 기준이 되는 임금이 '퇴직 직전'의 임금이라는 점입니다. 퇴직금제도와 확정급여형(DB) 퇴직연금은 마지막 임금 수준이 지난 근속 전체에 적용되므로, 근속이 길수록 퇴직 직전 임금의 차이가 퇴직금에 크게 반영됩니다. 확정기여형(DC)은 해마다 적립된 금액과 운용 결과로 정해져 이 표와 다릅니다.",
      ],
    },
    {
      heading: "연장근로수당이 있는 직원의 퇴직금 따라 계산하기",
      body: [
        `${ko(ex.start)}에 입사해 ${ko(ex.lastDay)}까지 일하고 그만두는 직원을 예로 들겠습니다. 퇴직일은 마지막 근무일의 다음 날인 ${ko(addDays(ex.lastDay, 1))}입니다. 월급은 기본급 ${man(ex.basic)}과 매달 고정으로 받는 직무수당 ${man(ex.duty)}을 더한 ${man(ex.ordinaryMonthly)}이고, 퇴직 전 3개월 동안 연장근로수당을 ${ex.overtime.map((v) => man(v)).join(", ")}씩 받았습니다. 상여금은 없고, 올해 1월에 지난해 쓰지 못한 연차 ${ex.unusedLastYear}일분의 수당 ${won(exLeavePay)}을 받았습니다.`,
      ],
      table: {
        caption: "단계별 계산",
        head: ["단계", "계산", "결과"],
        rows: [
          ["① 재직일수", `${ko(ex.start)} ~ ${ko(ex.lastDay)}`, `${n(exR.serviceDays)}일`],
          ["② 3개월 임금 총액", `${man(ex.ordinaryMonthly)} × 3 + 연장근로수당 ${man(exOvertime)}`, won(exWages3m)],
          ["③ 연차수당 가산분", `${won(exLeavePay)} × 3/12`, won((exLeavePay * 3) / 12)],
          ["④ 1일 평균임금", `(② + ③) ÷ ${exR.periodDays}일`, won(exR.averageDailyWage)],
          ["⑤ 1일 통상임금", `${man(ex.ordinaryMonthly)} ÷ 209 × 8`, won(exR.ordinary)],
          ["⑥ 적용할 1일 금액", exR.usesOrdinary ? "통상임금이 더 커서 ⑤를 씀" : "평균임금이 더 커서 ④를 씀", won(exR.base)],
          ["⑦ 퇴직금", `⑥ × 30 × ${n(exR.serviceDays)} ÷ 365`, won(exR.legalPay)],
        ],
        note: "산정 기간은 9월 1일~11월 30일(달력 일수). 금액은 원 단위 반올림, 퇴직금은 원 미만 버림. 세전 금액입니다.",
      },
      after: [
        exR.usesOrdinary
          ? `이 경우는 통상임금이 더 커서, 퇴직금 계산기에서 월 통상임금 칸을 비우고 계산한 결과(${won(exR.severancePay)})보다 많이 받습니다. 칸을 채우면 계산기도 ⑦과 같은 금액을 보여 줍니다.`
          : `이 경우는 평균임금이 더 커서 퇴직금 계산기에 같은 값을 넣으면 같은 금액(${won(exR.severancePay)})이 나옵니다. 다만 3개월 연장근로수당이 약 ${man(exOvertimeBreakEven)}보다 적었다면 1일 평균임금이 통상임금 아래로 내려가 ⑤의 통상임금으로 계산해야 합니다.`,
        "③에는 퇴직 전 1년 안에 이미 받은 연차수당만 넣었습니다. 퇴직하면서 처음 지급 사유가 생기는 올해 남은 연차의 수당은 퇴직 전에 지급된 임금이 아니어서 평균임금에 넣지 않는 것이 일반적인 실무 해석입니다. 그 수당은 퇴직금과 별도로 마지막 급여와 함께 받습니다.",
      ],
    },
    {
      heading: "평균임금에서 빼는 기간과 그 밖의 예외",
      body: [
        "퇴직 전 3개월 안에 아래 기간이 끼어 있으면 그 일수와 그동안 받은 임금을 함께 빼고 나머지로 평균임금을 구합니다(근로기준법 시행령 제2조). 수습을 시작한 날부터 3개월 이내의 기간, 회사 사정으로 쉰 휴업 기간, 출산전후휴가와 유산·사산 휴가, 업무상 부상·질병으로 요양한 기간, 육아휴직, 쟁의행위 기간, 병역·예비군·민방위 의무로 쉰 기간(그동안 임금을 받았다면 제외), 업무 외 부상·질병 등으로 회사 승인을 받아 쉰 기간입니다.",
        "예를 들어 9월 한 달을 육아휴직으로 쉬었다면 9월의 일수와 임금을 빼고 10월·11월 두 달만으로 1일 평균임금을 계산합니다. 계산기는 이 조정을 하지 않으므로, 회사에서 받은 산정 내역과 비교할 때는 빼야 할 기간을 먼저 확인하세요.",
        "주택 구입 같은 법정 사유로 퇴직금을 중간정산 받았다면, 그 뒤의 재직기간은 정산 시점부터 다시 셉니다(근로자퇴직급여 보장법 제8조제2항). 이때 계산기의 입사일 칸에는 실제 입사일이 아니라 중간정산 기준일을 넣어야 합니다.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 - 근로자퇴직급여 보장법(제4조, 제8조, 제9조, 제10조)", url: "https://www.law.go.kr/법령/근로자퇴직급여보장법" },
    { label: "국가법령정보센터 - 근로기준법(제2조 평균임금)", url: "https://www.law.go.kr/법령/근로기준법" },
    { label: "국가법령정보센터 - 근로기준법 시행령(제2조 평균임금 제외 기간, 제6조 통상임금)", url: "https://www.law.go.kr/법령/근로기준법시행령" },
    { label: "고용노동부 자주 묻는 질문 - 퇴직금 및 평균임금 산정공식", url: "https://www.moel.go.kr/faq/faqView.do?seqRepeat=89" },
  ],
};

// ── 도구: 통상임금 비교 사례 ───────────────────────────
const TOOL_START = "2021-10-01"; // 5년 근속
const toolCases = [
  { label: "고정 월급 280만 원", wages3m: 2_800_000 * 3, ordinaryMonthly: 2_800_000, note: "수당 없음" },
  { label: "기본급 250만 원 + 연장근로 많음", wages3m: 2_500_000 * 3 + 1_800_000, ordinaryMonthly: 2_500_000, note: "3개월 연장근로수당 180만 원" },
  { label: "고정 월급 450만 원 + 연장근로 조금", wages3m: 4_500_000 * 3 + 300_000, ordinaryMonthly: 4_500_000, note: "3개월 연장근로수당 30만 원" },
].map((c) => ({ ...c, r: severance({ start: TOOL_START, end: END, wages3m: c.wages3m, ordinaryMonthly: c.ordinaryMonthly }) }));
const firstOrdinary = toolCases[0].r;

// ── 도구: 1년 확인 ─────────────────────────────────────
const yearChecks = [
  { start: "2025-10-01", end: "2026-10-01" },
  { start: "2025-10-02", end: "2026-10-01" },
  { start: "2023-03-02", end: "2024-03-01" },
  { start: "2023-03-02", end: "2024-03-02" },
].map((c) => {
  const r = calcSeverance({ startDate: c.start, endDate: c.end, last3MonthsWage: 0, annualBonus: 0, annualLeavePay: 0 })!;
  const [y, m, d] = c.start.split("-");
  const anniversary = `${Number(y) + 1}-${m}-${d}`; // 입사일 1년 뒤 같은 날. 퇴직일이 이날 이후여야 달력상 1년을 채움
  return { ...c, r, fullYear: c.end >= anniversary };
});
const leapCase = yearChecks[2];

export const severanceTool: ToolExtra = {
  updated: "2026-11-23",
  sections: [
    {
      heading: "월 통상임금 칸은 언제 채워야 하나",
      body: [
        "법정 퇴직금은 1일 평균임금과 1일 통상임금 가운데 큰 쪽으로 계산합니다(근로기준법 제2조제2항). 이 계산기는 '월 통상임금' 칸을 채우면 1일 통상임금(월 통상임금 ÷ 209 × 8)을 구해 평균임금과 비교하고, 더 큰 쪽으로 퇴직금을 계산합니다. 칸을 비워 두면 평균임금만으로 계산합니다. 아래는 퇴직일 2026년 10월 1일, 근속 5년인 세 사람을 비교한 예입니다.",
      ],
      table: {
        caption: `근속 5년(${n(firstOrdinary.serviceDays)}일), 산정 기간 ${firstOrdinary.periodDays}일 기준 비교`,
        head: ["사례", "1일 평균임금", "1일 통상임금", "통상임금 칸을 비웠을 때", "통상임금 칸을 채웠을 때"],
        rows: toolCases.map((c) => [
          `${c.label} (${c.note})`,
          won(c.r.averageDailyWage),
          won(c.r.ordinary),
          won(c.r.severancePay),
          `${won(c.r.legalPay)} (${c.r.usesOrdinary ? "통상임금" : "평균임금"})`,
        ]),
        note: "상여금·연차수당은 없다고 가정했습니다. 원 단위 반올림, 퇴직금은 원 미만 버림.",
      },
      after: [
        `월 통상임금 칸에는 기본급과 매달 정해진 금액으로 받는 고정 수당의 합계를 넣습니다. 첫 번째 사례처럼 고정 월급만 받는 사람은 칸을 채우면 1일 금액이 ${won(firstOrdinary.averageDailyWage)}에서 ${won(firstOrdinary.ordinary)}으로 올라갑니다. 반대로 연장근로수당처럼 매달 달라지는 돈이 많을수록 평균임금 쪽이 커져, 칸을 채워도 결과가 그대로입니다.`,
      ],
    },
    {
      heading: "재직 1년을 채웠는지 날짜로 확인하기",
      body: [
        "법에서 말하는 계속근로 1년은 달력상 1년입니다. 그래서 2월 29일이 끼는 해에는 재직일수 365일을 채워도 하루가 모자랄 수 있습니다. 이 계산기는 재직일수가 아니라 입사일 다음 해 같은 날이 지났는지로 퇴직금 대상을 표시합니다. 퇴직일은 마지막 근무일의 다음 날입니다.",
      ],
      table: {
        caption: "입사일·퇴직일별 재직일수와 1년 충족 여부",
        head: ["입사일", "마지막 근무일", "재직일수", "계산기 표시", "달력상 1년"],
        rows: yearChecks.map((c) => [
          ko(c.start),
          ko(addDays(c.end, -1)),
          `${n(c.r.serviceDays)}일`,
          c.r.eligible ? "대상" : "대상 아님",
          c.fullYear ? "채움" : "하루 이상 모자람",
        ]),
        note: "근로관계는 입사일 0시부터 시작하므로 입사일을 첫날로 셉니다.",
      },
      after: [
        `세 번째 줄처럼 ${ko(leapCase.start)} 입사자가 ${ko(addDays(leapCase.end, -1))}까지 일하면 재직일수는 ${n(leapCase.r.serviceDays)}일이지만 달력상 1년에는 하루가 모자랍니다. 1년 경계에 걸려 있다면 날짜를 달력으로 다시 확인하고, 회사와 퇴사일을 정할 때 이 하루를 놓치지 마세요.`,
      ],
    },
    {
      heading: "계산기에 넣기 전에 모을 자료",
      body: [
        "정확한 결과를 보려면 다음 숫자를 먼저 모아 두세요. 첫째, 퇴직 전 3개월 동안의 급여명세서입니다. 기본급과 고정 수당, 연장·야간·휴일근로수당, 식대처럼 매달 정기적으로 받은 수당을 세전 금액으로 더합니다. 둘째, 퇴직 전 1년 동안 받은 상여금 합계입니다. 명절 상여처럼 정해진 상여는 넣고, 실적에 따라 지급 여부가 달라지는 성과급은 회사마다 판단이 다르므로 회사 산정 내역과 비교합니다.",
        "셋째, 퇴직 전 1년 안에 이미 받은 연차수당입니다. 퇴직하면서 정산받는 올해 남은 연차의 수당은 넣지 않습니다. 넷째, 월 통상임금입니다. 앞의 비교를 하려면 기본급과 매달 고정으로 주는 수당의 합계를 알아야 합니다. 마지막으로 퇴직 전 3개월 안에 육아휴직·업무상 요양처럼 평균임금에서 빼야 하는 기간이 있었는지 확인합니다. 이런 기간이 있으면 계산기 결과보다 실제 퇴직금이 많을 수 있습니다.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 - 근로자퇴직급여 보장법(제4조, 제8조)", url: "https://www.law.go.kr/법령/근로자퇴직급여보장법" },
    { label: "국가법령정보센터 - 근로기준법(제2조제2항)", url: "https://www.law.go.kr/법령/근로기준법" },
    { label: "국가법령정보센터 - 근로기준법 시행령(제6조 통상임금)", url: "https://www.law.go.kr/법령/근로기준법시행령" },
    { label: "고용노동부 자주 묻는 질문 - 퇴직금 및 평균임금 산정공식", url: "https://www.moel.go.kr/faq/faqView.do?seqRepeat=89" },
  ],
};
