import type { Guide } from "@/data/guides";
import { RATES } from "@/data/rates/2026";
import { calcSocialInsurance, INDUSTRIAL_RATES, STABILITY_RATES } from "@/lib/calculators/socialInsurance";
import { calcSeverance } from "@/lib/calculators/severance";
import { calcElectricity, CLIMATE_PRICE, FUEL_PRICE_2026Q4, TARIFF, SUPER_USER_KWH } from "@/lib/calculators/electricity";
import { calcCarTax, CC_RATES, PREPAY_INTEREST, type CarTaxInput } from "@/lib/calculators/carTax";

// 묶음 e: 2026-11-27에 새로 만든 계산기(4대보험·전기요금·자동차세) 사용법 가이드.

const n = (v: number) => Math.round(v).toLocaleString("ko-KR");
const won = (v: number) => `${n(v)}원`;
const man = (v: number) => `${n(v / 10_000)}만 원`;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

// ───────────── 4대보험: 회사 부담과 인건비 ─────────────
const OFFICE = 6.6; // 전문·보건·교육·여가 관련 서비스업 산재보험료율(2026년, 천분율)
const si = (pay: number, nonTax = 0) => calcSocialInsurance({ monthlyPay: pay, monthlyNonTaxable: nonTax, stability: "under150", industrialPermille: OFFICE });
// 1년 근무하고 퇴직할 때의 법정 퇴직금(월급이 모두 통상임금인 고정 월급 기준)
const severance1y = (pay: number) =>
  calcSeverance({ startDate: "2025-01-01", endDate: "2026-01-01", last3MonthsWage: pay * 3, annualBonus: 0, annualLeavePay: 0, monthlyOrdinaryWage: pay })!.severancePay;
const yearCost = (pay: number) => {
  const r = si(pay);
  const sev = severance1y(pay);
  return { r, sev, total: pay * 12 + r.employerTotal * 12 + sev };
};
const headPay = 2_500_000;
const head = yearCost(headPay);
const costLevels = [RATES.minimumWage * 209, 2_500_000, 3_000_000, 3_500_000, 4_000_000];
const mealCompare = [0, RATES.incomeTax.mealTaxFreeLimit].map((nt) => ({ nt, r: si(3_000_000, nt) }));
const row = (r: ReturnType<typeof si>, key: string) => r.rows.find((x) => x.key === key)!.employer;
const sizeIndustries = ["907", "910", "218"].map((c) => INDUSTRIAL_RATES.find((x) => x.code === c)!);

// 두루누리 사회보험료 지원: 10명 미만 사업, 월평균보수 270만 원 미만 신규가입 근로자와 사업주,
// 고용보험·국민연금 보험료의 80%, 최대 36개월. 출처: 두루누리 사회보험료 지원사업 소개
// (https://insurancesupport.or.kr/durunuri/intro.php), 확인 2026-11-27
const DURUNURI_LIMIT = 2_700_000;
const DURUNURI_RATE = 0.8;
const duruPay = 2_500_000;
const duru = si(duruPay);
const duruEmployer = (row(duru, "pension") + row(duru, "unemployment")) * DURUNURI_RATE;
const duruEmployee = (duru.rows.find((x) => x.key === "pension")!.employee + duru.rows.find((x) => x.key === "unemployment")!.employee) * DURUNURI_RATE;

// ───────────── 전기요금 ─────────────
// 값은 src/lib/calculators/electricity.ts(한전ON 요금표·계산기로 확인, 2026-11-27)를 그대로 씁니다.
const el = (kwh: number, month = 12, fuelPrice?: number) => calcElectricity({ kwh, month, voltage: "low", fuelPrice });
const kwhOf = (watt: number, hours: number, days = 30) => (watt * hours * days) / 1000;
const heaterBase = 300;
const heaterAddKwh = kwhOf(1_000, 5);
const heaterBefore = el(heaterBase);
const heaterAfter = el(heaterBase + heaterAddKwh);
const watts = [500, 1_000, 1_500, 2_000];
const hoursList = [2, 4, 6, 8];
const baseList = [150, 250, 350, 450];
const addList = [60, 120, 180];
const edge = { a: el(390), b: el(410) };
const elHigh = (kwh: number, month = 12) => calcElectricity({ kwh, month, voltage: "high" });
const combo = [
  { w: 200, h: 8 },
  { w: 1_500, h: 2 },
];
const comboKwh = combo.reduce((s, x) => s + kwhOf(x.w, x.h), 0);
const superBase = 900;
const superAdd = 200;
// 기후환경요금 9.0원/kWh의 구성(RPS 7.7원 + ETS 1.1원 + 석탄발전 감축 0.2원), 2023년 1월부터.
// 출처: 한전ON 원가연계형 요금제(https://online.kepco.co.kr/PRM097D00), 확인 2026-11-27
const CLIMATE_PARTS = { rps: 7.7, ets: 1.1, coal: 0.2 };
// 연료비조정단가 2026년 4분기: 산정 결과 +7.3원이었으나 상한 +5.0원 적용. 출처: 한전ON 공지(2026-09-21 게시), 확인 2026-11-27
const FUEL_CALCULATED_2026Q4 = 7.3;
const FUEL_LIMIT = 5;
// 자동이체 할인: 전월 납부액의 1%, 1,000원 한도. 출처: 한전ON 전기요금계산기(https://online.kepco.co.kr/PRM033D00), 확인 2026-11-27
const AUTO_PAY_RATE = 0.01;
const AUTO_PAY_LIMIT = 1_000;
const billKwh = 320;
const bill = el(billKwh, 11);
const fuelCases = [-FUEL_LIMIT, 0, FUEL_PRICE_2026Q4];
const seasonList = [250, 320, 400, 450, 500];

// ───────────── 자동차세 ─────────────
// 값은 src/lib/calculators/carTax.ts(지방세법·시행령 원문으로 확인, 2026-11-27)를 그대로 씁니다.
const car = (input: Partial<CarTaxInput>) => calcCarTax({ kind: "cc", cc: 1_998, taxYear: 2026, regYear: 2025, regMonth: 3, ...input });
const ccRows = [998, 1_598, 1_998, 2_497, 3_342];
const ageRows = [2, 3, 5, 7, 9, 12];
const dec = car({});
const lateReg = car({ regYear: 2024, regMonth: 9 }); // 2024년 9월 등록: 2026년 1기분 차령 2년, 2기분 차령 3년
const evDec = car({ kind: "electric" });
const smallDec = car({ cc: 998 });
// 2027년 1월 연납(차령 2년 이하 = 2026년 등록, 경감 없음). 서울시 안내 예시(1,998cc 연세액 399,600원, 공제 18,280원)와 같은 조건.
const pre = (input: Partial<CarTaxInput>) => calcCarTax({ kind: "cc", cc: 1_998, taxYear: 2027, regYear: 2026, regMonth: 1, ...input });
const jan = pre({});
const janRate = (334 / 365) * PREPAY_INTEREST; // 1월 연납 실제 공제 비율(2027년은 평년)
const PREPAY_MONTH_LABEL: Record<number, string> = { 1: "1월 16~31일", 3: "3월 16~31일", 6: "6월 16~30일", 9: "9월 16~30일" };
// 연납 대신 예금에 두는 경우의 비교: 6월분 5개월, 12월분 11개월 단리, 이자소득세 RATES.interestTax.normal(15.4%)
const depositRates = [0.025, 0.03, 0.035];
const depositInterest = (r: ReturnType<typeof calcCarTax>, rate: number) =>
  Math.floor((r.first.total * rate * (5 / 12) + r.second.total * rate * (11 / 12)) * (1 - RATES.interestTax.normal));
const depositCars: { label: string; input: Partial<CarTaxInput> }[] = [
  { label: "1,598cc", input: { cc: 1_598 } },
  { label: "1,998cc", input: {} },
  { label: "2,497cc", input: { cc: 2_497 } },
  { label: "3,342cc", input: { cc: 3_342 } },
  { label: "전기차", input: { kind: "electric" } },
];
// 분할 납부(지방세법 제128조 제1항 단서): 각 기분 세액의 절반을 3월·9월에 먼저 냄. 끝수는 먼저 내는 몫에 붙임(지방회계법 시행령 제67조), 확인 2026-11-27
const splitHalf = (total: number): [number, number] => {
  const later = Math.floor(total / 2 / 10) * 10;
  return [total - later, later];
};
const splitCars: { label: string; input: Partial<CarTaxInput> }[] = [
  { label: "998cc · 2년 이하", input: { cc: 998, regYear: 2026 } },
  { label: "1,598cc · 2년 이하", input: { cc: 1_598, regYear: 2026 } },
  { label: "1,998cc · 2년 이하", input: { regYear: 2026 } },
  { label: "1,998cc · 6년", input: { regYear: 2022 } },
  { label: "2,497cc · 4년", input: { cc: 2_497, regYear: 2024 } },
  { label: "3,342cc · 2년 이하", input: { cc: 3_342, regYear: 2026 } },
];
// 자동차 이전·말소 때 일할 계산 세액이 2천 원 미만이면 걷지 않음(지방세법 제130조 제4항), 확인 2026-11-27
const SMALL_TAX_LIMIT = 2_000;

export const guidesE: Guide[] = [
  {
    slug: "employer-social-insurance-cost",
    title: "직원 한 명 뽑으면 회사 부담은 얼마? 4대보험 사업주 부담분과 1년 인건비 계산",
    description: "월급 말고 회사가 더 내는 4대보험 사업주 부담분과 퇴직금 적립까지 더한 1년 인건비를 월급별로 계산했습니다. 두루누리 지원 조건도 함께 정리했습니다.",
    date: "2026-11-30",
    tool: "social-insurance",
    sections: [
      {
        heading: "월급 250만 원 직원의 회사 부담",
        body: [
          `비과세 없이 월급 ${man(headPay)}을 주는 직원 한 명을 뽑으면, 150명 미만 회사(산재보험료율 1,000분의 ${OFFICE} 업종 기준)는 월급과 별도로 4대보험 사업주 부담분으로 한 달 약 ${won(head.r.employerTotal)}을 냅니다. 여기에 1년을 채우면 생기는 퇴직금 약 ${won(head.sev)}까지 더하면, 이 직원의 1년 인건비는 연봉 ${man(headPay * 12)}이 아니라 약 ${man(head.total)}입니다.`,
          "처음 직원을 뽑는 작은 가게나 회사가 가장 자주 놓치는 부분이 이 차이입니다. 채용 공고에 적는 월급은 근로자가 받는 세전 금액이고, 회사 장부에 나가는 돈은 그보다 1년에 월급 두 달 치 가까이 많습니다.",
        ],
      },
      {
        heading: "회사가 내는 보험료는 두 종류입니다",
        body: [
          `첫째는 근로자와 똑같이 나눠 내는 몫입니다. 국민연금(각 ${pct(RATES.pension.rate, 2)}), 건강보험(각 ${pct(RATES.health.rate, 3)}), 장기요양보험(건강보험료의 ${pct(RATES.longTermCare.rateOfHealth, 2)}), 고용보험 실업급여분(각 ${pct(RATES.employment.rate, 1)})은 근로자 월급에서 빠지는 금액과 같은 금액을 회사도 냅니다.`,
          "둘째는 회사만 내는 몫입니다. 고용보험 중 고용안정·직업능력개발사업 보험료는 회사 규모에 따라 0.25%(150명 미만)에서 0.85%(1,000명 이상)까지이고, 산재보험료는 업종에 따라 사무직 위주 업종의 1,000분의 5~7 수준부터 건설업의 1,000분의 35.6까지 차이가 큽니다. 산재보험료와 함께 임금채권부담금(1,000분의 0.6)과 석면피해구제분담금(1,000분의 0.06)도 걷습니다.",
          "그래서 근로자가 내는 4대보험은 회사가 어디든 같지만, 회사가 내는 금액은 회사 규모와 업종에 따라 달라집니다.",
        ],
      },
      {
        heading: "월급별 1년 인건비",
        body: [
          "아래 표는 비과세 없이 고정 월급만 받는 직원이 1년을 일하고 퇴직하는 경우입니다. 퇴직금은 사이트 퇴직금 계산기와 같은 방식(평균임금과 통상임금 중 큰 쪽으로 30일분)으로 계산했습니다.",
        ],
        table: {
          caption: `월급별 회사 부담과 1년 인건비(150명 미만, 산재 ${OFFICE}/1,000, ${RATES.year}년 요율)`,
          head: ["월급", "회사 4대보험(월)", "회사 4대보험(1년)", "퇴직금(1년 근무)", "1년 인건비 합계", "연 급여 대비"],
          rows: costLevels.map((pay) => {
            const c = yearCost(pay);
            return [won(pay), won(c.r.employerTotal), won(c.r.employerTotal * 12), won(c.sev), won(c.total), `+${pct(c.total / (pay * 12) - 1)}`];
          }),
          note: `첫 줄은 ${RATES.year}년 최저임금(시급 ${n(RATES.minimumWage)}원 × 209시간)입니다. 연차수당, 상여금, 식대 같은 수당과 입사·퇴사 달의 일할 계산은 넣지 않았습니다.`,
        },
        after: [
          "월급과 관계없이 연 급여의 약 18% 안팎이 더 든다고 보면 됩니다. 이 가운데 대략 절반은 4대보험, 절반은 퇴직금입니다. 퇴직금은 1년 이상 일하고 그만둘 때 한꺼번에 나가지만, 매달 조금씩 따로 떼어 두면 갑자기 큰돈이 필요해지는 일을 막을 수 있습니다.",
        ],
      },
      {
        heading: "회사 규모와 업종에 따라 달라지는 몫",
        body: [
          "근로자가 내는 4대보험은 어느 회사에서 일하든 같지만, 회사만 내는 두 가지는 회사마다 다릅니다. 고용안정·직업능력개발사업 보험료는 회사가 운영하는 모든 사업장의 상시 근로자 수를 합해 정하고, 150명 이상이라도 업종별 기준 이하인 우선지원대상기업은 0.45%를 냅니다. 산재보험료율은 사업 종류마다 근로복지공단이 정한 값을 씁니다.",
          `아래 표는 같은 월급 ${man(3_000_000)} 직원 한 명을 두고 회사 규모와 업종만 바꿔 계산한 회사 부담입니다. 차이는 한 달에 몇천 원에서 만 원대지만, 직원이 여러 명이면 1년 인건비 예산에서 무시하기 어려운 금액이 됩니다.`,
        ],
        table: {
          caption: `월급 ${man(3_000_000)} 직원 한 명의 회사 4대보험 부담(${RATES.year}년 요율)`,
          head: ["회사 규모(고용안정·직업능력개발)", ...sizeIndustries.map((x) => `${x.label}(${x.permille}/1,000)`)],
          rows: STABILITY_RATES.map((s) => [
            `${s.label}(${pct(s.rate, 2)})`,
            ...sizeIndustries.map((x) => {
              const r = calcSocialInsurance({ monthlyPay: 3_000_000, monthlyNonTaxable: 0, stability: s.key, industrialPermille: x.permille });
              return `월 ${won(r.employerTotal)} · 연 ${won(r.employerTotal * 12)}`;
            }),
          ]),
          note: "산재보험료율은 출퇴근재해 요율(1,000분의 0.6)을 포함한 2026년 사업종류별 요율입니다. 재해 발생 실적에 따라 요율이 할인·할증되는 사업장은 실제 금액이 다릅니다.",
        },
        after: [
          "처음 직원을 뽑는 작은 가게나 사무실은 대부분 맨 윗줄(150명 미만)에 해당합니다. 업종은 사업자등록증의 업태가 아니라 근로복지공단이 분류한 사업 종류로 정해지므로, 보험 관계가 성립된 뒤 공단에서 받은 고지서로 확인하는 것이 정확합니다.",
        ],
      },
      {
        heading: "식대를 비과세로 주면 회사 부담도 줄어듭니다",
        body: [
          `같은 월 300만 원이라도 그중 ${n(RATES.incomeTax.mealTaxFreeLimit)}원을 식대(비과세)로 주면, 4대보험료를 매기는 보수가 그만큼 줄어 근로자와 회사가 내는 보험료가 함께 줄어듭니다. 식대 비과세는 월 ${n(RATES.incomeTax.mealTaxFreeLimit)}원까지이고, 실제로 식사를 따로 제공하지 않는 경우에 해당합니다.`,
        ],
        table: {
          caption: "월 300만 원을 주는 방식에 따른 보험료 차이",
          head: ["지급 방식", "보험료 기준 보수", "근로자 4대보험", "회사 4대보험"],
          rows: mealCompare.map(({ nt, r }) => [nt === 0 ? "전액 기본급" : `기본급 + 식대 ${n(nt)}원`, won(r.base), won(r.employeeTotal), won(r.employerTotal)]),
          note: "150명 미만, 산재 1,000분의 6.6 기준입니다. 비과세 항목을 늘리면 국민연금 기준소득월액도 줄어 나중에 받는 연금액이 조금 줄어들 수 있습니다.",
        },
      },
      {
        heading: "10명 미만 사업장은 두루누리 지원을 확인하세요",
        body: [
          `근로자 수가 10명 미만인 사업장에 새로 들어온 근로자가 월평균보수 ${man(DURUNURI_LIMIT)} 미만이면, 두루누리 사회보험료 지원으로 근로자와 회사가 내는 고용보험료·국민연금 보험료의 ${pct(DURUNURI_RATE, 0)}를 최대 36개월 동안 지원받을 수 있습니다. 여기서 신규가입자는 지원 신청일 직전 1년 동안 고용보험과 국민연금 자격을 얻은 이력이 없는 근로자를 말합니다.`,
          `월급 ${man(duruPay)}인 신규 직원이라면 국민연금과 고용보험 실업급여분을 기준으로 회사는 한 달 약 ${won(duruEmployer)}, 근로자는 약 ${won(duruEmployee)}을 덜 내는 셈입니다(지원 한도와 세부 계산은 공단이 정합니다). 재산 과세표준 합계가 6억 원 이상이거나 전년도 종합소득이 4,300만 원 이상인 근로자, 공공기관 근로자는 제외됩니다.`,
          "지원은 신청한 달부터 받을 수 있고 지난달 보험료를 소급해 주지 않으므로, 직원을 뽑았다면 근로복지공단이나 국민연금공단에 바로 신청하는 것이 좋습니다. 보험료를 기한 안에 다 낸 달만 지원하고, 다음 달 보험료에서 빼 주는 방식입니다.",
        ],
      },
      {
        heading: "4대보험 계산기로 확인하는 순서",
        body: [
          "4대보험 계산기에 직원 월급과 비과세 금액을 넣고, 회사 규모와 업종을 고르면 근로자 부담분, 회사 부담분, 회사가 쓰는 한 달 인건비가 한 번에 나옵니다. 업종은 근로복지공단에서 받은 보험료 고지서에 적힌 사업종류를 보고 고르는 것이 정확하고, 목록에 없으면 산재보험료율을 직접 넣으면 됩니다.",
          "직원이 만 60세 이상이면 국민연금이 빠지고, 만 65세 이후에 새로 뽑은 직원이면 고용보험 실업급여분이 빠지므로 해당 칸을 체크합니다. 근로자 쪽 월 실수령액까지 보고 싶다면 연봉 실수령액 계산기에 같은 월급을 넣어 소득세까지 확인할 수 있습니다.",
          "계산기는 공단 요율로 낸 추정치입니다. 입사한 달의 일할 보험료, 매년 4월 건강보험 정산, 재해 실적에 따른 산재보험료 할인·할증은 반영하지 않으므로 실제 고지액은 국민연금공단, 국민건강보험공단, 근로복지공단에서 확인하세요.",
        ],
      },
    ],
    sources: [
      { label: "근로복지공단 – 보험료율(산재보험 사업종류별 요율, 고용보험 사업별 보험료율)", url: "https://www.comwel.or.kr/comwel/paym/paym/tari.jsp" },
      { label: "두루누리 사회보험료 지원사업 – 사업 소개(지원 대상·수준·제외 대상)", url: "https://insurancesupport.or.kr/durunuri/intro.php" },
      { label: "국민연금공단 – 연금보험료 안내", url: "https://nps.or.kr/pnsinfo/ntpsklg/getOHAF0097M0.do" },
      { label: "국민건강보험공단 – 2026년 건강보험료율 안내", url: "https://www.nhis.or.kr/renewal_popup/poster/20260204_poster_longdesc_1.html" },
      { label: "국가법령정보센터 – 근로자퇴직급여 보장법", url: "https://www.law.go.kr/법령/근로자퇴직급여보장법" },
    ],
  },
  {
    slug: "winter-electric-heater-bill",
    title: "전기난로·전기장판 한 달 쓰면 전기요금 얼마? 누진 구간으로 계산하기",
    description: "난방기의 소비전력과 사용 시간으로 한 달 사용량을 구하고, 평소 사용량에 더했을 때 누진 구간 때문에 요금이 얼마나 오르는지 주택용 전기요금표로 계산했습니다.",
    date: "2026-12-08",
    tool: "electricity-bill",
    sections: [
      {
        heading: "평소 300kWh 쓰는 집이 1,000W 난방기를 하루 5시간 켜면",
        body: [
          `평소 한 달에 ${heaterBase}kWh를 쓰는 주택용 저압 가구가 소비전력 1,000W짜리 난방기를 하루 5시간씩 30일 쓰면 사용량이 ${n(heaterAddKwh)}kWh 늘어 ${n(heaterBase + heaterAddKwh)}kWh가 됩니다. 12월 기준 청구액은 ${won(heaterBefore.bill)}에서 ${won(heaterAfter.bill)}으로, 한 달에 ${won(heaterAfter.bill - heaterBefore.bill)} 오릅니다.`,
          `늘어난 사용량은 ${heaterBase}kWh의 절반인데 요금은 그보다 훨씬 많이 오릅니다. 주택용 전기요금은 많이 쓸수록 비싼 단가가 붙는 누진제라, 400kWh를 넘는 순간 기본요금이 ${won(TARIFF.low.tiers[1].basic)}에서 ${won(TARIFF.low.tiers[2].basic)}으로 뛰고 넘는 부분에는 kWh당 ${TARIFF.low.tiers[2].price}원이 붙기 때문입니다. 같은 난방기라도 평소 사용량이 얼마인 집에서 쓰느냐에 따라 추가 요금이 크게 달라집니다.`,
        ],
      },
      {
        heading: "소비전력으로 한 달 사용량 구하기",
        body: [
          "전기 기기가 쓰는 전기의 양은 소비전력(W)에 사용 시간을 곱해 구합니다. 1,000W 기기를 1시간 켜면 1kWh입니다. 그래서 한 달 사용량(kWh)은 '소비전력(W) × 하루 사용 시간 × 사용 일수 ÷ 1,000'으로 계산합니다.",
          "소비전력은 제품 뒷면 명판이나 설명서에 '정격 소비전력'으로 적혀 있습니다. 전기장판, 전기요, 전기난로, 온풍기는 같은 종류라도 크기와 단계 설정에 따라 소비전력 차이가 크므로 우리 집 제품의 숫자를 확인하는 것이 먼저입니다. 강약 단계가 있는 제품은 단계마다 소비전력이 다르게 적혀 있기도 합니다.",
        ],
        table: {
          caption: "소비전력과 하루 사용 시간별 한 달(30일) 사용량",
          head: ["소비전력", ...hoursList.map((h) => `하루 ${h}시간`)],
          rows: watts.map((w) => [`${n(w)}W`, ...hoursList.map((h) => `${n(kwhOf(w, h))}kWh`)]),
          note: "정격 소비전력으로 계속 켜 두었다고 가정한 값입니다.",
        },
        after: [
          "온도 조절 기능이 있는 제품은 설정 온도에 이르면 전기를 덜 쓰거나 잠깐 꺼졌다 켜지기를 반복합니다. 그래서 실제 사용량은 표보다 적게 나오는 경우가 많습니다. 표는 '최대로 이만큼까지 늘 수 있다'는 기준으로 보세요.",
        ],
      },
      {
        heading: "평소 사용량에 따라 달라지는 추가 요금",
        body: [
          "같은 양을 더 쓰더라도 원래 사용량이 어느 구간에 있느냐에 따라 추가 요금이 다릅니다. 처음 200kWh까지는 kWh당 120원이지만, 400kWh를 넘는 부분은 그 두 배가 넘는 단가가 붙습니다. 아래 표는 12월 기준으로 평소 사용량에 난방기 사용량을 더했을 때 한 달 청구액이 얼마나 늘어나는지 계산한 것입니다.",
        ],
        table: {
          caption: "평소 사용량별 추가 사용 시 늘어나는 청구액(주택용 저압, 12월)",
          head: ["평소 사용량(청구액)", ...addList.map((a) => `+${a}kWh`)],
          rows: baseList.map((b) => [`${b}kWh(${won(el(b).bill)})`, ...addList.map((a) => `+${won(el(b + a).bill - el(b).bill)}`)]),
          note: `연료비조정단가 ${FUEL_PRICE_2026Q4.toFixed(1)}원(2026년 4분기), 기후환경요금 ${CLIMATE_PRICE.toFixed(1)}원, 부가가치세와 전력산업기반기금을 포함한 청구액 기준입니다.`,
        },
        after: [
          "평소 사용량이 적은 집은 난방기를 더 써도 대부분 2구간 안에서 끝나 추가 요금이 비교적 작습니다. 반대로 이미 400kWh 가까이 쓰는 집은 조금만 더 써도 3구간으로 넘어가 같은 사용량에 더 큰 요금이 붙습니다.",
        ],
      },
      {
        heading: "400kWh 경계를 넘는 순간",
        body: [
          `요금이 가장 크게 뛰는 곳은 400kWh 경계입니다. 12월에 390kWh를 쓰면 청구액이 ${won(edge.a.bill)}인데, 20kWh만 더 써서 410kWh가 되면 ${won(edge.b.bill)}으로 ${won(edge.b.bill - edge.a.bill)}이 늘어납니다. 기본요금이 ${won(edge.a.basic)}에서 ${won(edge.b.basic)}으로 바뀌는 몫이 대부분입니다.`,
          "기본요금은 그달 사용량이 들어간 구간 하나의 금액만 내기 때문에, 400kWh를 1kWh만 넘어도 3구간 기본요금 전체를 냅니다. 겨울철 사용량이 400kWh 언저리라면 난방기 사용 시간을 조금 줄이는 것만으로도 고지서 금액이 눈에 띄게 달라질 수 있습니다. 전기요금 계산기에 평소 사용량을 넣으면 다음 구간까지 몇 kWh 남았는지 바로 보여 줍니다.",
        ],
      },
      {
        heading: "1,000kWh를 넘으면 겨울에만 붙는 슈퍼유저 요금",
        body: [
          `12월부터 2월까지(동계)와 7~8월(하계)에는 한 달에 ${n(SUPER_USER_KWH)}kWh를 넘게 쓴 부분에 슈퍼유저 단가가 붙습니다. 주택용 저압은 kWh당 ${TARIFF.low.superPrice}원으로, 3구간 단가 ${TARIFF.low.tiers[2].price}원의 두 배가 넘습니다.`,
          `평소 ${superBase}kWh를 쓰는 집이 겨울에 ${superAdd}kWh를 더 쓰면 ${n(superBase + superAdd)}kWh가 됩니다. 같은 사용량이라도 11월에는 ${won(el(superBase + superAdd, 11).bill)}, 12월에는 ${won(el(superBase + superAdd, 12).bill)}이 나옵니다. 전기로만 난방하는 큰 집이나 여러 대를 동시에 켜는 집이라면 12~2월 사용량이 1,000kWh를 넘는지 확인해 볼 만합니다.`,
          `슈퍼유저 단가는 1,000kWh를 넘는 부분에만 붙고, 1,000kWh까지는 원래 구간 단가 그대로입니다. 그래서 ${n(SUPER_USER_KWH)}kWh 언저리를 쓰는 집이라면 넘는 양을 조금만 줄여도 비싼 단가가 붙는 양이 그대로 줄어듭니다. 3월이 되면 다시 슈퍼유저 단가가 붙지 않으므로, 겨울 석 달 동안만 특히 사용량을 살펴보면 됩니다.`,
        ],
      },
      {
        heading: "주택용 고압 가구와 여러 기기를 함께 쓸 때",
        body: [
          `주택용 고압 계약 가구는 같은 구간이라도 기본요금과 kWh당 단가가 낮습니다. 3구간 단가가 저압은 ${TARIFF.low.tiers[2].price}원, 고압은 ${TARIFF.high.tiers[2].price}원입니다. 그래서 같은 난방기 사용량을 더해도 늘어나는 금액이 저압보다 적습니다. 계약 종류는 고지서의 계약종별에서 확인할 수 있습니다.`,
          `여러 기기를 함께 쓴다면 기기마다 사용량을 따로 구해 더합니다. 예를 들어 소비전력 ${n(combo[0].w)}W 기기를 하루 ${combo[0].h}시간, ${n(combo[1].w)}W 기기를 하루 ${combo[1].h}시간 30일 쓰면 ${n(kwhOf(combo[0].w, combo[0].h))}kWh와 ${n(kwhOf(combo[1].w, combo[1].h))}kWh를 더해 한 달 ${n(comboKwh)}kWh가 늘어납니다. 아래 표는 이만큼을 평소 사용량에 더했을 때 저압과 고압의 추가 요금을 비교한 것입니다.`,
        ],
        table: {
          caption: `평소 사용량에 ${n(comboKwh)}kWh를 더할 때 늘어나는 청구액(12월)`,
          head: ["평소 사용량", "저압", "고압"],
          rows: baseList.map((b) => [`${b}kWh`, `+${won(el(b + comboKwh).bill - el(b).bill)}`, `+${won(elHigh(b + comboKwh).bill - elHigh(b).bill)}`]),
          note: "기기 소비전력과 사용 시간은 계산을 보여 주기 위한 가정입니다. 실제 제품의 정격 소비전력을 넣어 다시 계산하세요.",
        },
        after: [
          "전기장판처럼 소비전력이 작은 기기는 오래 켜도 사용량이 크게 늘지 않지만, 전기난로나 온풍기처럼 소비전력이 큰 기기는 몇 시간만 써도 수십 kWh가 늘어납니다. 어떤 기기를 얼마나 쓰느냐를 먼저 나눠 계산해 보면 줄일 곳이 보입니다.",
        ],
      },
      {
        heading: "난방기 전기요금을 줄이는 방법",
        body: [
          "가장 확실한 방법은 사용 시간을 줄이는 것입니다. 타이머 기능을 써서 잠들고 나서 일정 시간 뒤에 꺼지게 하거나, 사람이 있는 공간만 데우는 식으로 켜 두는 시간을 줄이면 사용량이 그만큼 줄어듭니다. 소비전력이 큰 기기 여러 대를 동시에 오래 켜 두는 것이 사용량을 가장 빠르게 늘립니다.",
          "설정 온도를 필요 이상으로 높이지 않는 것도 도움이 됩니다. 온도 조절 기능이 있는 제품은 설정 온도가 낮을수록 꺼져 있는 시간이 길어집니다. 창문과 문틈으로 열이 새는 집이라면 커튼이나 문풍지로 바람을 막아 같은 온도를 유지하는 데 드는 전기를 줄일 수 있습니다.",
          "지난달 고지서의 사용량을 먼저 확인해 두세요. 고지서의 사용량은 검침일 사이의 양이라 달력의 한 달과 다를 수 있습니다. 이번 달에 난방기를 얼마나 더 쓸지 대략 정해 두고 계산기로 미리 요금을 확인하면, 구간을 넘길지 여부를 보고 사용 시간을 조절할 수 있습니다.",
        ],
      },
      {
        heading: "전기요금 계산기로 확인하는 순서",
        body: [
          "먼저 위의 공식으로 난방기 사용량을 구합니다. 그다음 전기요금 계산기에 '평소 사용량 + 난방기 사용량'을 넣고 사용한 달을 고르면 기본요금, 구간별 전력량요금, 부가가치세와 기금을 더한 청구액이 나옵니다. 평소 사용량만 넣은 결과와 비교하면 난방기 때문에 늘어나는 금액을 알 수 있습니다.",
          "계산기는 한전 요금표를 따른 추정치이고 TV 수신료, 복지할인, 자동이체 할인, 아파트 공용 설비 사용분은 넣지 않았습니다. 정확한 청구액은 고지서나 한전ON에서 확인하세요.",
        ],
      },
    ],
    sources: [
      { label: "한전ON – 전기요금표(주택용 전력 저압·고압)", url: "https://online.kepco.co.kr/PRM004D00" },
      { label: "한전ON – 전기요금계산기(청구액 계산 방법)", url: "https://online.kepco.co.kr/PRM033D00" },
      { label: "한전ON – 원가연계형 요금제(기후환경요금·연료비조정요금)", url: "https://online.kepco.co.kr/PRM097D00" },
    ],
  },
  {
    slug: "electricity-bill-items-explained",
    title: "전기요금 고지서 항목 읽는 법: 기본요금부터 기후환경요금·기금까지",
    description: "전기요금 고지서의 기본요금, 전력량요금, 기후환경요금, 연료비조정요금, 부가가치세, 전력산업기반기금이 각각 무엇이고 어떤 순서로 계산되는지 한 집의 고지서로 따라가 봅니다.",
    date: "2026-12-11",
    tool: "electricity-bill",
    sections: [
      {
        heading: "320kWh 쓴 집의 고지서는 이렇게 만들어집니다",
        body: [
          `11월에 ${billKwh}kWh를 쓴 주택용 저압 가구의 청구액은 ${won(bill.bill)}입니다. 이 가운데 순수하게 전기를 쓴 양에 붙는 전력량요금은 ${won(bill.energy)}이고, 나머지는 기본요금, 기후환경요금, 연료비조정요금, 부가가치세, 전력산업기반기금입니다.`,
          "고지서의 항목은 정해진 순서로 계산됩니다. 기본요금과 사용량에 따른 요금 세 가지를 더해 '전기요금계'를 만들고, 여기에 부가가치세와 기금을 더한 뒤 10원 미만을 버리면 청구액이 됩니다. 순서를 알면 고지서의 숫자가 왜 그렇게 나왔는지 직접 맞춰 볼 수 있습니다.",
        ],
        table: {
          caption: `주택용 저압 11월 ${billKwh}kWh 청구액 계산`,
          head: ["순서", "항목", "계산", "금액"],
          rows: [
            ["1", "기본요금", "201~400kWh 구간", won(bill.basic)],
            ["2", "전력량요금", bill.uses.map((u) => `${n(u.kwh)}kWh × ${u.price}원`).join(" + "), won(bill.energy)],
            ["3", "기후환경요금", `${billKwh}kWh × ${CLIMATE_PRICE.toFixed(1)}원`, won(bill.climate)],
            ["4", "연료비조정요금", `${billKwh}kWh × ${FUEL_PRICE_2026Q4.toFixed(1)}원`, won(bill.fuel)],
            ["5", "전기요금계", "1 + 2 + 3 + 4", won(bill.subtotal)],
            ["6", "부가가치세", "전기요금계 × 10%", won(bill.vat)],
            ["7", "전력산업기반기금", "전기요금계 × 2.7%", won(bill.fund)],
            ["8", "청구액", "5 + 6 + 7, 10원 미만 버림", won(bill.bill)],
          ],
          note: "복지할인과 자동이체 할인이 없는 경우입니다. TV 수신료는 이 계산과 별개입니다.",
        },
      },
      {
        heading: "기본요금과 전력량요금: 누진제가 적용되는 부분",
        body: [
          `기본요금은 그달 사용량이 들어간 구간에 따라 한 번만 붙습니다. 주택용 저압은 200kWh 이하 ${won(TARIFF.low.tiers[0].basic)}, 201~400kWh ${won(TARIFF.low.tiers[1].basic)}, 400kWh 초과 ${won(TARIFF.low.tiers[2].basic)}입니다. 7~8월에는 구간 경계가 300kWh와 450kWh로 넓어집니다.`,
          `전력량요금은 사용량을 구간별로 나눠 각각 다른 단가를 곱해 더합니다. 처음 200kWh는 ${TARIFF.low.tiers[0].price}원, 201~400kWh 부분은 ${TARIFF.low.tiers[1].price}원, 400kWh를 넘는 부분은 ${TARIFF.low.tiers[2].price}원입니다. ${billKwh}kWh라면 200kWh에는 ${TARIFF.low.tiers[0].price}원, 나머지 ${billKwh - 200}kWh에만 ${TARIFF.low.tiers[1].price}원이 붙습니다. 많이 쓴 달에 사용량 전체가 비싼 단가로 바뀌는 것이 아니라, 경계를 넘은 부분만 비싸집니다.`,
          "전력량요금과 기후환경요금, 연료비조정요금은 각각 원 미만을 버린 뒤 더합니다. 그래서 손으로 계산할 때 소수점까지 그대로 더하면 고지서와 1~2원 차이가 날 수 있습니다.",
        ],
      },
      {
        heading: "기후환경요금: kWh당 9.0원",
        body: [
          `기후환경요금은 깨끗한 에너지로 바꾸는 데 드는 비용을 전기 사용량에 따라 나눠 내는 몫입니다. 2023년 1월부터 kWh당 ${CLIMATE_PRICE.toFixed(1)}원이고, 신재생에너지 의무이행 비용(RPS) ${CLIMATE_PARTS.rps}원, 온실가스 배출권거래 비용(ETS) ${CLIMATE_PARTS.ets}원, 석탄발전 감축 비용 ${CLIMATE_PARTS.coal}원으로 이루어져 있습니다(2026년 11월 확인 기준).`,
          `사용량 전체에 같은 단가가 붙으므로 ${billKwh}kWh면 ${won(bill.climate)}입니다. 누진 구간과 관계없이 쓴 만큼 늘어납니다.`,
        ],
      },
      {
        heading: "연료비조정요금: 분기마다 바뀌는 항목",
        body: [
          `연료비조정요금은 발전에 쓰는 연료값이 오르내린 만큼을 요금에 반영하는 항목입니다. 한전이 분기(3개월)마다 단가를 정하고, kWh당 −${FUEL_LIMIT}원에서 +${FUEL_LIMIT}원 사이에서 움직입니다. 2026년 4분기(10~12월)는 산정 결과가 +${FUEL_CALCULATED_2026Q4}원이었지만 상한이 걸려 +${FUEL_PRICE_2026Q4.toFixed(1)}원이 적용되고 있습니다.`,
          "고지서에서 다른 항목은 그대로인데 이 항목만 바뀌었다면 분기가 바뀌어 단가가 달라진 것입니다. 2027년 1분기(1~3월) 단가는 2026년 11월 확인 때 아직 발표되지 않았습니다. 같은 사용량이라도 단가에 따라 청구액이 어떻게 바뀌는지 계산해 보면 아래와 같습니다.",
        ],
        table: {
          caption: `연료비조정단가에 따른 ${billKwh}kWh 청구액(주택용 저압, 11월)`,
          head: ["연료비조정단가", "연료비조정요금", "청구액"],
          rows: fuelCases.map((f) => {
            const r = el(billKwh, 11, f);
            return [`${f > 0 ? "+" : ""}${f.toFixed(1)}원/kWh`, won(r.fuel), won(r.bill)];
          }),
          note: "연료비조정단가만 바꾸고 다른 요금은 그대로 둔 계산입니다.",
        },
      },
      {
        heading: "부가가치세와 전력산업기반기금",
        body: [
          `부가가치세는 전기요금계의 10%이고 원 미만은 반올림합니다. 전력산업기반기금은 전기요금계의 2.7%로 10원 미만을 버립니다. ${billKwh}kWh 고지서에서는 부가세 ${won(bill.vat)}, 기금 ${won(bill.fund)}입니다.`,
          "기금 요율은 전기사업법 시행령에 정해져 있습니다. 예전에는 3.7%였고, 2024년 6월 시행령 개정으로 2.7%로 낮추면서 2024년 7월부터 1년 동안은 3.2%를 적용했습니다. 그래서 2025년 7월 1일부터 2.7%입니다. 예전 고지서와 비교할 때 이 항목 비율이 다른 것은 이 때문입니다.",
          "마지막으로 전기요금계, 부가세, 기금을 더한 금액에서 10원 미만을 버린 것이 청구액입니다. 한전 기본공급약관에 정해진 끝수 처리입니다.",
        ],
      },
      {
        heading: "같은 사용량인데 여름 고지서가 더 싼 이유",
        body: [
          "7월과 8월(하계)에는 누진 구간의 경계가 200·400kWh에서 300·450kWh로 넓어집니다. 단가 자체는 같지만 싼 단가가 붙는 구간이 길어지므로, 같은 사용량이라도 여름 고지서가 더 적게 나옵니다. 에어컨을 많이 쓰는 여름에 요금 부담을 덜어 주려는 방식입니다.",
          "반대로 겨울에는 구간 경계가 다른 달과 같아 난방기를 쓰면 바로 2구간, 3구간으로 넘어가기 쉽습니다. 12~2월에는 1,000kWh를 넘는 부분에 슈퍼유저 단가도 붙습니다. 아래 표로 11월과 8월 고지서를 같은 사용량으로 비교해 보면 차이가 분명합니다.",
        ],
        table: {
          caption: "같은 사용량의 11월(기타계절)과 8월(하계) 청구액(주택용 저압)",
          head: ["한 달 사용량", "11월 청구액", "8월 청구액", "차이"],
          rows: seasonList.map((k) => {
            const a = el(k, 11).bill;
            const b = el(k, 8).bill;
            return [`${k}kWh`, won(a), won(b), won(a - b)];
          }),
          note: "연료비조정단가는 두 달 모두 2026년 4분기 값(+5.0원)으로 맞춰 계산했습니다. 실제 8월 고지서는 그해 3분기 단가가 적용됩니다.",
        },
      },
      {
        heading: "할인 항목과 고지서에 따로 붙는 것",
        body: [
          `전기요금을 자동이체로 내면 전월 납부액의 ${pct(AUTO_PAY_RATE, 0)}를 ${won(AUTO_PAY_LIMIT)} 한도에서 전기요금계에서 빼 줍니다. 장애인, 국가유공자, 기초생활수급자, 다자녀 가구 같은 복지할인 대상 가구는 할인 금액이 따로 표시됩니다. 복지할인 대상 가운데 월 200kWh 이하를 쓰는 가구에는 추가감액도 있습니다.`,
          "예전에 모든 가구에 적용되던 필수사용량 보장공제(200kWh 이하 사용 가구 공제)는 일반 가구에서 2022년 7월에 없어졌습니다. 그 뒤로는 사용량이 적은 일반 가구도 공제 없이 요금표대로 냅니다.",
          "TV 수신료는 전기요금 계산과 별개의 항목입니다. 아파트는 관리비 고지서에 세대 전기료와 함께 승강기, 복도 조명 같은 공용 설비 전기료가 따로 나뉘어 붙고, 세대 전기료를 나누는 방식도 단지마다 다릅니다. 계산기 결과와 관리비 고지서의 전기료가 다르면 관리사무소에 계산 방식을 확인하세요.",
        ],
      },
      {
        heading: "내 고지서를 계산기로 맞춰 보기",
        body: [
          "고지서에서 사용량(kWh), 사용 기간, 계약종별(주택용 저압 또는 고압)을 찾아 전기요금 계산기에 넣습니다. 연료비조정단가는 고지서의 연료비조정요금을 사용량으로 나누면 알 수 있습니다. 결과의 항목별 금액을 고지서와 한 줄씩 비교하면 어느 항목에서 차이가 나는지 바로 보입니다.",
          "비교할 때는 위에서 본 계산 순서대로 확인하는 것이 빠릅니다. 기본요금이 다르면 사용량이 다른 구간으로 계산된 것이고, 전력량요금이 다르면 사용량 숫자나 계절 구간을 다시 봐야 합니다. 기후환경요금과 연료비조정요금은 사용량에 단가를 곱한 값이라 사용량만 맞으면 대부분 같게 나옵니다. 앞의 항목이 모두 맞는데 청구액만 다르면 할인 항목이나 TV 수신료가 더해지거나 빠졌는지 살펴보세요.",
          "사용 기간이 분기나 계절이 바뀌는 때에 걸쳐 있으면 실제 고지액과 차이가 날 수 있습니다. 차이가 크다면 할인 항목, 사용량 숫자, 계약종별을 다시 확인하고, 그래도 맞지 않으면 한전ON이나 한전 고객센터(국번 없이 123)에 문의하세요.",
        ],
      },
    ],
    sources: [
      { label: "한전ON – 전기요금표(주택용 전력, 전기요금 구조)", url: "https://online.kepco.co.kr/PRM004D00" },
      { label: "한전ON – 원가연계형 요금제(기후환경요금·연료비조정요금)", url: "https://online.kepco.co.kr/PRM097D00" },
      { label: "한전ON – 전기요금계산기(청구액 계산 방법)", url: "https://online.kepco.co.kr/PRM033D00" },
      { label: "국가법령정보센터 – 전기사업법 시행령(제36조 전력산업기반기금 부담금)", url: "https://www.law.go.kr/법령/전기사업법시행령" },
    ],
  },
  {
    slug: "car-tax-december-second-half",
    title: "12월 자동차세 고지서: 2기분 금액 계산과 납부 전에 확인할 것",
    description: "12월 16~31일에 내는 자동차세 2기분이 어떻게 계산되는지, 누가 내는지, 차령 경감과 하반기 등록 차의 차이, 고지서가 오지 않는 경우까지 지방세법 원문으로 정리했습니다.",
    date: "2026-12-16",
    tool: "car-tax",
    sections: [
      {
        heading: "12월에 내는 것은 7~12월분 자동차세입니다",
        body: [
          `자동차세는 1년치를 반으로 나눠 6월과 12월에 냅니다. 12월 16일부터 31일까지 내는 2기분은 7~12월분입니다. 차령 2년 이하인 1,998cc 자가용 승용차라면 12월 고지액은 자동차세 ${won(dec.second.carTax)}에 지방교육세 ${won(dec.second.eduTax)}를 더한 ${won(dec.second.total)}입니다.`,
          `1년 자동차세는 배기량에 cc당 세액을 곱해 구합니다. 1,000cc 이하는 ${CC_RATES[0].perCc}원, 1,600cc 이하는 ${CC_RATES[1].perCc}원, 1,600cc를 넘으면 ${CC_RATES[2].perCc}원이고, 구간을 나누지 않고 배기량 전체에 그 구간 세액을 곱합니다. 여기에 자동차세의 30%인 지방교육세가 함께 붙습니다.`,
        ],
      },
      {
        heading: "누가 내나: 12월 1일 현재 차 주인",
        body: [
          "지방세법은 각 기분의 자동차세를 '납기가 있는 달의 1일 현재의 자동차 소유자'에게 걷는다고 정합니다. 12월분이라면 12월 1일에 차가 등록된 사람이 고지서를 받습니다. 지자체는 늦어도 납기 시작 5일 전까지 고지서를 보내야 합니다.",
          `다만 과세기간 중에 차를 사고판 경우에는 소유권 이전 등록을 하면 가진 기간에 따라 날짜 수로 나눠(일할 계산) 판 사람과 산 사람에게 각각 매깁니다. 차를 폐차해 말소등록한 경우에도 그 기분의 세액을 일할 계산합니다. 이렇게 나눈 세액이 ${n(SMALL_TAX_LIMIT)}원 미만이면 걷지 않습니다.`,
        ],
      },
      {
        heading: "배기량과 차령별 12월 고지액",
        body: [
          "차령이 3년 이상인 배기량 기준 승용차는 차령 3년째부터 해마다 5%씩, 최대 50%까지 자동차세가 줄어듭니다. 차령이 12년을 넘으면 12년으로 봅니다. 아래 표는 1~6월에 처음 등록한 자가용 승용차의 2026년 12월 고지액(지방교육세 포함)입니다.",
        ],
        table: {
          caption: "2026년 12월 자동차세 2기분(지방교육세 포함, 1~6월 등록 차)",
          head: ["배기량", ...ageRows.map((a) => (a <= 2 ? "차령 2년 이하" : `차령 ${a}년`))],
          rows: ccRows.map((cc) => [`${n(cc)}cc`, ...ageRows.map((a) => won(car({ cc, regYear: 2026 - a + 1 }).second.total))]),
          note: "금액마다 10원 미만을 버렸습니다. 지자체 조례로 세율을 달리 정한 곳이나 감면 대상 차는 실제 고지액이 다릅니다.",
        },
        after: [
          `같은 1,998cc라도 차령 2년 이하면 12월에 ${won(dec.second.total)}을 내지만, 차령 12년이 넘으면 절반인 ${won(car({ regYear: 2026 - 12 + 1 }).second.total)}만 냅니다. 오래된 차를 산 사람이라면 고지액이 예상보다 적게 나오는 것이 정상입니다. 반대로 차령이 같은데 전년 12월보다 금액이 줄었다면 경감률이 5%만큼 늘어난 것입니다.`,
          "표의 금액은 그해 1년 내내 같은 사람이 차를 가진 경우입니다. 7월 이후 새로 산 차나 중고로 산 차는 등록일부터 날짜 수만큼만 매기므로 12월 고지서 금액이 표보다 적을 수 있습니다.",
        ],
      },
      {
        heading: "하반기에 등록한 차는 12월분 경감이 먼저 바뀝니다",
        body: [
          "차령은 처음 등록한 해를 1년으로 셉니다. 1~6월에 등록한 차는 같은 해의 1기분과 2기분 차령이 같지만, 7~12월에 등록한 차는 1기분 차령이 1년 적습니다(지방세법 시행령 제122조). 그래서 하반기에 등록한 차는 6월분과 12월분의 경감률이 다를 수 있습니다.",
          `예를 들어 2024년 9월에 처음 등록한 1,998cc 승용차는 2026년 6월분의 차령이 ${lateReg.first.age}년이라 경감이 없지만, 12월분은 차령 ${lateReg.second.age}년이 되어 ${Math.round(lateReg.second.reduction * 100)}%가 줄어듭니다. 6월에 ${won(lateReg.first.total)}을 냈다면 12월에는 ${won(lateReg.second.total)}이 고지됩니다. 6월 고지서와 12월 고지서 금액이 다르다고 해서 잘못 나온 것은 아닙니다.`,
          "제작한 해가 지나서 처음 등록한 차는 제작연도 12월 31일부터 차령을 셉니다. 자동차등록증에서 최초 등록일과 제작연도를 확인해 두면 계산기로 정확한 차령을 넣을 수 있습니다.",
        ],
      },
      {
        heading: "12월 고지서가 오지 않는 경우",
        body: [
          `1년 자동차세가 10만 원 이하인 차는 지자체가 6월에 1년치를 한꺼번에 부과할 수 있습니다. 998cc 경차는 1년 자동차세가 ${won(smallDec.annualCarTax)}, 전기차는 ${won(evDec.annualCarTax)}이라 여기에 해당합니다. 6월에 1년치를 냈다면 12월 고지서는 오지 않습니다. 이때는 12월분에 연 5% 이자율로 계산한 금액을 공제해 줍니다.`,
          "1월이나 3월에 1년치를 미리 냈거나(연납), 6월이나 9월에 7~12월분을 미리 낸 경우에도 12월 고지서는 나오지 않습니다. 연납한 차를 다른 시·군·구로 옮겨 등록해도 새 주소지에서 그해 자동차세를 다시 매기지 않습니다(지방세법 시행령 제125조 제4항).",
          "반대로 연납도 하지 않았고 차도 그대로인데 12월 중순이 지나도 고지서를 받지 못했다면, 위택스나 지자체 누리집에서 고지 내역을 조회해 보세요. 주소가 바뀌어 고지서가 예전 주소로 간 경우가 있습니다.",
        ],
      },
      {
        heading: "한 번에 내기 부담스럽다면: 분할 납부 신청",
        body: [
          "6월과 12월에 한 번씩 내는 금액이 부담스럽다면 1년에 네 번으로 나눠 낼 수도 있습니다. 지방세법 제128조 제1항은 납세자가 신청하면 1기분 세액의 절반을 3월 16~31일에, 2기분 세액의 절반을 9월 16~30일에 먼저 걷고, 나머지를 6월과 12월 정기분에서 걷도록 정합니다. 신청 방법과 기한은 차가 등록된 시·군·구에 확인하세요.",
          "분할 납부는 내는 시기만 나누는 것이라 공제는 없습니다. 1년 합계는 6월·12월에 두 번 낼 때와 같고, 1월에 1년치를 미리 내는 연납보다는 많습니다. 목돈 부담을 줄이는 방법과 세금을 줄이는 방법이 다르다는 점을 기억해 두세요.",
        ],
        table: {
          caption: "2027년 자동차세를 네 번에 나눠 낼 때(지방교육세 포함, 1~6월 등록 차)",
          head: ["배기량·차령", "3월", "6월", "9월", "12월", "1년 합계", "1월 연납"],
          rows: splitCars.map(({ label, input }) => {
            const r = calcCarTax({ kind: "cc", cc: 1_998, taxYear: 2027, regYear: 2026, regMonth: 3, ...input });
            const [q1, q2] = splitHalf(r.first.total);
            const [q3, q4] = splitHalf(r.second.total);
            return [label, won(q1), won(q2), won(q3), won(q4), won(r.annualTotal), won(r.prepay[0].total)];
          }),
          note: "각 기분 세액을 반으로 나눠 10원 미만을 버리고, 남는 끝수는 먼저 내는 달에 붙였습니다. 실제 분할 금액은 지자체 고지서를 따르세요.",
        },
      },
      {
        heading: "기한 안에 내야 하는 이유와 내년 연납",
        body: [
          "납기를 넘기면 가산세가 붙고, 자동차세를 계속 내지 않으면 지자체가 자동차등록번호판을 영치할 수 있습니다(지방세법 제131조). 고지서의 가상계좌, 위택스, 지자체 납부 시스템 등으로 낼 수 있으니 12월 31일 전에 처리해 두세요.",
          `2027년 자동차세를 줄이고 싶다면 1월 16일부터 31일 사이에 1년치를 미리 내는 연납을 신청할 수 있습니다. 2월부터 12월까지 남은 기간에 연 ${pct(PREPAY_INTEREST, 0)}를 곱한 만큼 공제해, 실제로는 1년 세액의 약 ${pct(janRate, 1)}가 줄어듭니다. 한 번 연납한 사람에게는 지자체가 다음 해 1월에 연납 납부서를 보낼 수 있습니다(지방세법 시행령 제125조 제2항).`,
          "자동차세 계산기에 배기량, 최초 등록 연월, 계산할 연도를 넣으면 6월분과 12월분, 연납했을 때의 금액을 한 번에 볼 수 있습니다. 감면 대상 차, 영업용 차, 승합·화물차는 계산 방식이 달라 차가 등록된 시·군·구에 확인하세요.",
        ],
      },
    ],
    sources: [
      { label: "국가법령정보센터 – 지방세법(제127조 세율, 제128~131조 납기·일할 계산·번호판 영치)", url: "https://www.law.go.kr/법령/지방세법" },
      { label: "국가법령정보센터 – 지방세법 시행령(제122조 차령, 제125조 연납, 제126조 일할 계산)", url: "https://www.law.go.kr/법령/지방세법시행령" },
      { label: "내 손안에 서울 – 자동차세 연납 안내와 계산 예시", url: "https://mediahub.seoul.go.kr/archives/2013200" },
    ],
  },
  {
    slug: "car-tax-january-prepay-2027",
    title: "2027년 1월 자동차세 연납: 신청 기간, 할인액 계산, 차를 팔면 어떻게 되나",
    description: "2027년 1월 16~31일에 자동차세를 1년치 미리 내면 얼마가 줄어드는지 배기량·차령별로 계산하고, 3·6·9월 연납과 비교했습니다. 연납 뒤 차를 팔거나 폐차·이사할 때의 처리도 지방세법으로 정리했습니다.",
    date: "2026-12-29",
    tool: "car-tax",
    sections: [
      {
        heading: "1월에 1년치를 내면 약 4.6%가 줄어듭니다",
        body: [
          `자동차세 연납은 1년치 자동차세를 미리 한꺼번에 내고 남은 기간만큼 공제를 받는 제도입니다. 2027년 1월 16일부터 31일 사이에 신청해 내면, 2월 1일부터 12월 31일까지 334일분에 연 ${pct(PREPAY_INTEREST, 0)}를 곱한 만큼을 빼 줍니다. 실제 할인 비율은 1년 자동차세의 약 ${pct(janRate, 3)}입니다.`,
          `차령 2년 이하인 1,998cc 자가용 승용차라면 1년 자동차세 ${won(jan.annualCarTax)}에서 ${won(jan.prepay[0].discount)}이 공제됩니다. 지방교육세까지 더하면 6월과 12월에 나눠 낼 때 모두 ${won(jan.annualTotal)}인데, 1월에 연납하면 ${won(jan.prepay[0].total)}을 냅니다.`,
        ],
      },
      {
        heading: "공제액 계산식과 2027년 이자율",
        body: [
          "1월 연납 공제액은 '1년 자동차세 × (납부기한 다음 날부터 12월 31일까지 일수 ÷ 365) × 이자율'입니다(지방세법 제128조 제3항). 윤년에는 366으로 나눕니다. 공제액은 해당 세액의 10%를 넘을 수 없고, 10원 미만은 버립니다.",
          `이자율은 지방세법 시행령 제125조 제6항에 '100분의 5'로 정해져 있습니다. 이 값은 2024년 12월 개정 때 기한 없이 5%로 정해졌고, 2026년 11월 확인 기준으로 2027년 1월 연납에도 그대로 적용됩니다. 예전에 10%, 7%였던 공제율은 해마다 낮아져 왔으므로, 인터넷에서 오래된 안내를 볼 때는 적용 연도를 확인하세요.`,
        ],
      },
      {
        heading: "배기량·차령별 2027년 1월 연납 금액",
        body: [
          "아래 표는 1~6월에 처음 등록한 자가용 승용차가 2027년 1월에 연납할 때 내는 금액과 6월·12월에 나눠 낼 때의 합계를 비교한 것입니다. 지방교육세를 포함했습니다.",
        ],
        table: {
          caption: "2027년 자동차세: 나눠 낼 때와 1월 연납(지방교육세 포함)",
          head: ["배기량", "차령", "6월+12월 합계", "1월 연납", "줄어드는 금액"],
          rows: [998, 1_598, 1_998, 2_497, 3_342].flatMap((cc) =>
            [2, 6, 10].map((age) => {
              const r = pre({ cc, regYear: 2027 - age + 1, regMonth: 3 });
              return [`${n(cc)}cc`, age <= 2 ? "2년 이하" : `${age}년`, won(r.annualTotal), won(r.prepay[0].total), won(r.annualTotal - r.prepay[0].total)];
            }),
          ),
          note: "1년 자동차세가 10만 원 이하인 차(경차 등)는 지자체가 6월에 1년치를 한꺼번에 부과할 수 있고, 이때는 7~12월분에서 공제한 금액을 냅니다. 지자체 고지서의 끝수 처리에 따라 10원 안팎 차이가 날 수 있습니다.",
        },
      },
      {
        heading: "1월을 놓쳤다면: 3월·6월·9월 연납",
        body: [
          "연납은 1월 말고도 3월, 6월, 9월의 16일부터 말일까지 신청할 수 있습니다. 3월에는 1년치를 내고 4월부터 12월까지의 기간만큼 공제받습니다. 6월과 9월에는 1~6월분을 6월 정기분으로 내고, 7~12월분만 미리 내면서 공제받습니다. 늦게 낼수록 공제가 줄어듭니다.",
        ],
        table: {
          caption: "1,998cc 승용차(차령 2년 이하)의 신청 시기별 2027년 연납 공제",
          head: ["신청 시기", "공제 기준", "자동차세 공제액", "공제 비율"],
          rows: jan.prepay.map((p) => [PREPAY_MONTH_LABEL[p.month], p.month <= 3 ? `1년 자동차세 ${won(p.base)}` : `7~12월분 ${won(p.base)}`, won(p.discount), pct(p.discount / p.base, 2)]),
          note: "공제 비율은 공제 기준 세액에 대한 비율입니다. 6월과 9월에는 1~6월분을 따로 정기분으로 냅니다.",
        },
        after: [
          "같은 차라도 1월에 내면 1년 세액의 약 4.6%, 9월에 내면 7~12월분의 2.5%만 줄어듭니다. 목돈이 부담스럽지 않다면 1월에 내는 것이 가장 유리합니다.",
        ],
      },
      {
        heading: "연납 대신 그 돈을 예금에 넣어 두면?",
        body: [
          "연납이 정말 이득인지 따져 보려면, 1월에 낼 돈을 예금에 넣어 두었다가 6월과 12월에 나눠 내는 경우와 비교하면 됩니다. 6월분은 1월 말부터 약 5개월, 12월분은 약 11개월 동안 이자를 받을 수 있습니다. 예금 이자에는 이자소득세 15.4%(지방소득세 포함)가 붙습니다.",
          `아래 표는 그렇게 받을 수 있는 세후 이자(단리, 월 단위로 단순 계산)를 연납 때 줄어드는 금액과 나란히 놓은 것입니다. 예금 금리는 비교를 위한 가정입니다. 연 ${pct(depositRates[depositRates.length - 1], 1)} 예금에 넣어 두어도 받는 이자가 연납으로 줄어드는 금액보다 적어, 목돈이 있다면 1월 연납이 유리합니다.`,
        ],
        table: {
          caption: "2027년 1월 연납으로 줄어드는 금액과 예금 세후 이자 비교(차령 2년 이하, 지방교육세 포함)",
          head: ["차", "연납으로 줄어드는 금액", ...depositRates.map((r) => `예금 연 ${pct(r, 1)}일 때 세후 이자`)],
          rows: depositCars.map(({ label, input }) => {
            const r = pre(input);
            return [label, won(r.annualTotal - r.prepay[0].total), ...depositRates.map((rate) => won(depositInterest(r, rate)))];
          }),
          note: "6월분과 12월분 세액을 각각 5개월, 11개월 동안 예금에 둔다고 가정하고 이자소득세 15.4%를 뺐습니다. 예금 상품마다 금리와 이자 계산 방식이 다릅니다.",
        },
        after: [
          "다만 연납은 1년치를 한 번에 내야 하므로, 비상금까지 털어 내야 한다면 무리할 필요는 없습니다. 생활비가 빠듯한 달이 걱정된다면 1월 연납 대신 6월·12월 정기분이나 분할 납부를 고르는 편이 낫습니다.",
        ],
      },
      {
        heading: "연납한 뒤 차를 팔거나 폐차하면",
        body: [
          "연납을 했더라도 그해 중간에 차를 팔 수 있습니다. 지방세법은 과세기간 중에 차를 사고판 경우 소유권 이전 등록을 하면 가진 기간에 따라 자동차세를 날짜 수로 나눠 판 사람과 산 사람에게 각각 매긴다고 정합니다(제129조). 판 사람이 1년치를 이미 냈다면, 판 사람이 동의하는 경우 산 사람이 그 기간의 세금을 낸 것으로 봅니다(제130조 제3항).",
          "차를 폐차해 말소등록하면 말소등록일이 속한 기분의 세액을 일할 계산합니다(제130조 제1항). 연납으로 미리 낸 돈 가운데 차를 갖지 않은 기간의 몫을 돌려받을 수 있는지, 언제 어떻게 돌려받는지는 차가 등록돼 있던 시·군·구 세무 부서나 위택스에서 확인하세요.",
          "이사는 걱정하지 않아도 됩니다. 연납한 뒤 차의 사용본거지를 다른 시·군·구로 옮겨도 새 주소지에서는 그해 자동차세를 다시 매기지 않습니다(지방세법 시행령 제125조 제4항).",
        ],
      },
      {
        heading: "신청 방법과 확인할 것",
        body: [
          "연납은 납부서에 과세 대상과 세액을 적어 시장·군수·구청장에게 신고하고 내는 방식입니다(지방세법 시행령 제125조 제2항). 실제로는 위택스나 지자체의 지방세 납부 시스템에서 연납 신청과 납부를 함께 할 수 있습니다. 한 번 연납한 사람에게는 지자체가 다음 해 1월 중에 연납 납부서를 보낼 수 있어, 그 납부서로 이어서 낼 수도 있습니다.",
          "신청 기간은 1월 16일부터 31일까지로 짧습니다. 기한이 주말에 걸리거나 시스템 사정으로 바뀌면 지자체 공지를 따르세요. 장애인용 차처럼 감면받는 차, 영업용 차, 2027년에 새로 등록할 차는 연납 금액이 다르니 차가 등록된 시·군·구에 확인하는 것이 정확합니다.",
          "자동차세 계산기에 배기량과 최초 등록 연월을 넣고 계산할 연도를 2027년으로 고르면, 6월·12월에 나눠 낼 때와 1월·3월·6월·9월에 연납할 때의 금액을 한 번에 비교할 수 있습니다.",
        ],
      },
    ],
    sources: [
      { label: "국가법령정보센터 – 지방세법(제128조 연납, 제129·130조 일할 계산)", url: "https://www.law.go.kr/법령/지방세법" },
      { label: "국가법령정보센터 – 지방세법 시행령(제125조 연납 신고와 이자율, 제126조 일할 계산)", url: "https://www.law.go.kr/법령/지방세법시행령" },
      { label: "내 손안에 서울 – 자동차세 1월 연납 안내와 계산 예시", url: "https://mediahub.seoul.go.kr/archives/2013200" },
      { label: "서울시 – 2026년 1월 자동차세 연납 안내", url: "https://news.seoul.go.kr/gov/archives/574407" },
    ],
  },
];
