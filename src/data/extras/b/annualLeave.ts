import { RATES } from "@/data/rates/2026";
import { calcAnnualLeave, calcLeaveAllowance, leaveForYears } from "@/lib/calculators/annualLeave";
import { addMonths, daysBetween, formatDate, parseDate } from "@/lib/calculators/date";
import type { GuideExtra, ToolExtra } from "../types";
import { ko, man, n, pct, won } from "./fmt";

// 연차 보강 글: 일수는 연차 계산기(calcAnnualLeave), 수당은 연차수당 계산기(calcLeaveAllowance) 식으로 계산합니다.

const d = (s: string) => parseDate(s)!;
const fmt = (x: Date) => ko(formatDate(x));

// ── 가이드: 근속 기간별 일수표 ─────────────────────────
const JOIN = d("2026-01-05"); // 표 계산용 입사일(날짜와 상관없이 결과는 같습니다)
const leaveAt = (months: number) => calcAnnualLeave(JOIN, addMonths(JOIN, months)).currentLeave;
const monthRows = [1, 2, 3, 6, 11];
const yearRows = [1, 2, 3, 4, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
// 입사 후 지금까지 생긴 연차 합계: 첫해 월 단위 연차 + 매년 생긴 연차
const cumulativeAtYear = (y: number) => {
  let sum = leaveAt(11);
  for (let k = 1; k <= y; k++) sum += leaveAt(12 * k);
  return sum;
};
const firstTwoYears = cumulativeAtYear(1);
const capYear = yearRows.find((y) => leaveAt(12 * y) === 25)!;

// ── 가이드: 단시간 근로자 ──────────────────────────────
const FULL_WEEK = 40;
const partTime = [
  { week: 15, days: 5 },
  { week: 20, days: 5 },
  { week: 24, days: 3 },
  { week: 30, days: 5 },
  { week: 35, days: 5 },
].map((p) => {
  // 통상 근로자의 연차휴가일수 × (단시간 소정근로시간 ÷ 통상 소정근로시간) × 8시간, 1시간 미만은 1시간
  const hours = Math.ceil(leaveForYears(1) * (p.week / FULL_WEEK) * 8);
  const dailyHours = p.week / p.days;
  return { ...p, hours, dailyHours, asDays: hours / dailyHours, pay: hours * RATES.minimumWage };
});

// ── 가이드: 입사 3년 차 예시 ───────────────────────────
const EX_JOIN = d("2024-03-04");
const EX_REF = d("2026-11-23");
const exNow = calcAnnualLeave(EX_JOIN, EX_REF);
const exMonthly = 2_800_000; // 기본급 260만 원 + 직무수당 20만 원
const exUnused = 6;
const exPay = calcLeaveAllowance(exMonthly, 209, 8, exUnused);
const exNextPay = calcLeaveAllowance(exMonthly, 209, 8, exNow.nextGrantDays);
const grantRows = [
  { when: `${fmt(addMonths(EX_JOIN, 1))} ~ ${fmt(addMonths(EX_JOIN, 11))} (매달)`, days: `1일씩 ${leaveAt(11)}일`, until: fmt(new Date(addMonths(EX_JOIN, 12).getTime() - 86_400_000)) },
  ...[1, 2, 3].map((y) => ({
    when: fmt(addMonths(EX_JOIN, 12 * y)),
    days: `${leaveForYears(y)}일`,
    until: fmt(new Date(addMonths(EX_JOIN, 12 * (y + 1)).getTime() - 86_400_000)),
  })),
];

// ── 가이드: 출근율 ─────────────────────────────────────
const WORKDAYS = 250;
const attendance = [40, 50, 51].map((absent) => ({ absent, rate: (WORKDAYS - absent) / WORKDAYS }));

// ── 가이드: 회계연도 비례 ──────────────────────────────
const FY_JOIN = d("2025-07-01");
const FY_START = d("2026-01-01");
const fyDays = daysBetween(FY_JOIN, FY_START);
const fyLeave = (leaveForYears(1) * fyDays) / 365;

export const annualLeaveGuide: GuideExtra = {
  updated: "2026-11-23",
  mode: "append",
  sections: [
    {
      heading: "근속 기간별 연차 일수표",
      body: [
        "입사일 기준으로 매달 개근하고 해마다 출근율 80% 이상을 채운다고 가정해, 이 사이트의 연차 계산기 식으로 근속 시점마다 새로 생기는 연차와 입사 후 생긴 연차의 합계를 계산했습니다.",
      ],
      table: {
        caption: "근속 시점별 연차 발생 일수 (입사일 기준, 출근율 80% 이상)",
        head: ["근속", "그 시점에 새로 생기는 연차", "입사 후 생긴 연차 합계"],
        rows: [
          ...monthRows.map((m) => [`${m}개월`, `${leaveAt(m) - leaveAt(m - 1)}일`, `${leaveAt(m)}일`]),
          ...yearRows.map((y) => [`${y}년`, `${leaveAt(12 * y)}일`, `${cumulativeAtYear(y)}일`]),
        ],
        note: "합계는 생긴 일수를 모두 더한 값으로, 이미 쓴 연차나 기한이 지나 소멸한 연차를 뺀 남은 일수가 아닙니다.",
      },
      after: [
        `입사 후 2년 동안 생기는 연차는 첫해 월 단위 연차 ${leaveAt(11)}일과 1년을 채운 날 생기는 ${leaveAt(12)}일을 더한 최대 ${firstTwoYears}일입니다. 다만 첫해 월 단위 연차는 입사 후 1년이 끝날 때까지 쓰지 않으면 소멸하므로 두 묶음을 한꺼번에 쓸 수는 없습니다.`,
        `연차는 근속 3년부터 2년마다 1일씩 늘어 근속 ${capYear}년에 법정 상한인 25일이 되고, 그 뒤로는 더 늘지 않습니다. 회사 규정이나 단체협약으로 이보다 많이 주는 것은 가능합니다.`,
      ],
    },
    {
      heading: "단시간 근로자의 연차는 시간으로 셉니다",
      body: [
        `주 소정근로시간이 통상 근로자보다 짧은 단시간 근로자도 주 15시간 이상이면 연차가 생깁니다. 다만 일수가 아니라 시간으로 계산합니다. 근로기준법 시행령 별표 2는 '통상 근로자의 연차휴가일수 × (단시간 근로자의 소정근로시간 ÷ 통상 근로자의 소정근로시간) × 8시간'으로 정하고, 1시간 미만은 1시간으로 봅니다. 아래 표는 통상 근로자가 주 ${FULL_WEEK}시간이고 1년 차 연차 ${leaveForYears(1)}일이 생기는 경우입니다.`,
      ],
      table: {
        caption: `단시간 근로자의 1년 차 연차 (통상 근로자 주 ${FULL_WEEK}시간 기준)`,
        head: ["주 소정근로시간", "근무 형태 예", "연차 시간", "근무일로 환산", `전부 못 쓰면 받을 수당(시급 ${n(RATES.minimumWage)}원)`],
        rows: partTime.map((p) => [
          `${p.week}시간`,
          `주 ${p.days}일 × 하루 ${p.dailyHours}시간`,
          `${p.hours}시간`,
          `${Number.isInteger(p.asDays) ? p.asDays : p.asDays.toFixed(1)}일`,
          won(p.pay),
        ]),
        note: `${RATES.year}년 최저시급으로 계산한 수당입니다. 실제 수당은 본인의 통상시급으로 계산합니다.`,
      },
      after: [
        "표에서 보듯 주 5일 근무하는 단시간 근로자는 하루 근무시간이 짧을 뿐, 연차 시간을 근무일로 바꾸면 통상 근로자와 같은 일수를 쉴 수 있습니다. 반면 주 3일만 길게 일하는 사람은 연차 시간이 근무일 기준으로 더 적은 일수가 됩니다. 연차를 시간 단위로 나눠 쓸 수 있는지는 회사 규정에 따릅니다.",
      ],
    },
    {
      heading: "입사 3년 차 직원의 연차와 퇴사 정산 예시",
      body: [
        `${fmt(EX_JOIN)}에 입사해 하루 8시간, 주 5일 일하는 직원이 있습니다. 월 통상임금은 기본급과 매달 고정으로 받는 직무수당을 더한 ${man(exMonthly)}입니다. 매달 개근했다면 연차는 아래처럼 생기고, 각 연차는 표의 기한까지 쓰지 않으면 소멸하면서 수당으로 바뀝니다.`,
      ],
      table: {
        caption: `${fmt(EX_JOIN)} 입사자의 연차 발생일과 사용 기한`,
        head: ["발생일", "생기는 연차", "사용 기한"],
        rows: grantRows.map((g) => [g.when, g.days, g.until]),
        note: "입사일 기준, 매달 개근·매년 출근율 80% 이상 가정. 회사가 연차 사용 촉진 절차를 거쳤다면 소멸한 연차에 수당이 나오지 않을 수 있습니다.",
      },
      after: [
        `${fmt(EX_REF)} 기준으로 이 직원은 근속 ${exNow.years}년을 채운 뒤 생긴 연차가 ${exNow.currentLeave}일이고, 다음 연차는 ${fmt(exNow.nextGrantDate!)}에 ${exNow.nextGrantDays}일 생깁니다. 이 직원이 2026년 12월 31일까지 일하고 퇴사하면서 올해 연차 ${exUnused}일을 남겼다면 수당은 이렇게 계산합니다. 통상시급은 ${man(exMonthly)} ÷ 209 = ${won(exPay.hourly)}, 1일 통상임금은 여기에 8시간을 곱한 ${won(exPay.daily)}, 수당은 ${won(exPay.daily)} × ${exUnused}일 = ${won(exPay.allowance)}입니다.`,
        `퇴사 시기를 조금 늦춰 ${fmt(exNow.nextGrantDate!)}까지 근로관계가 이어지면 ${exNow.nextGrantDays}일이 새로 생깁니다. 이를 쓰지 못하고 퇴사하면 ${won(exNextPay.allowance)}의 수당이 더해집니다. 연차는 1년 근로를 마친 다음 날에 생기므로, 마지막 근무일을 그 전날로 잡으면 이 연차는 생기지 않습니다. 퇴사일을 정할 때 다음 연차 발생일을 함께 확인하세요.`,
      ],
    },
    {
      heading: "출근율 80%를 계산할 때 출근으로 보는 기간",
      body: [
        "출근율은 1년 동안 일하기로 정한 날(소정근로일) 가운데 실제로 출근한 날의 비율입니다. 주휴일이나 공휴일처럼 원래 쉬는 날은 소정근로일에 넣지 않습니다. 결근이 많아 출근율이 80%에 못 미치면 15일 대신 개근한 달마다 1일씩만 생깁니다.",
      ],
      table: {
        caption: `소정근로일 ${WORKDAYS}일인 해의 결근 일수별 출근율`,
        head: ["결근 일수", "출근율", "그해 연차"],
        rows: attendance.map((a) => [`${a.absent}일`, pct(a.rate), a.rate >= 0.8 ? `${leaveForYears(1)}일 이상(근속에 따라)` : "개근한 달 수만큼"]),
        note: "결근이 없는 달이 개근한 달입니다. 아래 법정 기간은 결근이 아니라 출근으로 셉니다.",
      },
      after: [
        "근로기준법 제60조제6항은 업무상 부상·질병으로 쉰 기간, 출산전후휴가와 유산·사산 휴가 기간, 육아휴직 기간을 출근한 것으로 봅니다. 여기에 육아기 근로시간 단축으로 줄어든 시간(2024년 10월 개정)과 임신기 근로시간 단축으로 줄어든 시간(2026년 2월 개정)도 출근한 것으로 보도록 더해졌습니다. 근로시간을 줄여 일했다고 연차가 줄어들지 않는다는 뜻입니다.",
      ],
    },
    {
      heading: "5인 기준과 회계연도 관리에서 생기는 차이",
      body: [
        "연차휴가는 상시 근로자 5인 이상 사업장에 적용되는데, 연차 15일(근로기준법 제60조제1항·제4항)이 적용되는지를 판단할 때는 연차가 생기는 날 전 1년 동안 월 단위로 근로자 수를 셉니다. 근로기준법 시행령 제7조의2제3항은 그 1년 동안 계속 5명 이상을 고용한 사업장을 적용 대상으로 봅니다. 직원 수가 4~6명을 오가는 작은 회사라면 연차가 생기는 날을 기준으로 지난 1년의 인원을 확인해 보세요.",
        `회사가 연차를 1월 1일 기준(회계연도 기준)으로 관리하면 입사한 해에는 근무한 기간에 비례해 주는 방식이 많이 쓰입니다. 예를 들어 ${fmt(FY_JOIN)} 입사자는 ${fmt(FY_START)}에 ${leaveForYears(1)}일 × ${fyDays}일 ÷ 365일 = 약 ${fyLeave.toFixed(1)}일을 받고, 입사 첫해의 월 단위 연차는 별도로 생깁니다. 퇴사할 때는 입사일 기준으로 다시 계산한 일수와 비교해 덜 받은 만큼 정산해야 합니다. 연차 계산기는 입사일 기준 결과를 보여 주므로 이 비교에 쓸 수 있습니다.`,
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 - 근로기준법(제60조 연차 유급휴가, 제61조 사용 촉진)", url: "https://www.law.go.kr/법령/근로기준법" },
    { label: "국가법령정보센터 - 근로기준법 시행령(제7조의2, 별표 2 단시간근로자 연차)", url: "https://www.law.go.kr/법령/근로기준법시행령" },
    { label: "최저임금위원회 - 연도별 최저임금 결정현황", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do" },
  ],
};

// ── 도구: 기준일별 결과 ────────────────────────────────
const T_JOIN = d("2025-03-03");
const refs = ["2025-04-02", "2025-04-03", "2025-12-03", "2026-03-02", "2026-03-03", "2027-03-03", "2028-03-03"];
const refRows = refs.map((s) => {
  const r = calcAnnualLeave(T_JOIN, d(s));
  return [ko(s), `${r.currentLeave}일`, r.years < 1 ? "입사 첫해 누적" : `근속 ${r.years}년 연차`, `${fmt(r.nextGrantDate!)}에 ${r.nextGrantDays}일`];
});

// ── 도구: 연차수당 빠른 표 ─────────────────────────────
const wages = [RATES.minimumWage * 209, 2_500_000, 3_000_000, 3_500_000, 4_000_000];
const dayCols = [1, 5, 10, 15];

// ── 도구: 단시간 입력 ──────────────────────────────────
const PT_HOURS = 4; // 하루 4시간 × 주 5일
const ptLeaveHours = partTime.find((p) => p.week === 20)!.hours;
const ptUsedHours = 40;
const ptRemainDays = (ptLeaveHours - ptUsedHours) / PT_HOURS;
const ptPay = calcLeaveAllowance(RATES.minimumWage * 209, 209, PT_HOURS, ptRemainDays);

export const annualLeaveTool: ToolExtra = {
  updated: "2026-11-23",
  sections: [
    {
      heading: "기준일을 바꿔 본 계산 결과",
      body: [
        `입사일을 ${fmt(T_JOIN)}로 두고 기준일만 바꿔 계산기를 돌리면 결과가 이렇게 달라집니다. 화면 맨 위의 큰 숫자는 그 시점까지 '생긴' 연차이며, 이미 쓴 연차를 뺀 남은 일수가 아닙니다.`,
      ],
      table: {
        caption: `${fmt(T_JOIN)} 입사자의 기준일별 결과`,
        head: ["기준일", "화면의 연차", "의미", "다음 연차"],
        rows: refRows,
        note: "매달 개근, 매년 출근율 80% 이상을 가정한 계산기 결과입니다.",
      },
      after: [
        "입사 첫해에는 매달 1일씩 늘어나는 누적 일수를 보여 주고, 1년을 채운 날부터는 그해에 새로 생긴 일수를 보여 줍니다. 그래서 1년을 채우기 하루 전과 당일의 숫자가 크게 달라집니다. 남은 연차를 알고 싶다면 이 숫자에서 그 기간에 쓴 일수를 빼고, 첫해 월 단위 연차는 1년이 끝나면 소멸한다는 점도 함께 고려하세요.",
      ],
    },
    {
      heading: "월 통상임금별 연차수당 빠른 표",
      body: [
        "남은 연차를 수당으로 받을 때의 금액을 하루 8시간, 월 209시간 기준으로 계산했습니다. 내 월 통상임금과 가까운 줄을 보면 대략적인 금액을 바로 알 수 있습니다.",
      ],
      table: {
        caption: "월 통상임금·남은 연차 일수별 연차수당 (세전)",
        head: ["월 통상임금", "1일 통상임금", ...dayCols.map((k) => `${k}일`)],
        rows: wages.map((w, i) => {
          const one = calcLeaveAllowance(w, 209, 8, 1);
          return [i === 0 ? `${won(w)}(최저임금)` : man(w), won(one.daily), ...dayCols.map((k) => won(calcLeaveAllowance(w, 209, 8, k).allowance))];
        }),
        note: `첫 줄은 ${RATES.year}년 최저시급 ${n(RATES.minimumWage)}원 × 209시간입니다. 원 단위 반올림.`,
      },
    },
    {
      heading: "단시간 근로자가 입력하는 방법",
      body: [
        "이 계산기는 월 통상임금을 209시간으로 나눠 시급을 구합니다. 주 40시간보다 적게 일하는 단시간 근로자가 실제 월급을 그대로 넣으면 시급이 실제보다 작게 계산됩니다. 이때는 월 통상임금 칸에 '내 시급 × 209'를 넣고, 하루 소정근로시간 칸에 실제 하루 근무시간을 넣으세요.",
        `예를 들어 시급 ${n(RATES.minimumWage)}원으로 하루 ${PT_HOURS}시간, 주 5일 일하는 사람은 1년 차 연차가 ${ptLeaveHours}시간입니다. 그중 ${ptUsedHours}시간을 쓰고 퇴사한다면 남은 ${ptLeaveHours - ptUsedHours}시간은 하루 ${PT_HOURS}시간 기준 ${ptRemainDays}일입니다. 월 통상임금 칸에 ${won(RATES.minimumWage * 209)}, 하루 소정근로시간 ${PT_HOURS}, 남은 연차 ${ptRemainDays}일을 넣으면 수당 ${won(ptPay.allowance)}이 나옵니다.`,
        `화면에 보이는 연차 일수는 통상 근로자 기준입니다. 단시간 근로자는 이 일수에 '내 주 소정근로시간 ÷ ${FULL_WEEK} × 8'을 곱하면 연차 시간이 됩니다. 주 3일처럼 근무일이 적은 사람은 이렇게 구한 시간을 하루 근무시간으로 나눠야 실제로 쉴 수 있는 날 수가 나옵니다.`,
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 - 근로기준법(제60조)", url: "https://www.law.go.kr/법령/근로기준법" },
    { label: "국가법령정보센터 - 근로기준법 시행령(제6조 통상임금, 별표 2)", url: "https://www.law.go.kr/법령/근로기준법시행령" },
    { label: "최저임금위원회 - 연도별 최저임금 결정현황", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do" },
  ],
};
