import { RATES } from "@/data/rates/2026";
import { calcSocialInsurance, INDUSTRIAL_RATES, STABILITY_RATES, type StabilityKey } from "@/lib/calculators/socialInsurance";
import type { ContentSection } from "@/data/content";
import type { ToolExtra } from "../types";

const n = (v: number) => Math.round(v).toLocaleString("ko-KR");
const won = (v: number) => `${n(v)}원`;
const man = (v: number) => `${n(v / 10_000)}만 원`;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

const Y = RATES.year;
const OFFICE = 6.6; // 전문·보건·교육·여가 관련 서비스업(2026년, 천분율)
const calc = (monthlyPay: number, stability: StabilityKey = "under150", industrialPermille = OFFICE) =>
  calcSocialInsurance({ monthlyPay, monthlyNonTaxable: 0, stability, industrialPermille });
const get = (r: ReturnType<typeof calc>, key: string) => r.rows.find((x) => x.key === key)!;

const ex = calc(3_000_000);
const payLevels = [2_156_880, 2_500_000, 3_000_000, 4_000_000, 5_000_000, 7_000_000];
const industries = ["000", "907", "910", "218", "501", "400"].map((c) => INDUSTRIAL_RATES.find((x) => x.code === c)!);

const sections: ContentSection[] = [
  {
    heading: "계산 예시: 월 보수 300만 원이면",
    body: [
      `비과세를 뺀 월 보수 300만 원, 150명 미만 회사, 산재보험료율 1,000분의 ${OFFICE}(전문·보건·교육·여가 관련 서비스업)로 계산하면 아래와 같습니다. 근로자는 국민연금·건강보험·장기요양보험·고용보험 네 가지를 내고, 회사는 같은 금액에 고용안정·직업능력개발사업 보험료, 산재보험료, 부담금을 더 냅니다.`,
    ],
    table: {
      caption: `월 보수 300만 원의 4대보험료(${Y}년 요율)`,
      head: ["항목", "계산", "근로자", "회사"],
      rows: [
        ["국민연금", `기준소득월액 ${n(ex.pensionBase)} × ${pct(RATES.pension.rate, 2)}`, won(get(ex, "pension").employee), won(get(ex, "pension").employer)],
        ["건강보험", `보수 × ${pct(RATES.health.rate, 3)}`, won(get(ex, "health").employee), won(get(ex, "health").employer)],
        ["장기요양보험", `건강보험료 × ${pct(RATES.longTermCare.rateOfHealth, 2)}`, won(get(ex, "longTermCare").employee), won(get(ex, "longTermCare").employer)],
        ["고용보험(실업급여)", `보수 × ${pct(RATES.employment.rate, 1)}`, won(get(ex, "unemployment").employee), won(get(ex, "unemployment").employer)],
        ["고용안정·직업능력개발", "보수 × 0.25%(회사만)", "-", won(get(ex, "stability").employer)],
        ["산재보험", `보수 × ${OFFICE}/1,000(회사만)`, "-", won(get(ex, "industrial").employer)],
        ["임금채권부담금", "보수 × 0.6/1,000(회사만)", "-", won(get(ex, "wageClaim").employer)],
        ["석면피해구제분담금", "보수 × 0.06/1,000(회사만)", "-", won(get(ex, "asbestos").employer)],
        ["합계", "", won(ex.employeeTotal), won(ex.employerTotal)],
      ],
      note: "항목마다 10원 미만을 버렸습니다. 실제 고지액은 공단이 보험료 전체를 먼저 계산한 뒤 나누기 때문에 10원 안팎 차이가 날 수 있습니다.",
    },
    after: [
      `이 예에서 근로자는 보수의 ${pct(ex.employeeTotal / ex.base)}, 회사는 ${pct(ex.employerTotal / ex.base)}를 냅니다. 월급 300만 원인 직원 한 명에게 회사가 실제로 쓰는 돈은 한 달 약 ${man(ex.companyCost)}입니다.`,
    ],
  },
  {
    heading: "월 보수별 근로자·회사 부담",
    body: [
      `월 보수가 오르면 보험료도 거의 같은 비율로 오릅니다. 다만 국민연금은 기준소득월액 상한 ${n(RATES.pension.maxBase)}원까지만 매기기 때문에, 월 보수가 상한을 넘으면 국민연금은 더 늘지 않습니다. 첫 줄의 ${n(payLevels[0])}원은 ${Y}년 최저임금(시급 ${n(RATES.minimumWage)}원 × 209시간)입니다.`,
    ],
    table: {
      caption: `월 보수별 4대보험료(150명 미만, 산재 ${OFFICE}/1,000, ${Y}년 요율)`,
      head: ["월 보수", "국민연금(각자)", "근로자 합계", "회사 합계", "회사가 쓰는 한 달 인건비"],
      rows: payLevels.map((pay) => {
        const r = calc(pay);
        return [won(pay), won(get(r, "pension").employee), won(r.employeeTotal), won(r.employerTotal), won(r.companyCost)];
      }),
      note: "비과세 없이 월 보수 전체가 보험료 기준이라고 가정했습니다. 식대처럼 비과세 금액이 있으면 그만큼 기준이 줄어듭니다.",
    },
  },
  {
    heading: "회사 규모와 업종에 따라 달라지는 회사 부담",
    body: [
      "근로자가 내는 금액은 회사 규모나 업종과 관계없이 같습니다. 달라지는 것은 회사만 내는 두 가지, 고용안정·직업능력개발사업 보험료(회사 규모)와 산재보험료(업종)입니다. 같은 월 보수 300만 원으로 바꿔 보면 차이가 꽤 납니다.",
    ],
    table: {
      caption: "월 보수 300만 원의 회사 부담(업종 × 회사 규모)",
      head: ["업종(산재보험료율)", ...STABILITY_RATES.map((s) => `${s.label}(${pct(s.rate, 2)})`)],
      rows: industries.map((ind) => [
        `${ind.label}(${ind.permille}/1,000)`,
        ...STABILITY_RATES.map((s) => won(calc(3_000_000, s.key, ind.permille).employerTotal)),
      ]),
      note: `산재보험료율은 ${Y}년 사업종류별 요율(출퇴근재해 1,000분의 0.6 포함)입니다. 재해 발생 실적에 따라 요율이 할인·할증되는 사업장은 실제 금액이 다릅니다.`,
    },
    after: [
      "건설업처럼 산재보험료율이 높은 업종은 같은 월급이라도 회사 부담이 눈에 띄게 큽니다. 직원을 처음 뽑는 작은 가게라면 대부분 150명 미만(0.25%) 칸을 보면 됩니다.",
    ],
  },
  {
    heading: "급여명세서와 맞춰 볼 때 확인할 것",
    body: [
      "급여명세서의 4대보험 공제액이 계산기와 다르면 먼저 보험료 기준 보수를 확인하세요. 회사는 매달 실제로 받은 월급이 아니라 공단에 신고한 보수월액과 기준소득월액으로 보험료를 냅니다. 연봉이 오른 직후나 입사 첫해에는 신고 금액이 예전 기준이어서 몇 달 동안 차이가 날 수 있습니다.",
      "건강보험료는 매년 4월에 전년도 실제 보수로 다시 계산해 차액을 걷거나 돌려줍니다. 성과급을 받은 다음 해 4월 월급에서 건강보험료가 크게 빠지는 이유가 이것입니다. 국민연금은 정산 없이, 보통 7월에 바뀐 기준소득월액으로 그다음 1년을 냅니다.",
      "입사한 달과 퇴사한 달은 공단마다 보험료를 매기는 방식이 달라 계산기와 맞지 않을 수 있습니다. 정확한 금액은 회사 급여 담당자나 국민연금공단·국민건강보험공단·근로복지공단에 확인하세요.",
    ],
  },
];

export const socialInsuranceExtra: ToolExtra = {
  updated: "2026-11-27",
  sections,
  sources: [
    { label: "근로복지공단 – 보험료율(산재보험 사업종류별 요율, 고용보험 사업별 보험료율)", url: "https://www.comwel.or.kr/comwel/paym/paym/tari.jsp" },
    { label: "국민연금공단 – 연금보험료 안내", url: "https://nps.or.kr/pnsinfo/ntpsklg/getOHAF0097M0.do" },
    { label: "국민건강보험공단 – 2026년 건강보험료율 안내", url: "https://www.nhis.or.kr/renewal_popup/poster/20260204_poster_longdesc_1.html" },
    { label: "국가법령정보센터 – 고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률", url: "https://www.law.go.kr/법령/고용보험및산업재해보상보험의보험료징수등에관한법률" },
  ],
};
