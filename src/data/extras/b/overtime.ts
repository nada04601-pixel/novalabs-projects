import { RATES } from "@/data/rates/2026";
import { calcOvertime, type OvertimeInput } from "@/lib/calculators/overtime";
import { calcLeaveAllowance } from "@/lib/calculators/annualLeave";
import type { GuideExtra, ToolExtra } from "../types";
import { man, n, won } from "./fmt";

// 연장·야간·휴일수당 보강 글: 금액은 모두 수당 계산기(calcOvertime) 식으로 계산합니다.

type Hours = Partial<Omit<OvertimeInput, "hourlyWage" | "fiveOrMore">>;
const run = (wage: number, h: Hours, fiveOrMore = true) =>
  calcOvertime({ hourlyWage: wage, overtimeHours: 0, nightHours: 0, holidayHours: 0, holidayOverHours: 0, fiveOrMore, ...h });
// 월 통상임금 ÷ 209 = 통상시급 (연차수당 계산기와 같은 식)
const hourlyOf = (monthly: number) => calcLeaveAllowance(monthly, 209, 8, 1).hourly;
const times = (total: number, wage: number) => `${(total / wage).toFixed(1)}배`;

// ── 가이드: 겹칠 때 배율표 ─────────────────────────────
const W_MIN = RATES.minimumWage;
const M300 = 3_000_000;
const W_300 = hourlyOf(M300);
const combos: { label: string; h: Hours; five?: boolean }[] = [
  { label: "평일 연장근로", h: { overtimeHours: 1 } },
  { label: "소정근로 시간 안의 야간근로(가산분만)", h: { nightHours: 1 } },
  { label: "평일 연장근로 + 야간", h: { overtimeHours: 1, nightHours: 1 } },
  { label: "휴일근로 8시간 이내", h: { holidayHours: 1 } },
  { label: "휴일근로 8시간 이내 + 야간", h: { holidayHours: 1, nightHours: 1 } },
  { label: "휴일근로 8시간 초과분", h: { holidayOverHours: 1 } },
  { label: "휴일근로 8시간 초과분 + 야간", h: { holidayOverHours: 1, nightHours: 1 } },
  { label: "5인 미만 사업장의 연장·휴일근로", h: { overtimeHours: 1 }, five: false },
];

// ── 가이드: 공휴일 근무 ────────────────────────────────
const HOLIDAY_HOURS = 8;
const paidHolidayHourly = W_MIN * HOLIDAY_HOURS; // 시급제: 쉬어도 받는 유급휴일분
const holidayWorkHourly = run(W_MIN, { holidayHours: HOLIDAY_HOURS }).total;
const holidayWorkMonthly = run(W_300, { holidayHours: HOLIDAY_HOURS }).total;

// ── 가이드: 한 주 예시 ─────────────────────────────────
const EX_BASIC = 2_700_000;
const EX_DUTY = 200_000;
const EX_MONTHLY = EX_BASIC + EX_DUTY;
const EX_W = hourlyOf(EX_MONTHLY);
const EX_H: Hours = { overtimeHours: 8, nightHours: 1, holidayHours: 4 };
const ex5 = run(EX_W, EX_H);
const ex4 = run(EX_W, EX_H, false);
// 같은 주에 월요일 연차를 쓴 경우: 수요일 4시간만 연장(하루 8시간 초과), 토요일 4시간은 주 40시간 안
const exLeave = run(EX_W, { overtimeHours: 4, nightHours: 1, holidayHours: 4 });

export const overtimeGuide: GuideExtra = {
  updated: "2026-11-23",
  mode: "append",
  sections: [
    {
      heading: "가산이 겹칠 때 1시간에 받는 금액",
      body: [
        `연장·야간·휴일 가산은 조건이 겹치면 각각 더해집니다. 아래 표는 그 1시간에 받는 금액이 통상시급의 몇 배인지와 실제 금액을, ${RATES.year}년 최저시급과 월 통상임금 ${man(M300)}(통상시급 ${won(W_300)}) 두 경우로 계산한 것입니다.`,
      ],
      table: {
        caption: "근무 상황별 1시간 수당 (상시 5인 이상 사업장)",
        head: ["근무 상황", "통상시급 대비", `최저시급 ${n(W_MIN)}원 기준`, `월 ${man(M300)} 기준`],
        rows: combos.map((c) => {
          const a = run(W_MIN, c.h, c.five ?? true).total;
          const b = run(W_300, c.h, c.five ?? true).total;
          return [c.label, times(a, W_MIN), won(a), won(b)];
        }),
        note: "통상시급 = 월 통상임금 ÷ 209. 소정근로 시간 안의 야간근로는 일한 시간분이 월급·시급에 이미 들어 있어 가산분만 적었습니다. 원 단위 반올림.",
      },
      after: [
        `가장 높은 배율은 휴일에 8시간을 넘겨 밤까지 일한 시간으로, 통상시급의 ${times(run(W_MIN, { holidayOverHours: 1, nightHours: 1 }).total, W_MIN)}입니다. 반대로 5인 미만 사업장에서는 가산 의무가 없어 어떤 경우든 일한 시간만큼만 받습니다. 휴일근로는 주 40시간을 넘더라도 연장근로 가산을 따로 더하지 않고 휴일근로 가산만 붙습니다(근로기준법 제56조제2항).`,
      ],
    },
    {
      heading: "공휴일에 일할 때 시급제와 월급제의 차이",
      body: [
        "상시 5인 이상 사업장에서는 관공서 공휴일과 대체공휴일이 유급휴일입니다(근로기준법 제55조제2항). 5월 1일은 「노동절 제정에 관한 법률」이 정한 유급휴일로, 2025년 11월 법 개정 전에는 '근로자의 날'이라고 불렀습니다. 유급휴일에 일하면 받는 금액은 임금을 시급으로 받는지 월급으로 받는지에 따라 계산 방법이 다릅니다.",
        `시급제 근로자는 원래 일하는 날이 공휴일이 되면 쉬어도 하루치 임금(유급휴일분)을 받습니다. 그날 ${HOLIDAY_HOURS}시간을 일하면 유급휴일분 ${won(paidHolidayHourly)}에 휴일근로 임금과 가산분 ${won(holidayWorkHourly)}이 더해져 모두 ${won(paidHolidayHourly + holidayWorkHourly)}, 즉 시급의 ${times(paidHolidayHourly + holidayWorkHourly, W_MIN * HOLIDAY_HOURS)}를 받습니다(${RATES.year}년 최저시급 기준).`,
        `월급제 근로자는 유급휴일분이 이미 월급에 들어 있으므로, 공휴일에 ${HOLIDAY_HOURS}시간을 일하면 휴일근로 임금과 가산분만 더 받습니다. 월 통상임금 ${man(M300)}이라면 ${won(holidayWorkMonthly)}입니다. 같은 ${times(holidayWorkMonthly, W_300 * HOLIDAY_HOURS)}라도 시급제는 쉬어도 받는 하루치가 따로 있어 총액이 ${times(paidHolidayHourly + holidayWorkHourly, W_MIN * HOLIDAY_HOURS)}로 보이는 것입니다. 5인 미만 사업장은 공휴일 유급휴일 규정과 가산 규정이 적용되지 않으므로 공휴일에 일해도 일한 시간분만 받습니다.`,
      ],
    },
    {
      heading: "한 주 근무로 따라 해 보는 수당 계산",
      body: [
        `월 통상임금이 기본급 ${man(EX_BASIC)}과 직무수당 ${man(EX_DUTY)}을 더한 ${man(EX_MONTHLY)}인 월급제 직원의 한 주를 예로 들겠습니다. 통상시급은 ${man(EX_MONTHLY)} ÷ 209 = ${won(EX_W)}입니다. 월요일부터 금요일까지 오전 9시~오후 6시(점심 1시간 제외 8시간)를 일했고, 여기에 다음 근무가 더해졌습니다.`,
        "수요일에는 저녁 7시부터 밤 11시까지 4시간을 더 일했고, 그중 밤 10~11시의 1시간은 야간근로입니다. 무급 휴무일인 토요일에는 오전 10시~오후 2시 4시간을 일했습니다. 이미 주 40시간을 채웠으므로 이 4시간도 연장근로입니다. 주휴일인 일요일에는 오후 1~5시 4시간을 일해 휴일근로가 됩니다. 이 주에 일한 시간은 모두 52시간으로, 휴일근로까지 포함해 1주 한도 안입니다.",
      ],
      table: {
        caption: `통상시급 ${won(EX_W)}, 연장 8시간·야간 1시간·휴일 4시간`,
        head: ["항목", "계산", "5인 이상", "5인 미만"],
        rows: [
          ["연장근로 일한 시간분", "8시간 × 통상시급", won(ex5.overtimeBase), won(ex4.overtimeBase)],
          ["연장근로 가산분", "8시간 × 통상시급 × 50%", won(ex5.overtimePremium), won(ex4.overtimePremium)],
          ["야간 가산분", "1시간 × 통상시급 × 50%", won(ex5.nightPremium), won(ex4.nightPremium)],
          ["휴일근로 일한 시간분", "4시간 × 통상시급", won(ex5.holidayBase), won(ex4.holidayBase)],
          ["휴일근로 가산분", "4시간 × 통상시급 × 50%", won(ex5.holidayPremium), won(ex4.holidayPremium)],
          ["합계", "이 주에 월급 외로 더 받을 금액", won(ex5.total), won(ex4.total)],
        ],
        note: "원 단위 반올림. 5인 미만 사업장도 일한 시간분은 줘야 합니다.",
      },
      after: [
        `같은 주에 월요일 하루 연차를 썼다면 결과가 달라집니다. 고용노동부는 연장근로를 실제로 일한 시간으로 판단하므로, 그 주의 실제 근로시간은 토요일까지 40시간이 되어 토요일 4시간은 연장근로가 아닙니다. 수요일 4시간은 하루 8시간을 넘었으므로 그대로 연장근로입니다. 이렇게 계산하면 5인 이상 사업장 기준 합계는 ${won(exLeave.total)}으로, 연차를 쓰지 않은 주보다 ${won(ex5.total - exLeave.total)} 적습니다. 다만 토요일 4시간분의 임금(일한 시간분)은 연장근로가 아니어도 받아야 합니다.`,
      ],
    },
    {
      heading: "연장·휴일근로 시간을 셀 때 헷갈리는 부분",
      body: [
        "근로시간에는 휴게시간이 들어가지 않습니다. 근로기준법은 4시간에 30분 이상, 8시간에 1시간 이상의 휴게를 주도록 정하고 있어, 오전 9시부터 오후 6시까지 일하고 점심시간이 1시간이면 근로시간은 8시간입니다. 휴게시간이라도 실제로는 대기하며 일했다면 근로시간으로 다툴 수 있으니 기록을 남겨 두세요.",
        "토요일은 대부분의 회사에서 '휴일'이 아니라 일하지 않기로 한 '휴무일'입니다. 그래서 토요일 근무는 휴일근로 가산이 아니라, 주 40시간을 넘은 부분만 연장근로 가산을 받습니다. 취업규칙이나 근로계약에서 토요일을 유급 또는 무급 휴일로 정해 두었다면 휴일근로로 계산합니다.",
        "1주는 휴일을 포함한 7일이라 휴일에 일한 시간도 1주 최대 52시간(법정 40시간 + 연장 12시간)을 따질 때 함께 셉니다(근로기준법 제2조·제53조). 평일에 이미 12시간을 연장한 주에 일요일까지 일하면 한도를 넘게 됩니다. 한도를 넘었더라도 이미 일한 시간의 임금과 가산수당은 받아야 합니다.",
        "아파트 경비원처럼 감시·단속적 업무로 고용노동부 승인을 받은 근로자는 근로시간·휴일 규정이 적용되지 않아 연장·휴일 가산을 받지 않습니다(근로기준법 제63조). 다만 오후 10시~오전 6시 야간근로 가산 50%는 그대로 받습니다.",
        "상시 4명 이하 사업장에는 근로기준법 중 휴게(제54조), 주휴일(제55조제1항) 등 일부 규정만 적용됩니다(근로기준법 시행령 별표 1). 주 40시간, 연장근로 한도, 공휴일 유급휴일, 가산수당, 연차휴가 규정은 적용되지 않으므로 5인 미만인지는 수당 계산의 출발점입니다.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 - 근로기준법(제2조, 제55조, 제56조, 제63조)", url: "https://www.law.go.kr/법령/근로기준법" },
    { label: "국가법령정보센터 - 근로기준법 시행령(별표 1 상시 4명 이하 사업장 적용 규정)", url: "https://www.law.go.kr/법령/근로기준법시행령" },
    { label: "국가법령정보센터 - 노동절 제정에 관한 법률", url: "https://www.law.go.kr/법령/노동절%20제정에%20관한%20법률" },
    { label: "최저임금위원회 - 연도별 최저임금 결정현황", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do" },
  ],
};

// ── 도구: 월급별 통상시급표 ────────────────────────────
const monthlyRows = [RATES.minimumWage * 209, 2_500_000, 3_000_000, 3_500_000, 4_000_000];

// ── 도구: 상황별 입력 예시 ─────────────────────────────
const T_W = 12_000;
const scenarios: { label: string; input: string; h: Hours }[] = [
  { label: "평일 5일 동안 매일 2시간씩 연장", input: "연장 10", h: { overtimeHours: 10 } },
  { label: "오후 6시~밤 12시 연장 6시간", input: "연장 6, 야간 2", h: { overtimeHours: 6, nightHours: 2 } },
  { label: "밤 10시~아침 6시 고정 근무 5일(소정근로)", input: "야간 40", h: { nightHours: 40 } },
  { label: "일요일(주휴일) 10시간 근무", input: "휴일 8, 휴일 초과 2", h: { holidayHours: 8, holidayOverHours: 2 } },
];

export const overtimeTool: ToolExtra = {
  updated: "2026-11-23",
  sections: [
    {
      heading: "월급별 통상시급과 1시간 수당표",
      body: [
        "월급제라면 먼저 월 통상임금을 209시간으로 나눠 통상시급을 구해 계산기에 넣습니다. 월 통상임금에는 기본급과 매달 고정으로 받는 수당을 넣고, 실제 연장근로를 해야 받는 수당이나 실적에 따라 달라지는 돈은 뺍니다. 자주 쓰는 월급 구간을 미리 계산해 두었습니다.",
      ],
      table: {
        caption: "월 통상임금별 통상시급과 1시간 수당 (상시 5인 이상)",
        head: ["월 통상임금", "통상시급", "연장 1시간", "연장+야간 1시간", "휴일 8시간 초과 1시간"],
        rows: monthlyRows.map((m, i) => {
          const w = hourlyOf(m);
          return [
            i === 0 ? `${won(m)}(최저임금)` : man(m),
            won(w),
            won(run(w, { overtimeHours: 1 }).total),
            won(run(w, { overtimeHours: 1, nightHours: 1 }).total),
            won(run(w, { holidayOverHours: 1 }).total),
          ];
        }),
        note: `첫 줄은 ${RATES.year}년 최저시급 ${n(RATES.minimumWage)}원 × 209시간입니다. 원 단위 반올림.`,
      },
    },
    {
      heading: "상황별 입력 예시",
      body: [
        `통상시급 ${n(T_W)}원인 사람이 흔히 겪는 네 가지 상황을 계산기 칸에 어떻게 나눠 넣는지와 그 결과입니다. 야간근로 칸에는 다른 근로와 겹치더라도 오후 10시~오전 6시에 일한 시간을 그대로 넣습니다.`,
      ],
      table: {
        caption: `통상시급 ${n(T_W)}원 기준 입력과 결과`,
        head: ["상황", "입력(시간)", "5인 이상 결과", "5인 미만 결과"],
        rows: scenarios.map((s) => [s.label, s.input, won(run(T_W, s.h).total), won(run(T_W, s.h, false).total)]),
        note: "결과는 그 근무로 월급·기본 시급 외에 더 받을 금액(세전)입니다.",
      },
      after: [
        "세 번째 줄처럼 밤 근무가 원래 정해진 근무시간이면 일한 시간분은 이미 월급에 들어 있어 야간 가산분만 더 받습니다. 그래서 5인 미만 사업장에서는 결과가 0원이 됩니다. 네 번째 줄은 휴일 하루에 10시간을 일한 경우로, 8시간까지와 8시간을 넘는 2시간을 나눠 넣어야 100% 가산이 제대로 반영됩니다.",
      ],
    },
    {
      heading: "결과를 볼 때 확인할 점",
      body: [
        "계산기는 입력한 시간을 그대로 계산할 뿐, 주 52시간 한도를 넘었는지나 그 주가 실제로 40시간을 넘었는지는 판단하지 않습니다. 연차나 결근이 있는 주라면 실제로 일한 시간이 40시간을 넘은 부분과 하루 8시간을 넘은 부분만 연장근로 칸에 넣으세요.",
        "휴일근로 시간은 연장근로 칸에 다시 넣지 않습니다. 휴일근로는 주 40시간을 넘더라도 휴일 가산만 붙기 때문에, 같은 시간을 두 칸에 넣으면 수당이 실제보다 크게 나옵니다. 휴일 하루에 8시간을 넘게 일했다면 8시간까지는 '8시간 이내분', 나머지는 '8시간 초과분'에 나눠 넣습니다.",
        "결과는 세전 금액이며, 실제 급여명세서에서는 소득세와 4대보험료가 함께 계산됩니다. 고정 연장근로수당을 받는다면 이 계산기로 실제 근무 시간에 대한 금액을 구해 약정 금액보다 많은지 비교해 보세요.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 - 근로기준법(제56조 연장·야간 및 휴일 근로)", url: "https://www.law.go.kr/법령/근로기준법" },
    { label: "국가법령정보센터 - 근로기준법 시행령(제6조 통상임금)", url: "https://www.law.go.kr/법령/근로기준법시행령" },
    { label: "최저임금위원회 - 연도별 최저임금 결정현황", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do" },
  ],
};
