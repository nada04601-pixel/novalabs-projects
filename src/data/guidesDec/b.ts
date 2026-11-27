import type { Guide } from "@/data/guides";
import { RATES } from "@/data/rates/2026";
import { calcLoan } from "@/lib/calculators/loan";
import { calcSavings } from "@/lib/calculators/savings";
import { changePercent, percentOf, ratioPercent } from "@/lib/calculators/percent";
import { depositToRent, legalConversionCap } from "@/lib/calculators/rentConversion";
import { calcSavingsGoal } from "@/lib/calculators/savingsGoal";
import { calcNetSalary } from "@/lib/calculators/netSalary";

// 묶음 b: 2026년 12월 공개 가이드(전세대출·청약저축·계약갱신·금리인하요구권·예금 재예치·가계부 결산·새해 저축 목표).
// 표 안의 금액은 모두 이 사이트 계산기 함수나 아래 식으로 빌드할 때 계산합니다.

const n = (v: number) => Math.round(v).toLocaleString("ko-KR");
const won = (v: number) => `${n(v)}원`;
const man = (v: number) => `${n(v / 10_000)}만 원`;
const pct = (r: number, d = 1) => `${(r * 100).toFixed(d)}%`;
// 큰 금액을 "2억 원", "1억 2,000만 원", "8,000만 원"처럼 보여 줍니다.
const eok = (v: number) => {
  const e = Math.floor(v / 100_000_000);
  const rest = Math.round((v - e * 100_000_000) / 10_000);
  if (e === 0) return man(v);
  return rest === 0 ? `${e}억 원` : `${e}억 ${n(rest)}만 원`;
};

// 소득세 한계세율(과세표준 구간 세율)에 지방소득세 10%를 더한 실제 세율
const marginal = (rate: number) => rate * (1 + RATES.localTaxRate);
const BRACKET_15 = RATES.incomeTax.brackets[1].rate; // 과세표준 1,400만~5,000만 원 구간 15%
const BRACKET_24 = RATES.incomeTax.brackets[2].rate; // 과세표준 5,000만~8,800만 원 구간 24%

// ───────────── 1. 전세자금대출 이자 ─────────────
const J_AMOUNTS = [100_000_000, 200_000_000];
const J_RATES = [0.03, 0.035, 0.04, 0.045, 0.05];
const J_MONTHS = 24; // 전세 계약 2년에 맞춘 대출 기간
const bullet = (amount: number, rate: number) => calcLoan(amount, rate, J_MONTHS, "bullet");
const jHead = bullet(100_000_000, 0.04);
const jGap = bullet(200_000_000, 0.045).firstPayment - bullet(200_000_000, 0.04).firstPayment;
const jGapTotal = bullet(200_000_000, 0.045).totalInterest - bullet(200_000_000, 0.04).totalInterest;
// 같은 2억 원을 2년 원리금균등으로 갚으면 매달 얼마인지(만기일시와 비교)
const jAnnuity = calcLoan(200_000_000, 0.04, J_MONTHS, "annuity");

// 한국주택금융공사 일반전세자금보증 기준보증료율(임차보증금 구간별, 연 비율). 우대가구 등은 여기에 가감합니다.
// 출처: 한국주택금융공사 일반전세자금보증(https://www.hf.go.kr/ko/sub02/sub02_01_02.do), 확인 2026-11-27
const HF_GUARANTEE_FEE: { label: string; rate: number }[] = [
  { label: "1억 원 이하", rate: 0.0006 },
  { label: "1억 원 초과 ~ 2억 원 이하", rate: 0.0008 },
  { label: "2억 원 초과 ~ 3억 원 이하", rate: 0.001 },
  { label: "3억 원 초과 ~ 4억 원 이하", rate: 0.0012 },
  { label: "4억 원 초과 ~ 5억 원 이하", rate: 0.0014 },
  { label: "5억 원 초과", rate: 0.002 },
];

// 버팀목전세자금 대출금리(변동금리, 국토교통부 고시). 행: 부부합산 연소득, 열: 임차보증금 5천만 원 이하 / 5천만~1억 원 / 1억 원 초과.
// 지방 소재 주택은 0.2%p 인하. 대출한도 수도권 1.2억 원·수도권 외 8천만 원(일반가구), 전세금의 70% 이내.
// 출처: 주택도시기금 버팀목전세자금(https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020101.jsp), 확인 2026-11-27
const BEOTIM_RATES: { income: string; rates: [number, number, number] }[] = [
  { income: "2천만 원 이하", rates: [0.025, 0.026, 0.027] },
  { income: "2천만 원 초과 ~ 4천만 원 이하", rates: [0.027, 0.028, 0.029] },
  { income: "4천만 원 초과 ~ 6천만 원 이하", rates: [0.03, 0.031, 0.032] },
  { income: "6천만 원 초과 ~ 7.5천만 원 이하", rates: [0.033, 0.034, 0.035] },
];
const BEOTIM_LOCAL_CUT = 0.002;
const BEOTIM_LIMIT_CAPITAL = 120_000_000;
const BEOTIM_LIMIT_OTHER = 80_000_000;
const BEOTIM_LTV = 0.7;
const BEOTIM_NET_ASSET = 345_000_000;
const beotimMin = Math.min(...BEOTIM_RATES.flatMap((r) => r.rates));
const beotimMax = Math.max(...BEOTIM_RATES.flatMap((r) => r.rates));
// 예: 연소득 4,500만 원 가구가 수도권 보증금 2억 원 전셋집에 버팀목 한도(1.2억 원)를 빌리는 경우와,
// 같은 금액을 연 4.5%(가정) 은행 전세대출로 빌리는 경우
const bEx = { deposit: 200_000_000, rate: BEOTIM_RATES[2].rates[2], bankRate: 0.045 };
const bExAmount = Math.min(BEOTIM_LIMIT_CAPITAL, bEx.deposit * BEOTIM_LTV);
const bExPolicy = bullet(bExAmount, bEx.rate).firstPayment;
const bExBank = bullet(bExAmount, bEx.bankRate).firstPayment;

// 주택임차차입금 원리금 상환액 소득공제: 상환액의 40%, 주택청약종합저축 공제와 합쳐 연 400만 원 한도.
// 출처: 소득세법 제52조제4항(https://www.law.go.kr/법령/소득세법), 국세청 연말정산 맞춤형 안내
// (https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=40609&cntntsId=239021), 확인 2026-11-27
const LEASE_LOAN_DEDUCTION_RATE = 0.4;
const HOUSING_DEDUCTION_LIMIT = 4_000_000;
const leaseCases = [
  { amount: 100_000_000, rate: 0.035 },
  { amount: 100_000_000, rate: 0.045 },
  { amount: 200_000_000, rate: 0.035 },
  { amount: 200_000_000, rate: 0.045 },
  { amount: 300_000_000, rate: 0.04 },
].map((c) => {
  const yearInterest = calcLoan(c.amount, c.rate, 12, "bullet").totalInterest;
  const deduction = Math.min(yearInterest * LEASE_LOAN_DEDUCTION_RATE, HOUSING_DEDUCTION_LIMIT);
  return { ...c, yearInterest, deduction, save15: deduction * marginal(BRACKET_15), save24: deduction * marginal(BRACKET_24) };
});
const leaseCapInterest = HOUSING_DEDUCTION_LIMIT / LEASE_LOAN_DEDUCTION_RATE;

const jeonseLoanGuide: Guide = {
    slug: "jeonse-loan-interest",
    title: "전세자금대출 이자 계산: 1억·2억 빌리면 매달 얼마 낼까",
    description:
      "전세대출 금액과 금리별 월 이자, 보증서와 보증료의 뜻, 버팀목 전세대출 금리표, 연말정산 주택임차차입금 소득공제까지 계산 예시로 정리했습니다.",
    date: "2026-12-01",
    tool: "loan-interest",
    sections: [
      {
        heading: "만기일시상환이면 매달 이자만 냅니다",
        body: [
          `전세대출 ${eok(100_000_000)}을 연 ${pct(0.04)} 금리에 만기일시상환으로 빌리면 매달 내는 이자는 약 ${won(jHead.firstPayment)}입니다. 2년 동안 내는 이자는 모두 약 ${man(jHead.totalInterest)}이고, 원금 ${eok(100_000_000)}은 계약이 끝날 때 집주인에게 돌려받은 보증금으로 한 번에 갚습니다.`,
          "만기일시상환은 대출 기간 동안 원금은 그대로 두고 이자만 내다가 만기에 원금을 모두 갚는 방식입니다. 전세 보증금은 계약이 끝나면 돌려받는 돈이라 전세대출은 이 방식을 많이 씁니다. 매달 이자는 '대출금 × 연 금리 ÷ 12'로 바로 구할 수 있습니다.",
        ],
        table: {
          caption: `전세대출 금액·금리별 월 이자와 ${J_MONTHS}개월 이자 합계 (만기일시상환)`,
          head: ["연 금리", `${eok(J_AMOUNTS[0])} 월 이자`, `${eok(J_AMOUNTS[0])} 2년 이자`, `${eok(J_AMOUNTS[1])} 월 이자`, `${eok(J_AMOUNTS[1])} 2년 이자`],
          rows: J_RATES.map((r) => {
            const a = bullet(J_AMOUNTS[0], r);
            const b = bullet(J_AMOUNTS[1], r);
            return [pct(r), won(a.firstPayment), man(a.totalInterest), won(b.firstPayment), man(b.totalInterest)];
          }),
          note: "이 사이트 대출이자 계산기와 같은 식(월 이자 = 대출금 × 연 금리 ÷ 12)으로 계산했습니다. 실제 대출은 날짜 수로 이자를 매겨 달마다 몇백 원씩 차이가 납니다. 보증료·인지세는 빠져 있습니다.",
        },
        after: [
          `금리 차이는 작아 보여도 금액이 크면 부담이 커집니다. ${eok(200_000_000)}을 빌릴 때 금리가 연 ${pct(0.04)}에서 ${pct(0.045)}로 0.5%포인트만 올라도 매달 이자가 약 ${won(jGap)} 늘고, 2년이면 약 ${man(jGapTotal)}을 더 냅니다.`,
          `같은 ${eok(200_000_000)}을 2년 원리금균등으로 갚는다면 매달 약 ${man(jAnnuity.firstPayment)}을 내야 합니다. 전세대출을 만기일시로 쓰는 이유가 여기에 있습니다. 다만 원금이 줄지 않으니 계약을 연장할 때마다 같은 원금에 이자가 계속 붙는다는 점은 기억해 두세요.`,
        ],
      },
      {
        heading: "보증서는 집 대신 담보가 되어 줍니다",
        body: [
          "전세대출은 내 집을 담보로 잡을 수 없기 때문에 은행은 보증기관이 발급한 보증서를 담보로 받는 경우가 많습니다. 세입자가 이자나 원금을 갚지 못하면 보증기관이 은행에 대신 갚아 주고, 나중에 세입자에게 그 돈을 받아 가는 구조입니다. 대표적인 보증기관은 한국주택금융공사(HF), 주택도시보증공사(HUG)이고, 서울보증보험(SGI)의 보험을 담보로 하는 상품도 있습니다.",
          "주택도시기금의 버팀목전세자금 안내를 보면 담보를 HF 전세대출보증, HUG 전세금안심대출보증, 협약기관 반환채권양도 가운데 하나로 고릅니다. HUG 전세금안심대출보증은 전세보증금 반환보증과 대출보증이 묶여 있어 따로 떼어 가입할 수 없고, HF 전세자금보증은 대출보증이며 전세보증금 반환보증은 별도로 가입할 수 있습니다.",
          "보증을 받는 대가로 내는 수수료가 보증료입니다. 보증료율은 연 비율로 표시하는데, 연 0.1%라면 보증 금액 1억 원당 1년에 10만 원 꼴입니다. 금리보다 훨씬 작은 숫자지만 대출 금액이 크면 무시하기 어려우니, 금리와 함께 전체 비용에 넣어 비교하세요.",
        ],
        table: {
          caption: "한국주택금융공사 일반전세자금보증 기준보증료율 (임차보증금 구간별, 연)",
          head: ["임차보증금", "기준보증료율"],
          rows: HF_GUARANTEE_FEE.map((f) => [f.label, `연 ${pct(f.rate, 2)}`]),
          note: "2026년 11월 확인 기준. 기준보증료율에 우대가구 등 조정 사항을 더하거나 빼서 최종 보증료율이 정해지며, 공사 안내에는 보증금·소득 등에 따라 연 0.02~0.40%로 차등 적용한다고 되어 있습니다. 실제 보증료는 취급은행에서 산정합니다.",
        },
        after: [
          "보증료 말고도 대출 약정 때 인지세가 붙습니다. 버팀목전세자금은 인지세를 고객과 은행이 절반씩 부담한다고 안내합니다. 은행 상품은 상품 설명서에 부대비용이 적혀 있으니 금리와 함께 비교하세요.",
        ],
      },
      {
        heading: "정책 전세대출 버팀목의 금리 범위",
        body: [
          `주택도시기금의 버팀목전세자금은 2026년 11월 확인 기준 연 ${pct(beotimMin)}~${pct(beotimMax)}의 변동금리(국토교통부 고시)입니다. 부부합산 연소득과 임차보증금이 많을수록 금리가 조금씩 높아지고, 대출 대상 주택이 지방에 있으면 ${pct(BEOTIM_LOCAL_CUT)}포인트를 깎아 줍니다.`,
          `기본 대상은 부부합산 연소득 5천만 원 이하, 순자산 ${eok(BEOTIM_NET_ASSET)} 이하인 무주택 세대주입니다(신혼부부는 7,500만 원, 다자녀·2자녀 가구 등은 6천만 원까지). 일반가구 한도는 수도권 ${eok(BEOTIM_LIMIT_CAPITAL)}, 수도권 외 ${eok(BEOTIM_LIMIT_OTHER)}이고 전세금의 ${pct(BEOTIM_LTV, 0)} 이내입니다. 대출 기간은 2년이며 연장해 최장 10년까지 쓸 수 있고, 중도상환수수료는 없습니다.`,
        ],
        table: {
          caption: "버팀목전세자금 대출금리 (부부합산 연소득 × 임차보증금, 연 변동금리)",
          head: ["부부합산 연소득", "보증금 5천만 원 이하", "5천만 원 초과 ~ 1억 원 이하", "1억 원 초과"],
          rows: BEOTIM_RATES.map((r) => [r.income, ...r.rates.map((x) => pct(x))]),
          note: "2026년 11월 주택도시기금 누리집 확인 기준. 연소득 5천만 원 초과 구간은 신혼부부·다자녀 가구 등 소득 기준이 높은 가구에 해당합니다. 자녀·한부모·기초생활수급 등 우대금리와 자산심사 결과에 따른 가산금리는 반영하지 않았습니다.",
        },
        after: [
          `예를 들어 부부합산 연소득 4,500만 원인 가구가 수도권에서 보증금 ${eok(bEx.deposit)} 전셋집을 얻으며 버팀목으로 ${eok(bExAmount)}을 빌리면 금리는 연 ${pct(bEx.rate)}이고 매달 이자는 약 ${won(bExPolicy)}입니다. 같은 금액을 연 ${pct(bEx.bankRate)}(가정) 은행 전세대출로 빌리면 약 ${won(bExBank)}이라, 매달 약 ${won(bExBank - bExPolicy)}의 차이가 납니다.`,
          "다만 정책 대출은 소득·자산·주택 면적·보증금 기준을 모두 맞춰야 하고, 한도가 정해져 있어 모자란 금액을 다른 대출로 채우기도 어렵습니다(중복 대출 제한). 자격이 되는지부터 확인한 뒤 은행 상품과 비교하는 순서가 좋습니다.",
        ],
      },
      {
        heading: "신청 시기와 계약을 갱신할 때",
        body: [
          "버팀목전세자금은 임대차계약서의 잔금 지급일과 주민등록 전입일 중 빠른 날부터 3개월 안에 신청해야 합니다. 계약을 갱신하는 경우에는 갱신일부터 3개월 안입니다. 보증서(HF·HUG)도 각각 정해진 기한 안에 신청해야 하므로, 잔금일이 정해지면 은행 상담부터 잡아 두는 것이 안전합니다.",
          `갱신하면서 보증금이 오르면 오른 금액만큼 대출을 더 받을 수 있는데, 일반가구는 '증액된 금액 이내'이면서 '올린 뒤 전체 보증금의 70% 이내'라는 두 조건을 함께 맞춰야 합니다. 보증금이 1천만 원 오르면 더 빌릴 수 있는 돈도 많아야 1천만 원이고, 이미 받은 대출과 합친 금액에는 호당 한도(수도권 일반가구 ${eok(BEOTIM_LIMIT_CAPITAL)})가 함께 적용됩니다.`,
          "버팀목처럼 변동금리인 대출은 대출 기간 중에도 고시 금리가 바뀌면 이자가 달라질 수 있습니다. 위 표의 월 이자는 금리가 그대로라는 가정의 값이니, 금리가 0.5%포인트 오르내릴 때의 이자도 함께 계산해 두면 생활비 계획을 세우기 쉽습니다.",
        ],
      },
      {
        heading: "연말정산에서 원리금 상환액의 40%를 공제받습니다",
        body: [
          "전세대출을 갚는 직장인은 연말정산 때 '주택임차차입금 원리금 상환액 소득공제'를 받을 수 있습니다. 그해 갚은 원금과 이자를 합친 금액의 40%를 근로소득금액에서 빼 주는 제도이고, 주택청약종합저축 소득공제와 합쳐 연 400만 원까지입니다(소득세법 제52조제4항).",
          "공제를 받으려면 연말(12월 31일) 기준 무주택 세대의 세대주여야 합니다. 세대주가 이 공제나 청약저축 공제를 받지 않으면 근로소득이 있는 세대원도 받을 수 있습니다. 집은 국민주택규모(전용 85㎡ 이하, 수도권이 아닌 읍·면 지역은 100㎡ 이하)여야 하며 주거용 오피스텔도 됩니다.",
          "대출 조건도 있습니다. 은행 같은 대출기관에서 빌린 돈은 임대차계약서의 입주일과 전입일 중 빠른 날부터 앞뒤 3개월 안에 빌려야 하고, 대출금이 대출기관에서 집주인 계좌로 바로 들어가야 합니다. 계약을 갱신하면서 빌린 경우에는 갱신일 앞뒤 3개월 안이면 됩니다. 개인에게 빌린 돈은 총급여 5천만 원 이하인 사람만, 앞뒤 1개월 안에 법정 이자율 이상으로 빌린 경우에 인정됩니다(소득세법 시행령 제112조).",
        ],
        table: {
          caption: "만기일시상환 전세대출 1년 이자에 따른 소득공제액과 세금 감소 추정",
          head: ["대출 · 금리", "1년 이자(상환액)", "소득공제액", "세율 16.5% 구간", "세율 26.4% 구간"],
          rows: leaseCases.map((c) => [`${eok(c.amount)} · ${pct(c.rate)}`, won(c.yearInterest), won(c.deduction), `약 ${won(c.save15)}`, `약 ${won(c.save24)}`]),
          note: `세금 감소 = 소득공제액 × (소득세율 + 지방소득세 10%). 16.5%는 과세표준 1,400만~5,000만 원 구간(소득세 ${pct(BRACKET_15, 0)}), 26.4%는 5,000만~8,800만 원 구간(${pct(BRACKET_24, 0)})입니다. 청약저축 공제가 없고, 공제 뒤에도 같은 세율 구간에 머문다고 가정했습니다.`,
        },
        after: [
          `1년 상환액이 ${man(leaseCapInterest)}을 넘으면 40%가 400만 원을 넘으므로 공제액은 400만 원에서 멈춥니다. 청약저축 소득공제를 함께 받는다면 두 공제를 합친 금액이 400만 원을 넘을 수 없어 전세대출 쪽 공제가 그만큼 줄어듭니다.`,
          "회사 연말정산 때 주택자금상환 등 증명서, 주민등록표 등본, 임대차계약서 사본을 내면 됩니다. 연말정산 간소화 서비스에서 조회되지 않으면 대출받은 금융회사에서 증명서를 발급받을 수 있습니다.",
        ],
      },
      {
        heading: "이자를 줄일 수 있는 방법",
        body: [
          "첫째, 꼭 필요한 만큼만 빌립니다. 전세대출은 이자만 내기 때문에 원금이 그대로 남아, 빌린 금액이 곧 이자의 크기입니다. 버팀목은 대출 신청 금액이 심사로 정한 금액의 30% 이하이면 연 0.2%포인트를 더 깎아 주는 조건도 있습니다.",
          "둘째, 여윳돈이 생기면 일부를 먼저 갚습니다. 만기일시상환은 원금을 줄인 만큼 다음 달 이자가 바로 줄어듭니다. 버팀목은 중도상환수수료가 없고, 은행 상품은 수수료 조건이 상품마다 다르니 약정서를 확인하세요.",
          "셋째, 소득이 늘거나 신용점수가 올랐다면 금리인하요구권을 써 볼 수 있습니다. 대출 기간 중에도 금융회사에 금리를 낮춰 달라고 요구할 수 있는 권리입니다. 계약을 연장할 때는 다른 금융회사 상품으로 갈아타는 것도 비교해 보세요.",
        ],
      },
      {
        heading: "계산기로 확인하는 순서",
        body: [
          "대출이자 계산기에 대출 금액, 연 금리, 기간(개월)을 넣고 상환 방식에서 만기일시를 고르면 매달 이자와 기간 전체 이자를 확인할 수 있습니다. 같은 금액으로 금리만 바꿔 넣으면 금리 차이가 얼마의 돈인지 바로 보입니다.",
          "정책 대출과 은행 대출을 비교할 때는 한 화면에 세 가지를 적어 두면 편합니다. 매달 내는 이자, 처음에 드는 보증료와 인지세, 그리고 연말정산 소득공제로 돌려받을 세금입니다. 이자가 조금 높아도 한도가 넉넉해 다른 대출을 줄일 수 있다면 전체 비용은 오히려 낮을 수 있으므로, 대출 하나의 금리만 보지 말고 필요한 보증금 전체를 어떻게 채울지 기준으로 따져 보세요.",
          "정책 대출 자격, 보증 한도와 보증료, 소득공제 요건은 소득·가구 형태·주택에 따라 달라집니다. 실제 대출 전에는 주택도시기금 수탁은행이나 취급은행, 보증기관(HF·HUG 등)에서, 소득공제는 회사 연말정산 담당자나 국세청(국번 없이 126)에서 내 조건을 확인하세요.",
        ],
      },
    ],
    sources: [
      { label: "주택도시기금 – 버팀목전세자금 상품 안내", url: "https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020101.jsp" },
      { label: "한국주택금융공사 – 일반전세자금보증", url: "https://www.hf.go.kr/ko/sub02/sub02_01_02.do" },
      { label: "국가법령정보센터 – 소득세법 제52조(특별소득공제)", url: "https://www.law.go.kr/법령/소득세법" },
      { label: "국가법령정보센터 – 소득세법 시행령 제112조(주택자금공제)", url: "https://www.law.go.kr/법령/소득세법시행령" },
      { label: "국세청 – 연말정산 맞춤형 안내(주택임차차입금 원리금 상환액 소득공제)", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=40609&cntntsId=239021" },
    ],
};

// ───────────── 2. 주택청약종합저축 소득공제 ─────────────
// 주택청약종합저축 소득공제: 총급여 7천만 원 이하 무주택 세대주(또는 배우자), 연 납입액 300만 원 한도의 40%.
// 2028년 12월 31일까지 납입분. 소득세법 제52조제4항 공제와 합쳐 연 400만 원 한도. 추징세액은 납입 누계액의 6%.
// 출처: 조세특례제한법 제87조(https://www.law.go.kr/법령/조세특례제한법), 확인 2026-11-27
const SUB_SALARY_LIMIT = 70_000_000;
const SUB_PAY_LIMIT = 3_000_000;
const SUB_DEDUCTION_RATE = 0.4;
const SUB_CLAWBACK_RATE = 0.06;
// 월 납입 인정액(청약 저축총액 산정 때 한 달에 인정하는 최대 금액). 2024년 11월 1일부터 10만 원 → 25만 원.
// 출처: 주택공급에 관한 규칙 제10조제5항(https://www.law.go.kr/법령/주택공급에관한규칙),
// 정책브리핑 2024-09-25(https://www.korea.kr/news/policyNewsView.do?newsId=148934374), 확인 2026-11-27
const SUB_MONTHLY_RECOGNIZED = 250_000;
const SUB_MONTHLY_RECOGNIZED_OLD = 100_000;
// 월 납입금 범위와 저축 기간별 약정이율(변동금리, 정부 고시). 출처: 주택도시기금 주택청약종합저축상품
// (https://nhuf.molit.go.kr/FP/FP07/FP0701/FP07010101.jsp), 확인 2026-11-27
const SUB_MONTHLY_MIN = 20_000;
const SUB_MONTHLY_MAX = 500_000;
const SUB_RATES: { period: string; rate: number }[] = [
  { period: "1개월 이내", rate: 0 },
  { period: "1개월 초과 ~ 1년 미만", rate: 0.023 },
  { period: "1년 이상 ~ 2년 미만", rate: 0.028 },
  { period: "2년 이상 ~ 10년 이내", rate: 0.031 },
];
const subTopRate = SUB_RATES[SUB_RATES.length - 1].rate;
const BRACKET_6 = RATES.incomeTax.brackets[0].rate; // 과세표준 1,400만 원 이하 6%
const subMonthly = [20_000, 100_000, 150_000, 200_000, 250_000, 300_000, 500_000];
const subRows = subMonthly.map((m) => {
  const yearPaid = m * 12;
  const counted = Math.min(yearPaid, SUB_PAY_LIMIT);
  const deduction = counted * SUB_DEDUCTION_RATE;
  return { m, yearPaid, counted, deduction, recognized: Math.min(m, SUB_MONTHLY_RECOGNIZED) * 12 };
});
const subBest = subRows.find((r) => r.m === SUB_MONTHLY_RECOGNIZED)!;
const subMaxDeduction = SUB_PAY_LIMIT * SUB_DEDUCTION_RATE;
// 전세대출 공제와 함께 받을 때: 2억 원·연 4.5% 만기일시 전세대출 1년 이자 공제 + 청약 공제
const subWithLease = (() => {
  const lease = Math.min(calcLoan(200_000_000, 0.045, 12, "bullet").totalInterest * LEASE_LOAN_DEDUCTION_RATE, HOUSING_DEDUCTION_LIMIT);
  const total = Math.min(lease + subMaxDeduction, HOUSING_DEDUCTION_LIMIT);
  return { lease, sum: lease + subMaxDeduction, total, lost: lease + subMaxDeduction - total };
})();
// 중도 해지 추징 예: 월 25만 원씩 3년 넣고 소득공제를 받은 뒤 가입 5년 안에 해지
const SUB_EX_YEARS = 3;
const subClawPaid = subBest.counted * SUB_EX_YEARS;
const subClaw = subClawPaid * SUB_CLAWBACK_RATE;
const subSaved = (rate: number) => subBest.deduction * marginal(rate) * SUB_EX_YEARS;
// 월 25만 원을 넣었을 때 이자 추정(가입 2년 이상 금리가 모든 회차에 적용된다고 가정, 단리, 이자소득세 15.4%)
const subInterest = [2, 3, 5].map((y) =>
  calcSavings({ kind: "installment", amount: SUB_MONTHLY_RECOGNIZED, annualRate: subTopRate, months: y * 12, interestType: "simple", taxRate: RATES.interestTax.normal }),
);
const subNetInterest = (i: number) => subInterest[i].afterTax - subInterest[i].principal;
// 민영주택 청약 예치기준금액(주택공급에 관한 규칙 별표 2, 단위 원). 열: 특별시·부산광역시 / 그 밖의 광역시 / 특별시·광역시 외 지역.
// 출처: 주택도시기금 주택청약종합저축상품(https://nhuf.molit.go.kr/FP/FP07/FP0701/FP07010101.jsp), 확인 2026-11-27
const SUB_DEPOSIT_BASE: { area: string; amounts: [number, number, number] }[] = [
  { area: "전용 85㎡ 이하", amounts: [3_000_000, 2_500_000, 2_000_000] },
  { area: "102㎡ 이하", amounts: [6_000_000, 4_000_000, 3_000_000] },
  { area: "135㎡ 이하", amounts: [10_000_000, 7_000_000, 4_000_000] },
  { area: "모든 면적", amounts: [15_000_000, 10_000_000, 5_000_000] },
];
const monthsToReach = (target: number) => Math.ceil(target / SUB_MONTHLY_RECOGNIZED);

const housingSubscriptionGuide: Guide = {
  slug: "housing-subscription-savings",
  title: "주택청약종합저축 소득공제: 월 25만 원 넣으면 세금이 얼마나 줄까",
  description:
    "청약통장 소득공제 조건과 연 300만 원 한도, 월 납입 인정액 25만 원, 저축 기간별 금리, 5년 안에 해지할 때 추징되는 세금까지 계산 예시로 정리했습니다.",
  date: "2026-12-06",
  tool: "savings-interest",
  sections: [
    {
      heading: "월 25만 원이면 소득공제 한도를 다 채웁니다",
      body: [
        `총급여 ${eok(SUB_SALARY_LIMIT)} 이하인 무주택 세대주가 주택청약종합저축에 매달 ${man(SUB_MONTHLY_RECOGNIZED)}씩, 1년에 ${man(subBest.yearPaid)}을 넣으면 연말정산 때 ${man(subBest.deduction)}을 소득공제 받습니다. 과세표준이 1,400만~5,000만 원 구간(소득세율 ${pct(BRACKET_15, 0)})이라면 지방소득세까지 합쳐 세금이 약 ${won(subBest.deduction * marginal(BRACKET_15))} 줄어듭니다.`,
        `소득공제는 1년에 넣은 돈 가운데 ${man(SUB_PAY_LIMIT)}까지만 인정하고, 그 금액의 ${pct(SUB_DEDUCTION_RATE, 0)}를 근로소득금액에서 빼 주는 방식입니다(조세특례제한법 제87조). 그래서 공제액은 1년에 ${man(subMaxDeduction)}이 최대이고, 매달 ${man(SUB_MONTHLY_RECOGNIZED)}보다 많이 넣어도 공제는 늘지 않습니다.`,
      ],
      table: {
        caption: "월 납입액별 연 소득공제액과 세금 감소 추정 (12개월 모두 넣은 경우)",
        head: ["월 납입액", "연 납입액", "공제 대상 납입액", "소득공제액", "세율 6.6% 구간", "세율 16.5% 구간", "세율 26.4% 구간"],
        rows: subRows.map((r) => [
          man(r.m),
          man(r.yearPaid),
          man(r.counted),
          won(r.deduction),
          `약 ${won(r.deduction * marginal(BRACKET_6))}`,
          `약 ${won(r.deduction * marginal(BRACKET_15))}`,
          `약 ${won(r.deduction * marginal(BRACKET_24))}`,
        ]),
        note: "세금 감소 = 소득공제액 × (소득세율 + 지방소득세 10%). 6.6%는 과세표준 1,400만 원 이하, 16.5%는 1,400만~5,000만 원, 26.4%는 5,000만~8,800만 원 구간입니다. 공제 뒤에도 같은 세율 구간에 머물고, 전세대출 등 다른 주택자금공제는 없다고 가정했습니다.",
      },
      after: [
        "소득공제는 세금을 직접 깎아 주는 세액공제와 달리 세금을 매기는 기준 금액을 줄여 줍니다. 같은 120만 원을 공제받아도 세율이 높은 구간에 있는 사람일수록 줄어드는 세금이 큽니다. 내 과세표준 구간은 지난해 근로소득 원천징수영수증이나 연말정산 결과에서 확인할 수 있습니다.",
      ],
    },
    {
      heading: "공제를 받을 수 있는 사람",
      body: [
        `조건은 세 가지입니다. 그해 총급여가 ${eok(SUB_SALARY_LIMIT)} 이하인 근로자(일용근로자 제외)여야 하고, 그해 동안 집을 갖지 않은 세대의 세대주나 세대주의 배우자여야 합니다. 세대주인지는 그해 12월 31일 기준으로 봅니다.`,
        "마지막으로 가입한 은행에 '무주택 확인서'를 공제받으려는 해의 다음 해 2월 말까지 내야 합니다. 2026년 납입분을 공제받으려면 2027년 2월 말까지입니다. 법은 소득공제를 처음 적용받는 해 이후에 넣은 돈만 공제 대상으로 보므로, 확인서를 늦게 내면 그 전 해에 넣은 돈은 공제받지 못합니다.",
        "또 그해에 통장을 해지하면 주택 당첨 같은 정해진 사유가 아닌 한 그해 넣은 돈은 공제받지 못합니다. 이 소득공제는 법에서 2028년 12월 31일까지 넣은 돈에 적용하도록 정해져 있습니다.",
      ],
    },
    {
      heading: "월 납입 인정액은 2024년 11월부터 25만 원",
      body: [
        `월 납입 인정액은 청약할 때 저축 총액을 계산하며 한 달에 인정해 주는 최대 금액입니다. 2024년 11월 1일부터 ${man(SUB_MONTHLY_RECOGNIZED_OLD)}에서 ${man(SUB_MONTHLY_RECOGNIZED)}으로 올랐습니다. 공공분양(국민주택) 같은 일부 청약에서는 이 저축 총액이 많은 사람을 먼저 뽑기 때문에, 한 달에 얼마를 넣었는지가 당락에 영향을 줄 수 있습니다.`,
        `한 달에 넣을 수 있는 돈은 ${man(SUB_MONTHLY_MIN)} 이상 ${man(SUB_MONTHLY_MAX)} 이하입니다. ${man(SUB_MONTHLY_RECOGNIZED)}보다 많이 넣어도 저축 총액에는 ${man(SUB_MONTHLY_RECOGNIZED)}만 들어가므로, 청약 인정액과 소득공제 한도를 모두 생각하면 월 ${man(SUB_MONTHLY_RECOGNIZED)}이 딱 맞는 금액입니다.`,
      ],
      table: {
        caption: "월 납입액에 따라 1년에 인정되는 저축 총액",
        head: ["월 납입액", "1년 납입액", "청약 저축 총액 인정분", "소득공제 대상"],
        rows: subRows.map((r) => [man(r.m), man(r.yearPaid), man(r.recognized), man(r.counted)]),
        note: "월 납입액이 25만 원을 넘으면 그 달은 25만 원으로 계산합니다(주택공급에 관한 규칙 제10조). 미리 넣는 선납·늦게 넣는 연체는 인정 회차 계산이 따로 있어 표와 다를 수 있습니다.",
      },
    },
    {
      heading: "1순위 조건과 민영주택 예치 기준금액",
      body: [
        "국민주택(공공분양)은 수도권이면 가입 1년이 지나고 매달 약정한 날에 12회 이상 넣어야, 수도권 밖이면 6개월이 지나고 6회 이상 넣어야 1순위가 됩니다. 투기과열지구나 청약과열지역은 가입 2년·24회 이상에 세대주여야 하는 등 조건이 더 엄격합니다. 1순위끼리 경쟁하면 전용 40㎡ 초과 주택은 저축 총액이 많은 사람, 40㎡ 이하 주택은 납입 횟수가 많은 사람이 앞섭니다(주택공급에 관한 규칙 제27조).",
        "민영주택은 납입 횟수 대신 지역과 면적별로 정한 예치 기준금액을 모집공고일까지 채웠는지를 봅니다. 수도권은 가입 1년, 수도권 밖은 6개월이 지나고 기준금액 이상이 들어 있으면 1순위가 될 수 있습니다. 매달 넣는 금액보다 통장 잔액이 기준을 넘었는지가 중요합니다.",
      ],
      table: {
        caption: `민영주택 청약 예치 기준금액과 월 ${man(SUB_MONTHLY_RECOGNIZED)}씩 넣을 때 채우는 데 걸리는 기간`,
        head: ["청약할 면적", "특별시·부산", "그 밖의 광역시", "그 밖의 지역"],
        rows: SUB_DEPOSIT_BASE.map((d) => [d.area, ...d.amounts.map((a) => `${man(a)} (${monthsToReach(a)}개월)`)]),
        note: "주택공급에 관한 규칙 별표 2의 금액을 주택도시기금 누리집에서 확인(2026년 11월). 괄호는 월 25만 원씩 넣을 때 기준금액에 이르는 달 수입니다. 잔액이 1,500만 원보다 적으면 월 50만 원을 넘겨 한꺼번에 넣는 것도 가능합니다.",
      },
      after: [
        "그래서 공공분양을 노린다면 매달 꾸준히 넣어 회차와 저축 총액을 쌓는 것이, 민영주택을 노린다면 청약하려는 면적의 기준금액을 미리 채워 두는 것이 핵심입니다. 두 경우 모두 월 25만 원이면 소득공제 한도와 월 납입 인정액을 함께 채울 수 있습니다.",
      ],
    },
    {
      heading: "청약통장 금리는 저축 기간에 따라 다릅니다",
      body: [
        `주택도시기금 누리집 기준(2026년 11월 확인) 주택청약종합저축 금리는 가입 기간에 따라 연 ${pct(SUB_RATES[1].rate)}~${pct(subTopRate)}입니다. 가입 1개월 안에 해지하면 이자가 없고, 2년 이상 유지하면 가장 높은 금리가 붙습니다. 정부 고시에 따라 바뀌는 변동금리이며, 금리가 바뀌면 각 납입 회차에 변경일부터 새 금리가 적용됩니다.`,
      ],
      table: {
        caption: "주택청약종합저축 저축 기간별 약정이율 (세전, 연)",
        head: ["저축 기간", "금리"],
        rows: SUB_RATES.map((r) => [r.period, r.rate === 0 ? "이자 없음" : `연 ${pct(r.rate)}`]),
        note: "2026년 11월 주택도시기금 누리집 확인 기준. 주택청약종합저축은 예금자보호법의 보호 대상은 아니지만 주택도시기금 재원으로 정부가 관리합니다.",
      },
      after: [
        `월 ${man(SUB_MONTHLY_RECOGNIZED)}씩 넣고 연 ${pct(subTopRate)}가 모든 회차에 적용된다고 가정하면, 2년 뒤 세후 이자는 약 ${won(subNetInterest(0))}, 3년 뒤 약 ${won(subNetInterest(1))}, 5년 뒤 약 ${won(subNetInterest(2))}입니다(단리, 이자소득세 15.4% 가정). 금리만 보면 일반 적금과 큰 차이가 없을 수 있지만, 소득공제와 청약 자격이 함께 따라온다는 점이 다릅니다.`,
        "예금·적금 이자 계산기에서 적금을 고르고 월 납입액과 금리, 기간을 넣으면 같은 방식으로 이자를 계산해 볼 수 있습니다. 실제 이자는 은행이 회차별 날짜와 금리 변경을 반영해 계산하므로 조금 다를 수 있습니다.",
      ],
    },
    {
      heading: "전세대출 공제와 합쳐 400만 원이 한도입니다",
      body: [
        `청약저축 소득공제는 전세대출을 갚을 때 받는 주택임차차입금 원리금 상환액 공제와 한도를 함께 씁니다. 두 공제를 합쳐 연 ${man(HOUSING_DEDUCTION_LIMIT)}을 넘으면 넘는 부분은 공제되지 않습니다.`,
        `예를 들어 ${eok(200_000_000)}을 연 ${pct(0.045)}에 만기일시로 빌린 사람은 1년 이자로 받는 공제가 ${man(subWithLease.lease)}입니다. 여기에 청약저축 공제 ${man(subMaxDeduction)}을 더하면 ${man(subWithLease.sum)}이지만 한도 때문에 ${man(subWithLease.total)}만 인정되고, ${man(subWithLease.lost)}은 공제 효과가 없습니다. 전세대출 이자가 큰 해에는 청약저축을 늘려도 세금이 더 줄지 않을 수 있다는 뜻입니다.`,
        "그렇다고 한도를 넘었으니 청약저축을 멈출 일은 아닙니다. 청약통장은 세금 혜택과 별개로 가입 기간, 납입 횟수, 저축 총액을 쌓는 통장이라, 공제 효과가 없는 해에도 청약 준비에는 그대로 쓸모가 있습니다. 세금 효과와 청약 준비를 나눠서 판단하세요. 반대로 전세대출을 다 갚은 해에는 청약저축 공제 120만 원을 온전히 받을 수 있습니다.",
      ],
    },
    {
      heading: "5년 안에 해지하면 공제받은 세금을 돌려줍니다",
      body: [
        `소득공제를 받은 사람이 가입일부터 5년 안에 통장을 해지하거나, 전용 85㎡(국민주택규모)를 넘는 주택에 당첨되면 은행이 해지할 때 추징세액을 떼고 줍니다. 추징세액은 소득공제를 받기 시작한 해부터 넣은 돈(1년에 ${man(SUB_PAY_LIMIT)} 한도)을 모두 더한 금액의 ${pct(SUB_CLAWBACK_RATE, 0)}입니다. 사망이나 해외 이주, 85㎡ 이하 주택 당첨에 따른 해지 등은 추징하지 않습니다.`,
        "다만 실제로 공제로 줄어든 세금이 추징세액보다 적다는 것을 증명하면, 실제로 줄어든 세금만큼만 추징합니다. 세율이 낮은 구간에 있던 사람은 이 증명이 유리할 수 있습니다.",
      ],
      table: {
        caption: `월 ${man(SUB_MONTHLY_RECOGNIZED)}씩 ${SUB_EX_YEARS}년 넣고 소득공제를 받은 뒤 가입 5년 안에 해지하는 경우`,
        head: ["세율 구간", `${SUB_EX_YEARS}년간 줄어든 세금(추정)`, "추징세액(누계 × 6%)", "증명하면 추징되는 금액"],
        rows: [BRACKET_6, BRACKET_15, BRACKET_24].map((r) => [
          `${pct(marginal(r))} 구간`,
          `약 ${won(subSaved(r))}`,
          won(subClaw),
          `약 ${won(Math.min(subSaved(r), subClaw))}`,
        ]),
        note: `공제 대상 납입 누계 ${man(subClawPaid)} 기준. 주택도시기금 누리집은 추징금액에 지방소득세가 별도라고 안내합니다. 실제 감면세액을 증명하는 방법은 가입 은행이나 세무서에 확인하세요.`,
      },
      after: [
        "청약통장을 급하게 깨야 할 일이 생길 수 있다면, 처음부터 생활비와 비상금을 따로 떼어 두고 청약통장에는 오래 묶어 둘 수 있는 돈만 넣는 것이 좋습니다. 통장을 해지하면 그동안 쌓은 가입 기간과 납입 회차도 함께 사라집니다.",
      ],
    },
    {
      heading: "연말정산 전에 확인할 것",
      body: [
        "12월에는 무주택 확인서를 냈는지부터 가입 은행에 확인하세요. 확인서를 냈어도 그해 납입액이 300만 원에 못 미친다면, 납입 한도 안에서 남은 금액을 연말 전에 넣어 공제 대상 금액을 늘릴 수 있습니다. 연말정산 간소화 서비스에서 청약저축 납입 내역이 보이지 않으면 가입 은행에 납입 증명서 발급을 요청하면 됩니다.",
        "세대주 여부, 총급여, 집 보유 여부, 전세대출 공제와의 한도 배분에 따라 받을 수 있는 금액이 달라집니다. 정확한 공제 가능 여부는 회사 연말정산 담당자나 국세청(국번 없이 126), 청약통장 관련 내용은 가입 은행에 확인하세요.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 – 조세특례제한법 제87조(주택청약종합저축 등에 대한 소득공제 등)", url: "https://www.law.go.kr/법령/조세특례제한법" },
    { label: "국가법령정보센터 – 주택공급에 관한 규칙 제9조·제10조", url: "https://www.law.go.kr/법령/주택공급에관한규칙" },
    { label: "주택도시기금 – 주택청약종합저축상품 안내", url: "https://nhuf.molit.go.kr/FP/FP07/FP0701/FP07010101.jsp" },
    { label: "대한민국 정책브리핑 – 청약통장 금리 인상과 월 납입 인정액 상향(2024-09-25)", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148934374" },
  ],
};

// ───────────── 3. 계약갱신청구권 ─────────────
// 차임·보증금 증액 상한 20분의 1(5%), 증액 후 1년 안에는 다시 증액 청구 불가.
// 출처: 주택임대차보호법 제7조(https://www.law.go.kr/법령/주택임대차보호법), 같은 법 시행령 제8조, 확인 2026-11-27
const RENEW_RAISE_PERCENT = 5;
// 한국은행 기준금리: 2026년 11월 26일부터 연 3.25%(직전 2026년 8월 27일부터 연 3.00%).
// 출처: 한국은행 기준금리 추이(https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643), 확인 2026-11-27
const BASE_RATE = 0.0325;
const BASE_RATE_PREV = 0.03;
const BASE_RATE_DATE = "2026년 11월 26일";
// 월차임 전환 시 산정률 상한: 연 10%와 기준금리 + 연 2% 중 낮은 비율(주택임대차보호법 제7조의2, 시행령 제9조)
const convCap = legalConversionCap(BASE_RATE);
const convCapPrev = legalConversionCap(BASE_RATE_PREV);
const renewDeposits = [100_000_000, 200_000_000, 300_000_000, 400_000_000, 500_000_000];
const renewRents = [
  { deposit: 10_000_000, rent: 500_000 },
  { deposit: 30_000_000, rent: 800_000 },
  { deposit: 50_000_000, rent: 1_000_000 },
];
const renewHead = { deposit: 300_000_000 };
const renewHeadRaise = percentOf(renewHead.deposit, RENEW_RAISE_PERCENT);
// 갱신하면서 전세 3억 원 중 일부를 월세로 바꾸는 경우(임차인이 동의한 경우만 가능)
const convFrom = 300_000_000;
const convTo = [250_000_000, 200_000_000, 150_000_000, 100_000_000];
const convRows = convTo.map((to) => ({ to, now: depositToRent(convFrom, to, convCap), prev: depositToRent(convFrom, to, convCapPrev) }));
// 갱신된 계약 중 해지 통지: 집주인이 통지를 받은 날부터 3개월 뒤 효력(제6조의2). 그동안 월세는 계속 냅니다.
const MOVE_NOTICE_MONTHS = 3;
const moveRents = [500_000, 800_000, 1_000_000];

const leaseRenewalGuide: Guide = {
  slug: "lease-renewal-right",
  title: "계약갱신청구권 정리: 언제 요구하고, 보증금은 얼마까지 오를까",
  description:
    "주택임대차보호법의 계약갱신요구권 행사 기간과 횟수, 5% 증액 상한 계산, 집주인이 거절할 수 있는 사유, 묵시적 갱신과의 차이, 갱신하며 월세로 바꿀 때의 전환율 상한을 정리했습니다.",
  date: "2026-12-14",
  tool: "rent-conversion",
  sections: [
    {
      heading: "만료 6개월 전부터 2개월 전까지, 한 번 요구할 수 있습니다",
      body: [
        `전세 보증금 ${eok(renewHead.deposit)}인 집에서 계약갱신을 요구하면 집주인이 올릴 수 있는 보증금은 많아야 ${man(renewHeadRaise)}(${RENEW_RAISE_PERCENT}%)이고, 세입자는 같은 조건으로 2년 더 살 수 있습니다. 요구는 계약 기간이 끝나기 6개월 전부터 2개월 전까지 해야 하고, 집주인은 법에서 정한 사유가 없으면 거절하지 못합니다(주택임대차보호법 제6조의3).`,
        "계약갱신요구권은 세입자 한 사람에게 1회만 주어집니다. 갱신된 계약의 기간은 2년으로 보고, 보증금과 월세를 빼면 나머지 조건은 이전 계약과 같습니다. 처음 계약을 1년으로 했더라도 법은 2년 미만 계약을 2년으로 보므로(제4조), 2년이 끝나는 시점을 기준으로 요구 기간을 계산합니다.",
        "요구하는 방법은 따로 정해져 있지 않습니다. 법무부 해설집은 말이나 문자, 이메일도 되지만 나중에 다툼이 생길 때를 대비해 내용증명 우편처럼 기록이 남는 방법이 안전하다고 안내합니다. 기한의 마지막 날은 '만료일의 2개월 전에 해당하는 날 0시 전까지 집주인에게 도착'해야 하는 것으로 봅니다. 예를 들어 만료일이 4월 10일이면 늦어도 2월 9일 안(2월 10일 0시 전)에 집주인에게 의사가 도착해야 합니다.",
      ],
    },
    {
      heading: "보증금과 월세는 5%까지만 올릴 수 있습니다",
      body: [
        `갱신할 때 보증금이나 월세를 올리는 것은 기존 금액의 20분의 1, 곧 ${RENEW_RAISE_PERCENT}%를 넘을 수 없습니다(제7조제2항). 시·도는 조례로 이보다 낮은 상한을 정할 수 있으니 사는 지역의 조례도 확인해야 합니다. 또 보증금이나 월세를 올린 뒤 1년 안에는 다시 올려 달라고 청구할 수 없습니다(시행령 제8조).`,
        `${RENEW_RAISE_PERCENT}%는 반드시 올려야 하는 금액이 아니라 올릴 수 있는 최대치입니다. 그 범위 안에서 두 사람이 협의해 정하고, 동결하거나 내리는 것도 가능합니다. 아래 표는 상한까지 올렸을 때의 금액입니다.`,
      ],
      table: {
        caption: `갱신 때 ${RENEW_RAISE_PERCENT}% 상한으로 올릴 수 있는 최대 금액`,
        head: ["지금 조건", "최대 인상액", "인상 후 최대 금액"],
        rows: [
          ...renewDeposits.map((d) => [`전세 보증금 ${eok(d)}`, man(percentOf(d, RENEW_RAISE_PERCENT)), eok(d + percentOf(d, RENEW_RAISE_PERCENT))]),
          ...renewRents.map((r) => [
            `보증금 ${man(r.deposit)} · 월세 ${man(r.rent)} (월세만 올릴 때)`,
            `월세 ${won(percentOf(r.rent, RENEW_RAISE_PERCENT))}`,
            `보증금 ${man(r.deposit)} · 월세 ${won(r.rent + percentOf(r.rent, RENEW_RAISE_PERCENT))}`,
          ]),
        ],
        note: "퍼센트 계산기의 'A의 B%'와 같은 식(금액 × 5 ÷ 100)으로 계산했습니다. 보증금과 월세를 함께 올릴 때 상한을 어떻게 합쳐 보는지는 법 조문에 따로 계산식이 없으니 다툼이 있으면 아래 상담 기관에 확인하세요.",
      },
      after: [
        "갱신요구권을 쓰면서 5%를 넘게 올리기로 합의했더라도 넘는 부분은 효력이 없고, 이미 더 냈다면 돌려 달라고 청구할 수 있다는 것이 법무부 해설입니다(제10조, 제10조의2). 반대로 세입자가 요구권을 쓰지 않고 새 조건으로 다시 계약하면 5%를 넘는 인상도 가능하며, 이때는 요구권을 쓴 것이 아니므로 다음 만료 때 한 번 쓸 수 있습니다.",
      ],
    },
    {
      heading: "집주인이 거절할 수 있는 경우",
      body: [
        "법은 갱신을 거절할 수 있는 사유를 아홉 가지로 정해 두었습니다. 월세를 2기분(두 달 치)에 이르도록 밀린 적이 있는 경우, 거짓이나 부정한 방법으로 빌린 경우, 서로 합의해 집주인이 이사비 같은 상당한 보상을 실제로 준 경우, 집주인 동의 없이 다른 사람에게 다시 빌려준(전대) 경우, 고의나 큰 잘못으로 집을 부순 경우, 집이 없어져 살 수 없게 된 경우입니다. 연체는 연속일 필요가 없고 합쳐서 두 달 치에 이르면 해당합니다.",
        "여기에 집주인이 계약 때 알린 계획대로 또는 안전 문제나 다른 법령에 따라 철거·재건축하는 경우, 집주인이나 그 부모·자녀 같은 직계존비속이 실제로 들어와 살려는 경우, 그 밖에 세입자가 의무를 크게 어기거나 임대차를 이어 가기 어려운 중대한 사유가 있는 경우가 더해집니다. 법무부 해설집은 법인 집주인은 실거주를 이유로 거절할 수 없다고 봅니다.",
        "집주인이 실거주를 이유로 거절해 놓고, 갱신되었다면 끝났을 2년이 지나기 전에 정당한 사유 없이 다른 사람에게 세를 주면 세입자의 손해를 물어 줘야 합니다. 따로 정한 금액이 없으면 '거절 당시 환산 월세의 3개월분', '새 세입자에게 받은 환산 월세와 거절 당시 환산 월세 차이의 2년분', '실제 손해액' 중 가장 큰 금액입니다(제6조의3제5항·제6항).",
      ],
    },
    {
      heading: "묵시적 갱신과는 어떻게 다를까",
      body: [
        "묵시적 갱신은 집주인이 만료 6개월 전부터 2개월 전까지 갱신을 거절하거나 조건을 바꾸겠다고 알리지 않고, 세입자도 만료 2개월 전까지 아무 말이 없을 때 이전과 같은 조건으로 자동 연장되는 제도입니다(제6조). 이때도 계약 기간은 2년으로 봅니다. 다만 월세를 2기분 밀렸거나 세입자 의무를 크게 어긴 경우에는 자동 연장이 되지 않습니다.",
        "중요한 차이는 횟수입니다. 법무부 해설집은 묵시적 갱신은 갱신요구권을 쓴 것으로 보지 않는다고 설명합니다. 그래서 자동으로 연장된 계약이 끝날 때도 요구권을 한 번 쓸 수 있습니다.",
      ],
      table: {
        caption: "계약갱신요구와 묵시적 갱신 비교",
        head: ["구분", "계약갱신요구(제6조의3)", "묵시적 갱신(제6조)"],
        rows: [
          ["시작", "세입자가 만료 6~2개월 전에 요구", "양쪽 모두 정해진 기간에 아무 통지가 없을 때"],
          ["연장 기간", "2년", "2년"],
          ["보증금·월세", "올릴 때는 5% 이내, 내릴 수도 있음", "이전과 같은 조건"],
          ["횟수", "세입자당 1회", "요구권을 쓴 것으로 보지 않음"],
          ["집주인이 막을 수 있나", "법에 정한 아홉 가지 사유가 있을 때만 거절", "기간 안에 거절·조건 변경을 통지하면 연장 안 됨"],
          ["세입자 중도 해지", "언제든 통지, 3개월 뒤 효력", "언제든 통지, 3개월 뒤 효력"],
        ],
        note: "주택임대차보호법 제6조, 제6조의2, 제6조의3과 법무부 「주택임대차보호법」 해설집을 바탕으로 정리했습니다.",
      },
      after: [
        "두 경우 모두 세입자는 연장된 기간 중에도 언제든 계약을 끝내겠다고 알릴 수 있고, 집주인이 통지를 받은 날부터 3개월이 지나면 계약이 끝납니다(제6조의2). 그 3개월 동안의 월세는 내야 하므로, 이사 날짜가 정해지면 바로 통지하는 것이 비용을 줄이는 방법입니다.",
      ],
    },
    {
      heading: "갱신하면서 보증금 일부를 월세로 바꾼다면",
      body: [
        "갱신된 계약은 이전과 같은 조건으로 보기 때문에, 집주인이 세입자 동의 없이 전세를 월세로 바꾸기는 어렵다는 것이 법무부 해설입니다. 세입자가 동의해 보증금 일부를 월세로 바꾸는 경우에도 법정 전환율 상한이 적용됩니다.",
        `상한은 연 10%와 '한국은행 기준금리 + 연 2%' 가운데 낮은 비율입니다(제7조의2, 시행령 제9조). 기준금리는 ${BASE_RATE_DATE}부터 연 ${pct(BASE_RATE, 2)}이므로 상한은 연 ${pct(convCap, 2)}입니다. 그 전(연 ${pct(BASE_RATE_PREV, 2)})에는 연 ${pct(convCapPrev, 2)}였습니다. 기준금리가 바뀌면 상한도 함께 바뀝니다.`,
      ],
      table: {
        caption: `전세 ${eok(convFrom)}을 갱신하며 보증금을 낮추고 월세로 바꿀 때 받을 수 있는 최대 월세`,
        head: ["바꾼 뒤 보증금", "월세로 바꾸는 금액", `상한 연 ${pct(convCap, 2)}일 때 최대 월세`, `연 ${pct(convCapPrev, 2)}였을 때`],
        rows: convRows.map((r) => [eok(r.to), eok(r.now.converted), won(r.now.monthlyRent), won(r.prev.monthlyRent)]),
        note: "전월세 전환 계산기와 같은 식(월세 = 월세로 바꾸는 보증금 × 전환율 ÷ 12)으로 계산했습니다. 이 상한은 계약 기간 중이나 갱신 때 바꾸는 경우에 적용되고, 새로 맺는 계약에는 적용되지 않습니다.",
      },
      after: [
        "법정 상한을 넘는 약정은 세입자에게 불리한 부분이 효력이 없고(제10조), 상한을 넘겨 이미 낸 월세는 돌려 달라고 청구할 수 있습니다(제10조의2). 전월세 전환 계산기에 지금 보증금, 바꾼 뒤 보증금, 기준금리를 넣으면 법정 상한으로 계산한 월세를 바로 확인할 수 있습니다.",
      ],
    },
    {
      heading: "갱신하지 않고 나가려면",
      body: [
        "세입자가 만기에 나갈 생각이라면 만료 2개월 전까지 집주인에게 알리는 것이 안전합니다. 세입자도 이 기간까지 아무 말을 하지 않고 집주인도 통지하지 않으면 계약이 같은 조건으로 2년 연장되기 때문입니다(제6조제1항). 연장된 뒤에도 나갈 수는 있지만, 그때는 해지를 알린 날부터 3개월이 지나야 계약이 끝납니다.",
        "계약 기간이 끝났더라도 보증금을 돌려받을 때까지는 임대차 관계가 이어지는 것으로 봅니다(제4조제2항). 보증금을 받기 전에 먼저 이사해야 한다면 대항력과 우선변제권을 어떻게 지킬지 이사 전에 따로 알아보세요.",
      ],
      table: {
        caption: `연장된 계약을 중간에 끝낼 때 통지 후 ${MOVE_NOTICE_MONTHS}개월 동안 내는 월세`,
        head: ["월세", `${MOVE_NOTICE_MONTHS}개월 동안 내는 월세`],
        rows: moveRents.map((r) => [man(r), man(r * MOVE_NOTICE_MONTHS)]),
        note: "해지 효력은 집주인이 통지를 받은 날부터 3개월 뒤에 생깁니다(제6조의2제2항). 새 세입자가 일찍 들어오는 등 집주인과 따로 합의하면 달라질 수 있습니다.",
      },
      after: [
        "이사 날짜가 정해지는 대로 통지하면 이 기간을 새집 입주 시기와 맞출 수 있습니다. 통지 역시 문자나 내용증명처럼 받은 날짜가 남는 방법을 쓰는 것이 좋습니다.",
      ],
    },
    {
      heading: "갱신을 요구하기 전에 챙길 것",
      body: [
        "먼저 계약서에서 만료일을 확인하고 달력에 '만료 6개월 전'과 '만료 2개월 전'을 표시해 두세요. 집주인과 말로 이야기가 끝났더라도 요구했다는 사실과 날짜가 남도록 문자나 내용증명으로 한 번 더 보내 두면 나중에 다툼을 줄일 수 있습니다.",
        "보증금이 오르는 갱신 계약서도 주민센터 같은 확정일자 부여기관에서 확정일자를 받아 둘 수 있습니다(제3조의6). 전세대출을 쓰고 있다면 갱신 계약서를 들고 은행에 기한 연장이나 추가 대출을 상담하고, 전세보증금 반환보증에 가입했다면 보증기간을 연장해야 하는지도 확인하세요.",
        "집주인이 거절 사유를 대거나 금액을 두고 의견이 다르면 주택임대차분쟁조정위원회에 조정을 신청할 수 있습니다. 대한법률구조공단 지부, 한국토지주택공사 지사 등에 있고 보증금·월세 증감과 임대차 기간에 관한 다툼을 다룹니다(제14조). 개별 사정에 따라 결론이 달라질 수 있으니 법률 판단이 필요하면 대한법률구조공단이나 변호사에게 확인하세요.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 – 주택임대차보호법(제4조, 제6조~제7조의2)", url: "https://www.law.go.kr/법령/주택임대차보호법" },
    { label: "국가법령정보센터 – 주택임대차보호법 시행령(제8조, 제9조)", url: "https://www.law.go.kr/법령/주택임대차보호법시행령" },
    { label: "법무부 – 「주택임대차보호법」 해설집(2020.8.)", url: "https://www.moj.go.kr/bbs/moj/118/530043/artclView.do" },
    { label: "한국은행 – 한국은행 기준금리 추이", url: "https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643" },
  ],
};

// ───────────── 4. 금리인하요구권 ─────────────
// 금리인하 요구: 은행법 제30조의2, 같은 법 시행령 제18조의4(요구를 받은 날부터 10영업일 이내에 수용 여부와 사유 통지).
// 보험업법 제110조의3, 상호저축은행법 제14조의2, 여신전문금융업법 제50조의13에도 같은 규정. 출처: 국가법령정보센터, 확인 2026-11-27
const CUT_NOTICE_BUSINESS_DAYS = 10;
// 은행이 금리인하요구권을 알리지 않으면 2천만 원 이하 과태료(은행법 제69조)
const CUT_FINE_LIMIT = 20_000_000;
const CUTS = [0.003, 0.005, 0.01];
const CUT_BASE_RATE = 0.05; // 예시 대출의 지금 금리(가정)
const cutBulletAmounts = [30_000_000, 50_000_000, 100_000_000, 200_000_000];
// 만기일시(신용대출·마이너스통장 등): 1년 이자 절감
const yearInterest = (amount: number, rate: number) => calcLoan(amount, rate, 12, "bullet").totalInterest;
const cutBulletRows = cutBulletAmounts.map((a) => ({ a, base: yearInterest(a, CUT_BASE_RATE), saves: CUTS.map((c) => yearInterest(a, CUT_BASE_RATE) - yearInterest(a, CUT_BASE_RATE - c)) }));
const cutHead = cutBulletRows.find((r) => r.a === 50_000_000)!;
// 원리금균등(주택담보대출 등): 남은 기간 동안의 월 상환액과 총 이자 변화
const CUT_MORTGAGE = { amount: 300_000_000, rate: 0.04, months: 360 };
const mortgageBase = calcLoan(CUT_MORTGAGE.amount, CUT_MORTGAGE.rate, CUT_MORTGAGE.months, "annuity");
const mortgageRows = CUTS.map((c) => {
  const r = calcLoan(CUT_MORTGAGE.amount, CUT_MORTGAGE.rate - c, CUT_MORTGAGE.months, "annuity");
  return { c, monthly: r.firstPayment, monthlySave: mortgageBase.firstPayment - r.firstPayment, totalSave: mortgageBase.totalInterest - r.totalInterest };
});
const CUT_REMAIN = { amount: 100_000_000, rate: 0.045, months: 120 };
const remainBase = calcLoan(CUT_REMAIN.amount, CUT_REMAIN.rate, CUT_REMAIN.months, "annuity");
const remainCut = calcLoan(CUT_REMAIN.amount, CUT_REMAIN.rate - 0.005, CUT_REMAIN.months, "annuity");
const pp = (c: number) => `${(c * 100).toFixed(1)}%포인트`;
// 남은 원금·남은 기간별로 0.5%포인트 내려갈 때 남은 기간 이자 절감(원리금균등, 지금 금리 연 4.5% 가정)
const REMAIN_RATE = 0.045;
const REMAIN_CUT = 0.005;
const remainPrincipals = [50_000_000, 100_000_000, 200_000_000, 300_000_000];
const remainYears = [5, 10, 20];
const remainSave = (amount: number, years: number) =>
  calcLoan(amount, REMAIN_RATE, years * 12, "annuity").totalInterest - calcLoan(amount, REMAIN_RATE - REMAIN_CUT, years * 12, "annuity").totalInterest;
const remainMonthlySave = (amount: number, years: number) =>
  calcLoan(amount, REMAIN_RATE, years * 12, "annuity").firstPayment - calcLoan(amount, REMAIN_RATE - REMAIN_CUT, years * 12, "annuity").firstPayment;

const rateCutRequestGuide: Guide = {
  slug: "interest-rate-cut-request",
  title: "금리인하요구권 쓰는 법: 0.5%포인트만 내려도 이자가 얼마나 줄까",
  description:
    "취업·승진·소득 증가·신용점수 상승으로 신용상태가 좋아졌을 때 대출 금리를 낮춰 달라고 요구하는 금리인하요구권의 근거 법, 신청 방법, 10영업일 통지 기한과 이자 절감 계산 예시를 정리했습니다.",
  date: "2026-12-18",
  tool: "loan-interest",
  sections: [
    {
      heading: "신용상태가 좋아졌다면 금리를 낮춰 달라고 요구할 수 있습니다",
      body: [
        `연 ${pct(CUT_BASE_RATE)}로 ${man(cutHead.a)}을 빌린 신용대출(만기일시) 금리가 ${pp(0.005)} 내려가면 1년 이자가 약 ${man(cutHead.saves[1])} 줄어듭니다. 대출을 받은 뒤 취업, 승진, 소득 증가, 신용점수 상승처럼 신용상태가 좋아졌다면 금융회사에 금리를 낮춰 달라고 요구할 수 있는데, 이것이 금리인하요구권입니다.`,
        "근거는 법에 있습니다. 은행법 제30조의2는 은행과 대출 같은 신용공여 계약을 맺은 사람이 재산 증가나 신용등급·개인신용평점 상승 등 신용상태 개선이 나타나면 금리인하를 요구할 수 있다고 정합니다. 보험회사(보험업법 제110조의3), 저축은행(상호저축은행법 제14조의2), 카드사·캐피탈 같은 여신전문금융회사(여신전문금융업법 제50조의13)에도 같은 규정이 있습니다.",
        `금융회사는 대출 계약을 맺으려는 사람에게 이 권리를 알려야 합니다. 은행이 알리지 않으면 ${man(CUT_FINE_LIMIT)} 이하의 과태료 대상입니다(은행법 제69조). 대출을 받을 때 한 번 안내받고 지나치기 쉬우니, 연봉이 오르거나 신용점수가 오른 시점에 스스로 챙기는 것이 좋습니다.`,
      ],
    },
    {
      heading: "신청할 수 있는 경우",
      body: [
        "은행법 시행령 제18조의4는 개인이 대출을 받은 경우 '취업, 승진, 재산 증가 또는 개인신용평점 상승 등 신용상태의 개선이 나타났다고 인정되는 경우'에 요구할 수 있다고 정합니다. 개인사업자를 포함한 사업자는 재무상태 개선이나 신용등급·평점 상승이 기준입니다.",
        "정책브리핑 안내에 따르면 이직이나 전문자격 취득으로 소득이 늘어난 경우, 빚을 줄여 자산 상태가 나아진 경우, 신용평가회사의 개인신용평점이 오른 경우가 대표적인 예입니다. 은행마다 자체 우대 등급 상향 같은 사유를 따로 두기도 합니다.",
        "핵심은 '대출을 받을 때보다 갚을 능력이 좋아졌다'는 것을 보여 주는 것입니다. 금리는 은행 내부 신용평가로 정하므로, 같은 사유라도 은행 내부 등급이 바뀌지 않으면 금리가 그대로일 수 있습니다. 이미 그 상품의 가장 낮은 금리를 받고 있다면 더 내려가기 어렵습니다.",
      ],
    },
    {
      heading: "대상이 아닌 대출도 있습니다",
      body: [
        "금리인하요구권은 빌린 사람의 신용상태에 따라 금리가 달라지는 대출에 쓰는 권리입니다. 금융위원회는 '신용상태가 금리에 영향을 주지 않는 경우 이외의 모든 대출'이 대상이라고 설명합니다. 거꾸로 말하면 신용상태와 관계없이 금리가 정해지는 대출은 요구해도 받아들여지기 어렵습니다.",
        "정책브리핑은 햇살론처럼 외부 기관과 협약한 정책자금 대출, 예적금·청약·펀드·신탁을 담보로 한 대출, 신용등급에 따라 금리 차이가 없는 대출 등을 예로 들었습니다. 정부가 금리를 정해 고시하는 정책 대출도 신용상태로 금리가 바뀌지 않는다면 같은 이유로 대상이 아닐 수 있습니다. 상품마다 다르므로 대출을 받은 금융회사에 먼저 물어보세요.",
      ],
    },
    {
      heading: "신청 방법과 결과를 받는 기한",
      body: [
        "대출을 받은 금융회사 영업점을 찾아가거나, 인터넷·모바일 뱅킹의 대출 메뉴에서 '금리인하요구'를 찾아 신청합니다. 정책브리핑은 금리인하 신청서와 함께 재직증명서, 근로소득 원천징수영수증 등 신용상태가 좋아졌음을 보여 주는 자료를 내는 것으로 안내합니다.",
        `금융회사는 요구를 받은 날부터 ${CUT_NOTICE_BUSINESS_DAYS}영업일 안에 받아들일지와 그 이유를 전화, 서면, 문자메시지, 전자우편, 팩스 등으로 알려야 합니다(은행법 시행령 제18조의4제3항). 자료를 더 내 달라고 요청받았다면 요청한 날부터 자료를 낸 날까지는 이 기간에 들어가지 않습니다. 영업일은 주말과 공휴일을 뺀 날이라 달력으로는 2주 남짓입니다.`,
        "금융위원회는 2021년 운영 개선 방안에서 신용상태가 좋아졌다면 신청 횟수나 시점과 관계없이 권리를 쓸 수 있다고 안내하도록 했고, 대출 기간 중 연 2회 문자·이메일 등으로 정기 안내하는 방안을 내놓았습니다. 정책브리핑에 따르면 신청이 거절되어도 금리가 오르는 불이익은 없습니다.",
      ],
    },
    {
      heading: "신용대출이라면 1년 이자가 이만큼 줄어듭니다",
      body: [
        `신용대출이나 마이너스통장처럼 매달 이자만 내는 대출은 금리가 내려간 만큼 이자가 그대로 줄어듭니다. 아래는 지금 금리 연 ${pct(CUT_BASE_RATE)}에서 ${CUTS.map(pp).join("·")} 내려갈 때 1년 이자가 얼마나 줄어드는지 계산한 것입니다.`,
      ],
      table: {
        caption: `대출 금액별 금리인하 폭에 따른 1년 이자 절감 (만기일시, 지금 금리 연 ${pct(CUT_BASE_RATE)} 가정)`,
        head: ["대출 금액", "지금 1년 이자", ...CUTS.map((c) => `${pp(c)} 인하`)],
        rows: cutBulletRows.map((r) => [eok(r.a), man(r.base), ...r.saves.map((v) => `${man(v)} 절감`)]),
        note: "이 사이트 대출이자 계산기와 같은 식(만기일시, 월 이자 = 대출금 × 연 금리 ÷ 12)으로 12개월 이자를 더했습니다. 만기일시 대출은 지금 금리가 몇 %든 줄어드는 이자는 '대출금 × 인하 폭'과 같습니다.",
      },
      after: [
        `0.3%포인트라도 ${eok(100_000_000)}이면 1년에 ${man(cutBulletRows[2].saves[0])}입니다. 신청하는 데 드는 비용은 서류를 준비하는 시간 정도이니, 연봉 인상이나 승진이 반영된 원천징수영수증을 받는 시점에 맞춰 신청해 보는 것이 좋습니다.`,
      ],
    },
    {
      heading: "주택담보대출처럼 긴 대출은 효과가 더 큽니다",
      body: [
        `원리금균등으로 오래 갚는 대출은 금리가 조금만 내려가도 남은 기간 전체의 이자가 줄어듭니다. ${eok(CUT_MORTGAGE.amount)}을 연 ${pct(CUT_MORTGAGE.rate)}, ${CUT_MORTGAGE.months / 12}년 원리금균등으로 빌렸다면 지금 월 상환액은 약 ${won(mortgageBase.firstPayment)}입니다. 처음부터 금리가 내려간 경우로 계산하면 아래와 같습니다.`,
      ],
      table: {
        caption: `${eok(CUT_MORTGAGE.amount)} · 연 ${pct(CUT_MORTGAGE.rate)} · ${CUT_MORTGAGE.months / 12}년 원리금균등 대출의 금리인하 효과`,
        head: ["인하 폭", "인하 후 금리", "월 상환액", "월 절감", "전체 기간 이자 절감"],
        rows: mortgageRows.map((r) => [pp(r.c), `연 ${pct(CUT_MORTGAGE.rate - r.c)}`, won(r.monthly), won(r.monthlySave), man(r.totalSave)]),
        note: "대출 첫날부터 인하된 금리가 끝까지 유지된다고 가정했습니다. 실제로는 이미 갚은 기간이 있으므로 남은 원금과 남은 기간을 대출이자 계산기에 넣어 다시 계산하세요.",
      },
      after: [
        "요구가 받아들여지면 새 금리가 언제부터, 얼마나 적용되는지 결과 통지와 바뀐 약정 내용을 꼭 확인하세요. 남은 기간이 길수록 같은 인하 폭이라도 줄어드는 이자가 커지므로, 장기 대출일수록 신용상태가 좋아진 시점을 놓치지 않는 것이 중요합니다.",
      ],
    },
    {
      heading: "이미 갚고 있는 대출은 남은 원금으로 계산합니다",
      body: [
        `금리가 내려가는 시점은 대출 중간이므로, 실제 효과는 그때 남은 원금과 남은 기간으로 계산해야 합니다. 예를 들어 남은 원금이 ${eok(CUT_REMAIN.amount)}이고 남은 기간이 ${CUT_REMAIN.months / 12}년, 금리가 연 ${pct(CUT_REMAIN.rate)}일 때 ${pp(0.005)} 내려가면 월 상환액은 약 ${won(remainBase.firstPayment - remainCut.firstPayment)}, 남은 기간 이자는 약 ${man(remainBase.totalInterest - remainCut.totalInterest)} 줄어듭니다.`,
        "남은 원금이 많고 남은 기간이 길수록 절감액이 커집니다. 대출 잔액은 금융회사 앱의 대출 조회 화면에서 확인할 수 있으니, 그 숫자를 대출이자 계산기에 넣고 금리만 바꿔 두 번 계산하면 내 대출의 효과를 바로 알 수 있습니다.",
      ],
      table: {
        caption: `남은 원금·남은 기간별 ${pp(REMAIN_CUT)} 인하 시 남은 기간 이자 절감 (원리금균등, 지금 금리 연 ${pct(REMAIN_RATE)} 가정)`,
        head: ["남은 원금", ...remainYears.map((y) => `남은 기간 ${y}년`)],
        rows: remainPrincipals.map((a) => [eok(a), ...remainYears.map((y) => `${man(remainSave(a, y))} (월 ${won(remainMonthlySave(a, y))})`)]),
        note: "괄호는 월 상환액 감소분입니다. 원리금균등 상환 방식으로 남은 기간 동안 인하된 금리가 유지된다고 가정했고, 중도상환수수료나 다른 비용은 넣지 않았습니다.",
      },
    },
    {
      heading: "거절되었다면 이렇게 하세요",
      body: [
        "금융위원회가 제시한 거절 사유 안내 예시에는 '그 대출 상품이 금리인하 대상이 아님', '내부 신용등급이 충분히 오르지 않음', '이미 가장 높은 등급이라 더 내릴 수 없음' 같은 유형이 있습니다. 통지받은 사유를 보면 다음에 무엇을 바꿔야 할지 알 수 있습니다.",
        "신용등급이 충분히 오르지 않았다는 이유라면 연체 없이 몇 달 더 쓰고 소득 자료가 쌓인 뒤 다시 신청해 볼 수 있습니다. 상품이 대상이 아니라면 다른 금융회사의 대출로 갈아타는 대환대출을 비교해 보세요. 이때는 지금 대출의 중도상환수수료와 새 대출의 금리·부대비용을 대출이자 계산기로 함께 따져야 합니다.",
        "심사 기준과 대상 상품은 금융회사와 상품마다 다릅니다. 신청 전 대출받은 금융회사 상담 창구에서 내 대출이 대상인지와 필요한 서류를 확인하고, 처리에 문제가 있다고 느끼면 금융감독원(1332)에 상담할 수 있습니다.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 – 은행법 제30조의2(금리인하 요구)", url: "https://www.law.go.kr/법령/은행법" },
    { label: "국가법령정보센터 – 은행법 시행령 제18조의4(금리인하 요구)", url: "https://www.law.go.kr/법령/은행법시행령" },
    { label: "금융위원회 – 금리인하요구권 운영 개선 보도자료(2021-11-01)", url: "https://www.fsc.go.kr/po010101/76792" },
    { label: "대한민국 정책브리핑 – 금리인하요구권 신청자격·방법(2023-03-03)", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148912299" },
  ],
};

// ───────────── 5. 예금 만기 재예치와 풍차 돌리기 ─────────────
// 이자소득 원천징수: 소득세 14% + 지방소득세(소득세의 10%) = 15.4%. RATES.interestTax.normal을 씁니다.
// 출처: 국세청 원천징수 세율(https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2291&cntntsId=7703), 확인 2026-11-27
const INTEREST_TAX = RATES.interestTax.normal;
// 이자·배당소득 종합과세 기준금액 연 2천만 원(소득세법 제14조제3항제6호). 출처: https://www.law.go.kr/법령/소득세법, 확인 2026-11-27
const FIN_INCOME_THRESHOLD = 20_000_000;
// 예금자보호 한도: 2025년 9월 1일부터 1인당 금융회사별 원금과 이자를 합쳐 1억 원(이전 5천만 원).
// 출처: 예금자보호법 시행령 제18조제7항(https://www.law.go.kr/법령/예금자보호법시행령),
// 정책브리핑 2025-07-22(https://www.korea.kr/news/policyNewsView.do?newsId=148946400), 확인 2026-11-27
const DEPOSIT_PROTECTION = 100_000_000;
const DEPOSIT_PROTECTION_OLD = 50_000_000;
// 비교 예시의 금리는 모두 가정입니다(실제 금리는 금융회사·시점마다 다름).
const DEP_RATE_12 = 0.03; // 1년 정기예금 가정 금리
const DEP_RATE_6 = 0.028; // 6개월 정기예금 가정 금리
const DEP_TOTAL = 12_000_000;
const DEP_MONTHLY = DEP_TOTAL / 12;
const dep = (amount: number, rate: number, months: number) =>
  calcSavings({ kind: "deposit", amount, annualRate: rate, months, interestType: "simple", taxRate: INTEREST_TAX });
const depA = dep(DEP_TOTAL, DEP_RATE_12, 12);
const depB1 = dep(DEP_TOTAL, DEP_RATE_6, 6);
const depB2 = dep(depB1.afterTax, DEP_RATE_6, 6);
const depC = calcSavings({ kind: "installment", amount: DEP_MONTHLY, annualRate: DEP_RATE_12, months: 12, interestType: "simple", taxRate: INTEREST_TAX });
const depDOne = dep(DEP_MONTHLY, DEP_RATE_12, 12);
const depD = { interest: depDOne.interest * 12, tax: depDOne.tax * 12, afterTax: depDOne.afterTax * 12 };
const depCompare = [
  { label: `${man(DEP_TOTAL)}을 1년 예금에 한 번에 (연 ${pct(DEP_RATE_12)})`, interest: depA.interest, tax: depA.tax, end: "12개월 뒤" },
  {
    label: `${man(DEP_TOTAL)}을 6개월 예금에 넣고 만기 원리금을 6개월 더 (연 ${pct(DEP_RATE_6)})`,
    interest: depB1.interest + depB2.interest,
    tax: depB1.tax + depB2.tax,
    end: "12개월 뒤",
  },
  { label: `매달 ${man(DEP_MONTHLY)}씩 1년 적금 (연 ${pct(DEP_RATE_12)})`, interest: depC.interest, tax: depC.tax, end: "12개월 뒤" },
  { label: `매달 ${man(DEP_MONTHLY)}씩 1년 예금 12개, 풍차 돌리기 (연 ${pct(DEP_RATE_12)})`, interest: depD.interest, tax: depD.tax, end: "23개월 뒤(첫 만기는 12개월 뒤)" },
];
// 만기 뒤 재예치하지 않고 둔 기간 동안, 같은 금리로 새로 넣었다면 받았을 세후 이자
const idleAmounts = [10_000_000, 30_000_000, 50_000_000, 100_000_000];
const idleMonths = [1, 3, 6];
const idleLost = (amount: number, months: number) => {
  const r = dep(amount, DEP_RATE_12, months);
  return r.afterTax - r.principal;
};
// 원금 + 1년 세전 이자가 보호 한도를 넘지 않는 최대 원금(연 3.0% 가정)
const protectMaxPrincipal = Math.floor(DEPOSIT_PROTECTION / (1 + DEP_RATE_12) / 10_000) * 10_000;
// 이자소득 2천만 원이 되려면 연 3.0%에서 원금이 얼마인지
const thresholdPrincipal = FIN_INCOME_THRESHOLD / DEP_RATE_12;
// 금리별로 1년 만기 원리금(세전)이 보호 한도 안에 드는 최대 원금
const protectRates = [0.025, 0.03, 0.035, 0.04];
const protectMax = (rate: number) => Math.floor(DEPOSIT_PROTECTION / (1 + rate) / 10_000) * 10_000;
// 1년 예금을 해마다 세후 원리금 그대로 재예치할 때와, 처음 원금만 해마다 다시 넣고 이자는 빼서 쓸 때(연 3.0% 가정)
const REINVEST_PRINCIPAL = 10_000_000;
const reinvestYears = [1, 2, 3, 5];
const reinvestPath = (() => {
  const out: { year: number; rolled: number; simple: number }[] = [];
  let rolled = REINVEST_PRINCIPAL;
  let simpleInterest = 0;
  for (let y = 1; y <= Math.max(...reinvestYears); y++) {
    rolled = dep(rolled, DEP_RATE_12, 12).afterTax;
    simpleInterest += dep(REINVEST_PRINCIPAL, DEP_RATE_12, 12).afterTax - REINVEST_PRINCIPAL;
    if (reinvestYears.includes(y)) out.push({ year: y, rolled, simple: REINVEST_PRINCIPAL + simpleInterest });
  }
  return out;
})();

const depositReinvestGuide: Guide = {
  slug: "deposit-maturity-reinvest",
  title: "연말 예금 만기, 재예치와 예금 풍차 돌리기 계산해 보기",
  description:
    "정기예금 만기 뒤 이자가 줄어드는 이유와 재예치 요령, 이자소득세 15.4%, 1억 원 예금자보호 한도, 1년 예금·6개월 두 번·매달 나눠 넣는 풍차 돌리기를 같은 조건으로 비교했습니다.",
  date: "2026-12-24",
  tool: "savings-interest",
  sections: [
    {
      heading: "만기가 지나면 이자가 크게 줄어듭니다",
      body: [
        `${man(DEP_TOTAL)}을 연 ${pct(DEP_RATE_12)}(가정) 1년 정기예금에 넣으면 만기에 세후 이자 약 ${won(depA.afterTax - depA.principal)}을 받습니다. 그런데 만기가 지난 뒤 찾지 않고 그대로 두면 약정한 금리가 아니라 그보다 훨씬 낮은 '만기 후 이자율'이 적용됩니다. 연말에 만기가 몰린 예금이 있다면 만기일에 맞춰 어디에 다시 넣을지 정해 두는 것이 이자를 지키는 첫걸음입니다.`,
        "금융위원회는 예·적금은 보통 만기 뒤 금리가 크게 떨어지고, 소멸시효가 지나면 이자가 아예 붙지 않는다고 설명합니다. 그래서 2023년에 금융회사가 계약할 때와 계약 기간 중 연 1회, 만기 직전에 만기 후 금리가 떨어진다는 사실과 만기 때 자동으로 돈을 넣을 계좌를 정하는 방법을 안내하도록 기준을 고쳤습니다.",
        "만기 후 이자율은 상품과 금융회사마다 다르고, 만기에서 오래 지날수록 더 낮아지는 경우가 많습니다. 정확한 숫자는 가입한 상품의 설명서나 은행 앱의 상품 정보에서 확인하세요.",
      ],
      table: {
        caption: `만기 뒤 재예치하지 않고 둔 기간 동안 놓치는 이자 (같은 연 ${pct(DEP_RATE_12)}로 새로 넣었다면 받았을 세후 이자)`,
        head: ["예금 금액", ...idleMonths.map((m) => `${m}개월 방치`)],
        rows: idleAmounts.map((a) => [eok(a), ...idleMonths.map((m) => won(idleLost(a, m)))]),
        note: "예금·적금 이자 계산기와 같은 식(단리, 이자소득세 15.4%)으로 계산했습니다. 실제로는 이 기간에 만기 후 이자율만큼의 이자는 붙으므로, 놓치는 금액은 표보다 그만큼 적습니다.",
      },
    },
    {
      heading: "이자에서 15.4%가 먼저 빠집니다",
      body: [
        `예금 이자에는 소득세 14%와 지방소득세 1.4%를 더한 ${pct(INTEREST_TAX)}가 원천징수됩니다. 은행이 이자를 줄 때 세금을 먼저 떼고 주기 때문에, 광고하는 금리 그대로 받는 것이 아니라 세후로는 약정 금리의 약 ${pct(1 - INTEREST_TAX, 1)}만 남는다고 보면 됩니다. 연 ${pct(DEP_RATE_12)}라면 세후로는 연 약 ${pct(DEP_RATE_12 * (1 - INTEREST_TAX), 2)}입니다.`,
        `이자와 배당을 합친 금융소득이 한 해 ${man(FIN_INCOME_THRESHOLD)}을 넘으면 그 넘는 부분은 다른 소득과 합쳐 종합소득세로 다시 계산합니다(소득세법 제14조). 연 ${pct(DEP_RATE_12)} 예금이라면 원금이 약 ${eok(thresholdPrincipal)}일 때 1년 이자가 ${man(FIN_INCOME_THRESHOLD)}이 됩니다. 만기가 같은 해에 몰리면 그해 이자가 커지므로, 큰돈은 만기를 해마다 나눠 두는 것도 방법입니다.`,
      ],
    },
    {
      heading: "예금자보호는 금융회사별 1억 원까지",
      body: [
        `2025년 9월 1일부터 예금자보호 한도가 ${man(DEPOSIT_PROTECTION_OLD)}에서 ${eok(DEPOSIT_PROTECTION)}으로 올랐습니다(예금자보호법 시행령 제18조). 원금과 이자를 합쳐 금융회사별로 계산하고, 농협·수협·신협·새마을금고 같은 상호금융도 각 중앙회가 같은 금액으로 보호합니다. 펀드처럼 운용 실적에 따라 받는 돈이 달라지는 상품은 보호 대상이 아닙니다.`,
        `재예치할 때는 이자까지 원금으로 들어가므로 같은 은행의 예금이 한도를 넘지 않는지 다시 확인해야 합니다. 연 ${pct(DEP_RATE_12)} 1년 예금이라면 원금을 약 ${man(protectMaxPrincipal)} 이하로 넣어야 만기 원리금(세전)이 ${eok(DEPOSIT_PROTECTION)} 안에 들어옵니다. 그보다 많다면 다른 금융회사에 나눠 넣으세요.`,
      ],
      table: {
        caption: `1년 만기 원리금(세전)이 ${eok(DEPOSIT_PROTECTION)} 안에 드는 최대 원금`,
        head: ["1년 예금 금리", "최대 원금(만 원 단위 버림)", "만기 원리금(세전)"],
        rows: protectRates.map((r) => [`연 ${pct(r)}`, man(protectMax(r)), won(protectMax(r) * (1 + r))]),
        note: "같은 금융회사에 이미 다른 예금·적금이 있다면 그 원리금까지 합쳐 한도를 계산합니다. 예금자보호 한도와 보호 대상 상품은 예금보험공사나 각 중앙회 안내에서 확인하세요.",
      },
    },
    {
      heading: "1년 예금, 6개월 두 번, 풍차 돌리기 비교",
      body: [
        `같은 ${man(DEP_TOTAL)}을 굴리는 네 가지 방법을 같은 조건으로 계산했습니다. 금리는 모두 가정이며, 보통 짧은 만기의 금리가 조금 낮다고 보고 6개월 예금은 연 ${pct(DEP_RATE_6)}로 잡았습니다.`,
      ],
      table: {
        caption: `${man(DEP_TOTAL)}을 굴리는 방법별 이자 비교 (단리, 이자소득세 ${pct(INTEREST_TAX)}, 금리는 가정)`,
        head: ["방법", "이자(세전)", "세금", "세후 이자", "마지막 돈을 찾는 때"],
        rows: depCompare.map((r) => [r.label, won(r.interest), won(r.tax), won(r.interest - r.tax), r.end]),
        note: "예금·적금 이자 계산기와 같은 식으로 계산했습니다. 6개월 예금은 첫 만기의 세후 원리금을 같은 금리로 다시 넣는다고 가정했습니다. 실제 금리는 금융회사·가입 시점·우대 조건에 따라 다릅니다.",
      },
      after: [
        "1년 예금과 풍차 돌리기의 세후 이자가 같은 것은, 풍차 돌리기도 결국 돈마다 1년 예금에 넣기 때문입니다. 차이는 돈이 묶이는 모양입니다. 한 번에 넣으면 12개월 뒤 한 번에 찾고, 풍차 돌리기는 시작하고 12개월 뒤부터 매달 하나씩 만기가 돌아옵니다. 대신 마지막에 든 예금은 23개월 뒤에 끝납니다.",
        "매달 같은 돈을 넣는 적금은 첫 달 돈은 12개월, 마지막 달 돈은 1개월만 이자가 붙어 평균 6.5개월 치 이자를 받습니다. 그래서 같은 연 3.0%라도 적금 이자는 1년 예금의 절반 남짓입니다. 풍차 돌리기는 돈마다 12개월씩 이자가 붙는 대신 마지막 돈을 23개월 뒤에야 찾으므로, 돈이 예금에 머문 기간을 따지면 두 방법 모두 연 3.0%를 받는 것은 같습니다. 매달 돈이 생기고 1년 넘게 쓸 일이 없다면 풍차 돌리기가, 1년 뒤 목돈이 꼭 필요하다면 적금이 맞습니다.",
      ],
    },
    {
      heading: "재예치하면 이자에도 이자가 붙습니다",
      body: [
        `만기 때 세후 원리금을 통째로 다시 넣으면 다음 해에는 이자에도 이자가 붙습니다. ${man(REINVEST_PRINCIPAL)}을 연 ${pct(DEP_RATE_12)}(가정) 1년 예금에 넣고 해마다 원리금을 그대로 재예치한 경우와, 해마다 이자만 빼서 쓰고 원금만 다시 넣은 경우를 비교했습니다.`,
      ],
      table: {
        caption: `${man(REINVEST_PRINCIPAL)}을 1년 예금으로 해마다 굴릴 때 (연 ${pct(DEP_RATE_12)} 가정, 세후)`,
        head: ["기간", "원리금 통째로 재예치", "이자는 빼고 원금만 재예치(원금+받은 이자 합계)", "차이"],
        rows: reinvestPath.map((r) => [`${r.year}년 뒤`, won(r.rolled), won(r.simple), won(r.rolled - r.simple)]),
        note: "금리가 해마다 같다고 가정했고, 이자는 만기마다 15.4%를 떼고 계산했습니다. 실제 재예치 금리는 그때의 금리로 정해집니다.",
      },
      after: [
        "차이가 크지는 않지만 기간이 길수록 벌어집니다. 더 중요한 것은 만기 뒤 며칠, 몇 주씩 방치하는 시간을 없애는 것입니다. 첫 번째 표처럼 방치한 기간의 이자는 재예치로 얻는 복리 효과보다 클 수 있습니다.",
      ],
    },
    {
      heading: "예금 풍차 돌리기는 이렇게 합니다",
      body: [
        "풍차 돌리기는 매달 1년 만기 예금을 하나씩 새로 드는 방식입니다. 1년이 지나면 첫 달에 든 예금부터 매달 하나씩 만기가 돌아오고, 만기된 원리금에 그달 새로 모은 돈을 더해 다시 1년 예금에 넣으면 바람개비처럼 계속 굴러갑니다.",
        "장점은 돈이 필요할 때 한 달만 기다리면 예금 하나를 깨지 않고 찾을 수 있다는 점입니다. 급히 돈이 필요해 1년 예금 전체를 중도해지하면 약정 금리보다 낮은 중도해지 이율을 받게 되지만, 풍차 돌리기는 필요한 만큼만 해지하거나 곧 만기가 오는 것을 기다리면 됩니다.",
        "단점은 계좌가 많아 관리가 번거롭다는 점입니다. 만기일과 금액을 표로 정리해 두고, 만기 때 원리금이 들어갈 계좌를 미리 지정해 두면 놓치는 일을 줄일 수 있습니다. 금리가 오를 때는 매달 새 금리로 갈아탈 수 있지만, 금리가 내려갈 때는 한 번에 긴 만기로 묶어 두는 편이 나을 수도 있습니다.",
      ],
    },
    {
      heading: "연말 만기에 하면 좋은 일",
      body: [
        "만기일을 알면 그 전에 다음 예금을 정해 둘 수 있습니다. 은행 앱에서 만기 때 원리금을 자동으로 넣을 계좌를 지정할 수 있는지, 상품에 자동 재예치 기능이 있는지 확인해 두세요. 자동 재예치는 편리하지만 그때의 금리가 다른 상품보다 낮을 수 있으니 한 번은 비교해 보는 것이 좋습니다.",
        "정기예금 이자는 실제로 이자를 받은 날이 속한 해의 소득으로 봅니다(소득세법 시행령 제45조). 금융소득이 2천만 원 근처라면 만기일이 12월인지 1월인지에 따라 그해 금융소득이 달라지니 함께 따져 보세요. 이자가 작은 경우라도, 비상금으로 둘 돈과 1년 이상 묶어도 되는 돈을 나눠 서로 다른 상품에 넣으면 만기 때마다 고민이 줄어듭니다.",
        "다음에 넣을 상품을 고를 때는 금융감독원의 '금융상품 한눈에'에서 금융회사별 예금 금리를 한 화면에 비교할 수 있습니다. 오래전에 들어 놓고 잊은 예금이나 만기가 지난 계좌가 있는지는 금융감독원 파인의 '내계좌 한눈에'에서 조회할 수 있으니, 연말에 한 번 확인해 찾아갈 돈이 없는지 살펴보세요.",
        "예금·적금 이자 계산기에 금액, 금리, 기간을 넣으면 세후 이자를 바로 확인할 수 있습니다. 예금자보호 한도나 세금은 개인의 다른 금융자산과 소득에 따라 달라지므로, 금액이 크다면 거래하는 금융회사나 국세청 상담(126)으로 내 조건을 확인하세요.",
      ],
    },
  ],
  sources: [
    { label: "금융위원회 – 숨은 금융자산 예방을 위한 소비자보호기준 개선(2023-01-31)", url: "https://www.fsc.go.kr/po010105/79357" },
    { label: "국세청 – 원천징수 세율", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2291&cntntsId=7703" },
    { label: "국가법령정보센터 – 예금자보호법 시행령 제18조", url: "https://www.law.go.kr/법령/예금자보호법시행령" },
    { label: "대한민국 정책브리핑 – 9월 1일부터 예금보호한도 1억 원으로(2025-07-22)", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148946400" },
    { label: "국가법령정보센터 – 소득세법 제14조(과세표준의 계산)", url: "https://www.law.go.kr/법령/소득세법" },
  ],
};

// ───────────── 6. 연말 가계부 결산 ─────────────
// 예시 가구의 1년 지출(가정, 만 원). fixed: 매달 거의 같은 금액이 나가는 고정비
const BUDGET: { item: string; last: number; now: number; fixed: boolean }[] = [
  { item: "주거(월세·관리비)", last: 1_080, now: 1_104, fixed: true },
  { item: "식비(장보기)", last: 720, now: 780, fixed: false },
  { item: "외식·배달", last: 480, now: 552, fixed: false },
  { item: "교통(대중교통·주유)", last: 300, now: 288, fixed: false },
  { item: "통신", last: 132, now: 120, fixed: true },
  { item: "보험료", last: 360, now: 360, fixed: true },
  { item: "의류·미용", last: 240, now: 216, fixed: false },
  { item: "의료·건강", last: 120, now: 150, fixed: false },
  { item: "여가·여행", last: 300, now: 354, fixed: false },
  { item: "구독·멤버십", last: 60, now: 84, fixed: true },
  { item: "경조사·기타", last: 180, now: 168, fixed: false },
].map((b) => ({ ...b, last: b.last * 10_000, now: b.now * 10_000 }));
const budgetLast = BUDGET.reduce((a, b) => a + b.last, 0);
const budgetNow = BUDGET.reduce((a, b) => a + b.now, 0);
// 비중은 소수 첫째 자리로 반올림하고, %포인트 차이는 반올림한 비중끼리 뺍니다(표에 보이는 숫자와 맞추기 위해).
const round1 = (v: number) => Math.round(v * 10) / 10;
const budgetRows = BUDGET.map((b) => {
  const shareLast = round1(ratioPercent(b.last, budgetLast));
  const shareNow = round1(ratioPercent(b.now, budgetNow));
  return { ...b, shareLast, shareNow, change: changePercent(b.last, b.now), pointDiff: round1(shareNow - shareLast) };
});
const sign = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;
const pctText = (v: number, d = 1) => `${sign(v, d)}%`;
const ptText = (v: number, d = 1) => `${sign(v, d)}%p`;
const bFood = budgetRows.find((r) => r.item.startsWith("식비"))!;
const bOut = budgetRows.find((r) => r.item.startsWith("외식"))!;
const bHouse = budgetRows.find((r) => r.item.startsWith("주거"))!;
const fixedLast = BUDGET.filter((b) => b.fixed).reduce((a, b) => a + b.last, 0);
const fixedNow = BUDGET.filter((b) => b.fixed).reduce((a, b) => a + b.now, 0);
const varLast = budgetLast - fixedLast;
const varNow = budgetNow - fixedNow;
// 증가액이 큰 항목 순서
// 새해 외식·배달 비중을 1%포인트 낮출 때의 월 한도(내년 전체 지출을 올해와 같다고 가정)
const outTargetShare = round1(budgetRows.find((r) => r.item.startsWith("외식"))!.shareNow - 1);
const outMonthlyLimit = percentOf(budgetNow, outTargetShare) / 12;
const outMonthlyNow = budgetRows.find((r) => r.item.startsWith("외식"))!.now / 12;
const topIncrease = [...budgetRows].sort((a, b) => b.now - b.last - (a.now - a.last)).slice(0, 3);

// 국가데이터처 가계동향조사: 전국 1인 이상 가구(농림어가 포함) 가구당 월평균 소비지출(천 원, 명목).
// 출처: 국가데이터처 「2025년 4/4분기 가계동향조사 결과(2025년 연간 지출 포함)」 2026-02-26 보도자료·통계표
// (KDI 경제정보센터 게재 https://eiec.kdi.re.kr/policy/materialView.do?num=277383), 확인 2026-11-27
const HH_SURVEY: { item: string; y2024: number; y2025: number }[] = [
  { item: "식료품·비주류음료", y2024: 441, y2025: 449 },
  { item: "주류·담배", y2024: 38, y2025: 38 },
  { item: "의류·신발", y2024: 141, y2025: 141 },
  { item: "주거·수도·광열", y2024: 352, y2025: 361 },
  { item: "가정용품·가사서비스", y2024: 124, y2025: 120 },
  { item: "보건", y2024: 225, y2025: 228 },
  { item: "교통·운송", y2024: 335, y2025: 337 },
  { item: "정보통신", y2024: 165, y2025: 167 },
  { item: "오락·문화", y2024: 178, y2025: 175 },
  { item: "교육", y2024: 215, y2025: 209 },
  { item: "음식·숙박", y2024: 449, y2025: 465 },
  { item: "기타상품·서비스", y2024: 229, y2025: 250 },
];
const HH_TOTAL_2024 = 2_890; // 소비지출 합계(천 원)
const HH_TOTAL_2025 = 2_939;
const HH_REAL_CHANGE_2025 = -0.4; // 2025년 실질소비지출 증감률(%), 같은 보도자료
const HH_SAMPLE = 7_200; // 매월 조사 가구 수(약)
// 2026년 2/4분기 가구당 월평균 소비지출 293만 2천 원, 전년 동분기 대비 3.4% 증가.
// 출처: 국가데이터처 「2026년 2/4분기 가계동향조사 결과」 2026-08-27(https://eiec.kdi.re.kr/policy/materialView.do?num=285882), 확인 2026-11-27
const HH_2026Q2 = 2_932_000;
const HH_2026Q2_CHANGE = 3.4;
// 천 원 단위 금액을 "44만 9천 원"처럼 보여 줍니다.
const chun = (v: number) => {
  let m = Math.floor(v / 10_000);
  let c = Math.round((v - m * 10_000) / 1_000);
  if (c === 10) {
    m += 1;
    c = 0;
  }
  return c ? `${n(m)}만 ${c}천 원` : `${n(m)}만 원`;
};
const hhRows = HH_SURVEY.map((h) => ({ ...h, share: ratioPercent(h.y2025, HH_TOTAL_2025), change: changePercent(h.y2024, h.y2025) }));
const hhTop = [...hhRows].sort((a, b) => b.share - a.share).slice(0, 4);

const householdBudgetGuide: Guide = {
  slug: "household-budget-review-percent",
  title: "연말 가계부 결산: 지출 비중과 증감률, %와 %포인트로 정리하기",
  description:
    "1년 가계부를 항목별 지출 비중, 전년 대비 증감률, %포인트 차이로 정리하는 방법을 예시 가구로 계산하고, 고정비·변동비 나누기와 국가데이터처 가계동향조사 평균 비교까지 담았습니다.",
  date: "2026-12-26",
  tool: "percent",
  sections: [
    {
      heading: "결산은 두 가지 숫자면 충분합니다",
      body: [
        `1년 가계부 결산은 '항목별 비중'과 '작년 대비 증감률' 두 가지만 계산하면 됩니다. 예를 들어 장보기 식비가 작년 ${man(bFood.last)}에서 올해 ${man(bFood.now)}이 되었다면 증감률은 ${pctText(bFood.change)}이고, 올해 전체 지출 ${man(budgetNow)} 가운데 식비 비중은 ${bFood.shareNow.toFixed(1)}%입니다.`,
        "비중은 '항목 지출 ÷ 전체 지출 × 100', 증감률은 '(올해 − 작년) ÷ 작년 × 100'입니다. 퍼센트 계산기에서 'A는 B의 몇 %'에 항목과 전체를 넣으면 비중이, 'A에서 B로 몇 % 증감'에 작년과 올해 금액을 넣으면 증감률이 나옵니다. 비중은 돈이 어디로 가장 많이 가는지, 증감률은 무엇이 빠르게 늘었는지를 보여 줍니다.",
        "결산을 하려면 먼저 1년 치 지출을 같은 기준으로 모아야 합니다. 카드 명세서와 계좌 이체 내역을 내려받아 항목을 붙이고, 현금으로 쓴 돈은 기억나는 만큼 더합니다. 항목은 10개 안팎으로 묶어야 비교가 쉽고, 작년 결산이 있다면 같은 항목 이름을 그대로 써야 증감률을 구할 수 있습니다.",
      ],
    },
    {
      heading: "예시 가구로 따라 해 보기",
      body: [
        `아래는 월세로 사는 2인 가구를 가정해 만든 1년 지출입니다. 전체 지출은 작년 ${man(budgetLast)}에서 올해 ${man(budgetNow)}으로 ${pctText(changePercent(budgetLast, budgetNow))} 늘었습니다. 항목마다 올해 비중, 작년 대비 증감률, 비중이 몇 %포인트 바뀌었는지를 함께 적었습니다.`,
      ],
      table: {
        caption: "예시 가구의 1년 지출 결산 (가정한 금액)",
        head: ["항목", "작년", "올해", "올해 비중", "증감률", "비중 변화"],
        rows: [
          ...budgetRows.map((r) => [r.item, man(r.last), man(r.now), `${r.shareNow.toFixed(1)}%`, pctText(r.change), ptText(r.pointDiff)]),
          ["합계", man(budgetLast), man(budgetNow), "100.0%", pctText(changePercent(budgetLast, budgetNow)), "−"],
        ],
        note: "퍼센트 계산기와 같은 식(비중 = 항목 ÷ 합계 × 100, 증감률 = (올해 − 작년) ÷ 작년 × 100)으로 계산하고 소수 첫째 자리에서 반올림했습니다. 비중 변화는 반올림한 올해 비중에서 작년 비중을 뺀 값입니다.",
      },
      after: [
        `금액이 가장 많이 늘어난 항목은 ${topIncrease.map((r) => `${r.item} ${man(r.now - r.last)}`).join(", ")} 순입니다. 증감률만 보면 구독·멤버십(${pctText(budgetRows.find((r) => r.item.startsWith("구독"))!.change)})이 가장 크게 늘었지만 금액은 크지 않습니다. 결산할 때는 증감률과 금액을 같이 봐야 줄일 곳의 순서를 제대로 정할 수 있습니다.`,
      ],
    },
    {
      heading: "%와 %포인트를 헷갈리지 마세요",
      body: [
        `비중이 바뀐 정도를 말할 때는 %포인트(%p)를 씁니다. 예시 가구의 외식·배달 비중은 작년 ${bOut.shareLast.toFixed(1)}%에서 올해 ${bOut.shareNow.toFixed(1)}%로 ${ptText(bOut.pointDiff)} 바뀌었습니다. 같은 외식·배달 지출 금액은 ${pctText(bOut.change)} 늘었습니다. 둘 다 맞는 숫자지만 뜻이 다릅니다.`,
        `반대로 금액이 늘어도 비중은 줄 수 있습니다. 주거비는 ${man(bHouse.now - bHouse.last)} 늘었지만(${pctText(bHouse.change)}) 전체 지출이 더 빨리 늘어서 비중은 ${ptText(bHouse.pointDiff)} 바뀌었습니다. '주거비 비중이 줄었다'는 말이 '주거비가 줄었다'는 뜻이 아닌 이유입니다.`,
        `그래서 결산표에는 금액, 증감률(%), 비중 변화(%p)를 따로 칸을 나눠 적는 것이 좋습니다. 가족과 결산을 이야기할 때도 '외식이 ${pctText(bOut.change)} 늘었다'인지 '외식 비중이 ${ptText(bOut.pointDiff)} 바뀌었다'인지 구분하면 오해가 줄어듭니다.`,
      ],
    },
    {
      heading: "고정비와 변동비로 나눠 보기",
      body: [
        "고정비는 월세·관리비, 통신비, 보험료, 구독료처럼 매달 거의 같은 금액이 나가는 돈이고, 변동비는 식비·외식·쇼핑·여가처럼 쓰기에 따라 달라지는 돈입니다. 두 가지는 줄이는 방법이 다릅니다. 고정비는 한 번 계약을 바꾸면 매달 저절로 줄고, 변동비는 매달 쓰는 습관을 바꿔야 줄어듭니다.",
      ],
      table: {
        caption: "예시 가구의 고정비·변동비 (가정한 금액)",
        head: ["구분", "작년", "올해", "올해 비중", "증감률", "월평균(올해)"],
        rows: [
          ["고정비", man(fixedLast), man(fixedNow), `${ratioPercent(fixedNow, budgetNow).toFixed(1)}%`, pctText(changePercent(fixedLast, fixedNow)), man(fixedNow / 12)],
          ["변동비", man(varLast), man(varNow), `${ratioPercent(varNow, budgetNow).toFixed(1)}%`, pctText(changePercent(varLast, varNow)), man(varNow / 12)],
        ],
        note: "고정비: 주거, 통신, 보험료, 구독·멤버십. 변동비: 나머지 항목. 같은 항목도 집마다 성격이 다를 수 있으니 우리 집 기준으로 나누세요.",
      },
      after: [
        `예시 가구는 고정비가 ${pctText(changePercent(fixedLast, fixedNow))}, 변동비가 ${pctText(changePercent(varLast, varNow))} 늘었습니다. 고정비는 크게 늘지 않았으니 새해에는 변동비, 특히 증가액이 컸던 외식·배달과 장보기 식비 쪽에 월 한도를 정하는 것이 효과가 큽니다. 고정비 중에서는 통신 요금제나 쓰지 않는 구독을 정리하는 것처럼 한 번에 끝나는 일부터 하는 것이 좋습니다.`,
      ],
    },
    {
      heading: "전국 평균과 비교해 보기",
      body: [
        `국가데이터처 가계동향조사에 따르면 2025년 전국 1인 이상 가구의 월평균 소비지출은 ${chun(HH_TOTAL_2025 * 1000)}으로 1년 전보다 ${pctText(changePercent(HH_TOTAL_2024, HH_TOTAL_2025))} 늘었습니다. 다만 물가 상승을 빼고 본 실질소비지출은 ${pctText(HH_REAL_CHANGE_2025)}였습니다. 쓰는 돈은 늘었지만 물가를 고려하면 실제로 산 양은 오히려 조금 줄었다는 뜻입니다.`,
        "가계동향조사의 금액은 그해 실제로 쓴 돈(명목금액)이고, 실질금액은 소비자물가지수로 물가 변동을 걷어 내 계산합니다. 우리 집 결산도 같습니다. 장보기 식비가 5% 늘었는데 그해 먹거리 물가도 비슷하게 올랐다면 덜 아낀 것이 아니라 같은 양을 산 것일 수 있습니다. 증감률을 볼 때 '물가만큼 오른 것인지, 더 쓴 것인지'를 한 번 나눠 생각해 보세요.",
        `비중은 ${hhTop.map((h) => `${h.item}(${h.share.toFixed(1)}%)`).join(", ")} 순으로 컸습니다. 가장 최근 발표인 2026년 2분기에는 월평균 소비지출이 ${chun(HH_2026Q2)}으로 1년 전 같은 분기보다 ${HH_2026Q2_CHANGE.toFixed(1)}% 늘었습니다.`,
      ],
      table: {
        caption: "전국 가구당 월평균 소비지출 비목별 금액·비중·증감률 (1인 이상 가구, 명목)",
        head: ["비목", "2024년", "2025년", "2025년 비중", "증감률"],
        rows: [
          ...hhRows.map((h) => [h.item, chun(h.y2024 * 1000), chun(h.y2025 * 1000), `${h.share.toFixed(1)}%`, pctText(h.change)]),
          ["소비지출 합계", chun(HH_TOTAL_2024 * 1000), chun(HH_TOTAL_2025 * 1000), "100.0%", pctText(changePercent(HH_TOTAL_2024, HH_TOTAL_2025))],
        ],
        note: "국가데이터처 「2025년 4/4분기 가계동향조사 결과」(2026년 2월 26일) 통계표의 천 원 단위 금액으로 비중과 증감률을 다시 계산해, 발표 수치와 소수 첫째 자리에서 조금 다를 수 있습니다.",
      },
      after: [
        `이 평균은 매달 전국 약 ${n(HH_SAMPLE)}가구를 조사해 그 항목에 돈을 쓰지 않은 가구까지 포함해 나눈 값입니다. 그래서 교육비처럼 쓰는 집과 안 쓰는 집이 뚜렷한 항목은 평균이 실제로 쓰는 집의 금액보다 훨씬 작게 나옵니다. 우리 집 숫자와 비교할 때는 금액보다 비중의 순서와 늘어난 방향을 참고하는 정도로 쓰는 것이 알맞습니다.`,
      ],
    },
    {
      heading: "결산할 때 빠뜨리기 쉬운 돈",
      body: [
        "1년 결산이 월 결산과 다른 점은 해마다 한두 번만 나가는 돈이 잡힌다는 것입니다. 자동차보험료, 재산세·자동차세 같은 세금, 명절 비용, 경조사비, 가전 교체비처럼 월 가계부에서는 '이번 달만 특별히' 나간 것처럼 보이는 돈이 1년으로 모으면 생각보다 큽니다. 이런 돈은 따로 '연간 지출' 항목으로 묶어 두면 새해에 매달 얼마씩 떼어 둘지 정하기 쉽습니다.",
        "카드 할부는 쓴 날이 아니라 실제로 결제된 날 기준으로 적을지 하나로 정해 두어야 작년과 비교할 수 있습니다. 적금이나 투자에 넣은 돈은 지출이 아니라 저축이므로 소비 지출 합계에서 빼고 따로 적습니다. 그래야 '쓴 돈'의 비중과 증감률이 정확해지고, 소득에서 저축이 차지하는 비율도 따로 볼 수 있습니다.",
      ],
    },
    {
      heading: "결산을 새해 예산으로 바꾸기",
      body: [
        `결산표가 나오면 새해 예산은 비중으로 정하면 편합니다. 예를 들어 외식·배달 비중을 올해보다 1%포인트 낮추겠다고 정하고, 내년 예상 전체 지출에 그 비중을 곱하면 월 한도가 나옵니다. 퍼센트 계산기의 'A의 B%'에 전체 예산과 목표 비중을 넣으면 됩니다. 예시 가구가 내년 전체 지출을 올해와 같은 ${man(budgetNow)}으로 잡고 외식·배달 비중을 ${outTargetShare.toFixed(1)}%로 정하면, 월 한도는 약 ${man(outMonthlyLimit)}입니다. 올해 월평균 ${man(outMonthlyNow)}보다 약 ${man(outMonthlyNow - outMonthlyLimit)} 적게 쓰면 되는 셈입니다.`,
        "증감률이 물가보다 크게 높은 항목은 생활 방식이 바뀐 신호일 수 있습니다. 반대로 꼭 필요한데 줄어든 항목(의료, 보험 등)은 나중에 한꺼번에 돈이 나갈 수 있으니 따로 적립해 두는 것도 방법입니다. 결산표를 1월에 한 번, 6월에 한 번 다시 열어 비중이 계획대로 가고 있는지 확인하면 연말 결산이 훨씬 쉬워집니다.",
      ],
    },
  ],
  sources: [
    { label: "국가데이터처 – 2025년 4/4분기 가계동향조사 결과(2025년 연간 지출 포함, 2026-02-26)", url: "https://eiec.kdi.re.kr/policy/materialView.do?num=277383" },
    { label: "국가데이터처 – 2026년 2/4분기 가계동향조사 결과(2026-08-27)", url: "https://eiec.kdi.re.kr/policy/materialView.do?num=285882" },
  ],
};

// ───────────── 7. 새해 1년 저축 목표 ─────────────
// 가정: 적금 연 3.0% 단리, 이자소득세 15.4%(RATES.interestTax.normal). 실제 금리는 금융회사·상품마다 다릅니다.
const GOAL_RATE = 0.03;
const goal = (target: number, months: number, rate = GOAL_RATE) => calcSavingsGoal(target, months, rate, "simple", RATES.interestTax.normal);
const GOAL_TARGETS = [10_000_000, 15_000_000, 20_000_000];
const GOAL_PERIODS = [12, 24];
const goalRows = GOAL_TARGETS.flatMap((t) => GOAL_PERIODS.map((m) => ({ t, m, r: goal(t, m) })));
const goalHead = goal(10_000_000, 12);
const goalHead2 = goal(10_000_000, 24);
const GOAL_RATES = [0.02, 0.03, 0.04, 0.05];
const goalRateRows = GOAL_RATES.map((r) => ({ r, g: goal(10_000_000, 12, r) }));
// 연봉별 월 실수령액(이 사이트 연봉 실수령액 계산기와 같은 조건: 식대 비과세 월 20만 원, 본인 1명, 자녀 0명)
const GOAL_SALARIES = [30_000_000, 40_000_000, 50_000_000, 60_000_000];
const netMonthly = (annual: number) =>
  calcNetSalary({ annualSalary: annual, monthlyNonTaxable: RATES.incomeTax.mealTaxFreeLimit, dependents: 1, children: 0 }).monthlyNet;
const goalCols = [
  { t: 10_000_000, m: 12 },
  { t: 15_000_000, m: 12 },
  { t: 20_000_000, m: 12 },
  { t: 20_000_000, m: 24 },
];
const goalLabel = (t: number, m: number) => `${man(t)} · ${m / 12}년`;
const savingRate = (monthly: number, net: number) => ratioPercent(monthly, net);
// 국가데이터처 가계동향조사 2025년 4/4분기: 처분가능소득 434만 9천 원, 흑자액 134만 원, 흑자율 30.8%(흑자액 ÷ 처분가능소득 × 100).
// 출처: https://eiec.kdi.re.kr/policy/materialView.do?num=277383 (국가데이터처 2026-02-26 보도자료), 확인 2026-11-27
const HH_DISPOSABLE_Q4 = 4_349_000;
const HH_SURPLUS_Q4 = 1_340_000;
const HH_SURPLUS_RATE_Q4 = 30.8;
// 분기별 점검표: 1,000만 원 · 12개월 목표를 세웠을 때 분기 말까지 넣었어야 할 원금
const checkpoints = [3, 6, 9, 12].map((m) => ({ m, paid: goalHead.monthly * m }));
// 계획이 틀어졌을 때: 4개월 넣은 뒤 2개월을 쉬었다면 남은 6개월에 넣어야 할 금액
const GOAL_DONE = 4;
const GOAL_SKIP = 2;
const goalLeftMonths = 12 - GOAL_DONE - GOAL_SKIP;
const goalSaved = goalHead.monthly * GOAL_DONE;
const goalRedo = goal(10_000_000 - goalSaved, goalLeftMonths);
const goalExtend = goal(10_000_000 - goalSaved, goalLeftMonths + GOAL_SKIP);
// 성과급·연말정산 환급 같은 목돈을 목표에 넣기로 하면: 1년 1,500만 원 목표에서 그 금액을 빼고 다시 계산
// (목돈에 붙는 이자는 넣지 않아 실제보다 조금 보수적으로 계산됩니다)
const BONUS_TARGET = 15_000_000;
const bonusAmounts = [0, 1_000_000, 2_000_000, 3_000_000, 5_000_000];
const bonusRows = bonusAmounts.map((b) => ({ b, monthly: goal(BONUS_TARGET - b, 12).monthly }));

const newYearSavingsGuide: Guide = {
  slug: "new-year-savings-goal",
  title: "새해 저축 목표 세우기: 1,000만·1,500만·2,000만 원 모으려면 매달 얼마",
  description:
    "1년·2년 안에 1,000만·1,500만·2,000만 원을 모으는 데 필요한 월 저축액을 적금 이자와 세금까지 넣어 계산하고, 연봉별 월급 대비 저축률, 분기별 점검표, 계획이 틀어졌을 때 다시 계산하는 법을 정리했습니다.",
  date: "2026-12-31",
  tool: "savings-goal",
  sections: [
    {
      heading: `1년에 1,000만 원이면 매달 약 ${man(goalHead.monthly)}`,
      body: [
        `1년 동안 ${man(10_000_000)}을 모으려면 연 ${pct(GOAL_RATE)}(가정) 적금 기준으로 매달 약 ${won(goalHead.monthly)}을 넣어야 합니다. 2년으로 늘리면 매달 약 ${won(goalHead2.monthly)}입니다. 이자를 빼고 단순히 나누면 1년은 월 ${won(goalHead.withoutInterest)}이니, 이자가 줄여 주는 몫은 한 달에 ${won(goalHead.withoutInterest - goalHead.monthly)} 정도입니다.`,
        "새해 목표는 '얼마를, 언제까지'를 숫자로 정하는 데서 시작합니다. 금액과 기간이 정해지면 매달 넣을 돈이 정해지고, 그 금액이 내 월급에서 감당할 수 있는지 바로 확인할 수 있습니다. 아래 표는 목표 저축 계산기와 같은 식으로 세 가지 목표를 1년과 2년으로 나눠 계산한 것입니다.",
      ],
      table: {
        caption: `목표 금액·기간별 필요한 월 저축액 (적금 연 ${pct(GOAL_RATE)} 단리, 이자소득세 15.4% 가정)`,
        head: ["목표", "기간", "월 저축액", "이자 없이 나누면", "만기 세후 수령액", "세후 이자"],
        rows: goalRows.map(({ t, m, r }) => [man(t), `${m / 12}년(${m}개월)`, won(r.monthly), won(r.withoutInterest), won(r.afterTax), won(r.afterTax - r.principal)]),
        note: "목표 저축 계산기와 같은 식으로 계산했습니다. 월 저축액은 만기 세후 수령액이 목표 이상이 되도록 100원 단위로 올렸습니다. 2년은 2년 만기 적금 하나에 같은 금리로 넣는다고 가정했습니다.",
      },
      after: [
        `같은 목표를 2년으로 늘리면 월 저축액은 1년일 때의 약 ${ratioPercent(goalHead2.monthly, goalHead.monthly).toFixed(1)}%로 줄어듭니다. 기간이 두 배가 되는 데다 이자도 더 오래 붙기 때문입니다. ${man(20_000_000)}·2년 목표의 월 저축액(약 ${won(goal(20_000_000, 24).monthly)})이 ${man(10_000_000)}·1년 목표(약 ${won(goalHead.monthly)})와 비슷한 것도 같은 이유입니다.`,
        "1년 목표가 월급의 절반 가까이 된다면 무리해서 시작하기보다 2년으로 잡고, 중간에 여유가 생길 때 더 넣어 앞당기는 편이 끝까지 가기 쉽습니다. 처음 몇 달을 버티지 못해 적금을 깨면 약정 금리보다 낮은 중도해지 이율을 받게 되므로, 시작 금액은 '조금 아쉬운 정도'로 잡는 것이 오래가는 요령입니다.",
      ],
    },
    {
      heading: "금리보다 저축액이 결과를 정합니다",
      body: [
        `적금은 매달 넣은 돈마다 남은 기간만큼만 이자가 붙어, 이자가 '원금 합계 × 금리'의 절반을 조금 넘는 정도입니다. 그래서 금리를 1%포인트 올려도 1년 ${man(10_000_000)} 목표의 월 저축액은 몇천 원 차이에 그칩니다.`,
      ],
      table: {
        caption: `1년에 ${man(10_000_000)}을 모을 때 적금 금리별 월 저축액 (단리, 이자소득세 15.4%)`,
        head: ["적금 금리", "월 저축액", "세후 이자", "연 2.0%보다 줄어드는 월 저축액"],
        rows: goalRateRows.map(({ r, g }) => [`연 ${pct(r)}`, won(g.monthly), won(g.afterTax - g.principal), won(goalRateRows[0].g.monthly - g.monthly)]),
        note: "금리는 비교를 위한 가정입니다. 우대금리 조건을 채우지 못하면 기본금리만 적용되니 가입 전에 조건을 확인하세요.",
      },
      after: [
        "높은 금리를 찾아 여러 상품을 비교하는 것도 의미가 있지만, 목표를 이루는 데는 매달 넣는 돈을 빠짐없이 지키는 것이 훨씬 중요합니다. 금리가 높은 특판 적금은 월 납입 한도가 작게 정해진 경우가 있으니, 한도 안에서만 높은 금리를 쓰고 나머지는 평소 쓰는 적금에 넣는 식으로 나누면 됩니다.",
      ],
    },
    {
      heading: "월급 대비 저축률로 바꿔 보기",
      body: [
        "같은 목표라도 월급에 따라 부담이 다릅니다. 필요한 월 저축액을 월 실수령액으로 나누면 '월급의 몇 %를 저축해야 하는지'가 나옵니다. 아래 표는 이 사이트 연봉 실수령액 계산기와 같은 조건(식대 비과세 월 20만 원, 본인 1명)으로 구한 실수령액을 기준으로 계산했습니다.",
      ],
      table: {
        caption: "연봉별 월 실수령액과 목표별 필요한 저축률",
        head: ["연봉(세전)", "월 실수령액", ...goalCols.map((c) => goalLabel(c.t, c.m))],
        rows: GOAL_SALARIES.map((s) => {
          const net = netMonthly(s);
          return [man(s), won(net), ...goalCols.map((c) => `${savingRate(goal(c.t, c.m).monthly, net).toFixed(1)}%`)];
        }),
        note: "저축률 = 월 저축액 ÷ 월 실수령액 × 100. 월 실수령액은 4대보험과 소득세·지방소득세를 뺀 추정치이며, 성과급·연말정산 환급은 넣지 않았습니다.",
      },
      after: [
        `참고로 국가데이터처 가계동향조사에서 2025년 4분기 전국 가구의 월평균 처분가능소득은 ${chun(HH_DISPOSABLE_Q4)}, 흑자액은 ${chun(HH_SURPLUS_Q4)}으로 흑자율은 ${HH_SURPLUS_RATE_Q4.toFixed(1)}%였습니다. 흑자액은 세금·연금·사회보험료 같은 비소비지출을 뺀 돈에서 소비지출까지 쓰고 남은 금액이라, 저축뿐 아니라 빚 갚기 등에 쓰이는 돈도 들어 있습니다. 내 저축률이 이보다 크게 높다면 계획이 빠듯하다는 신호일 수 있으니 기간을 늘리는 것도 생각해 보세요.`,
      ],
    },
    {
      heading: "성과급·환급을 목표에 넣으면 월 부담이 줄어듭니다",
      body: [
        `1년에 한두 번 들어오는 성과급, 연말정산 환급금, 명절 상여처럼 불규칙한 돈을 처음부터 목표에 넣기로 정하면 매달 넣어야 할 돈이 줄어듭니다. 1년 ${man(BONUS_TARGET)} 목표를 예로 들면, 목돈을 얼마나 보탤지에 따라 월 저축액이 아래처럼 달라집니다.`,
      ],
      table: {
        caption: `1년 ${man(BONUS_TARGET)} 목표에 목돈을 보탤 때 필요한 월 저축액 (적금 연 ${pct(GOAL_RATE)} 가정)`,
        head: ["목표에 보탤 목돈", "적금으로 모을 금액", "월 저축액", "목돈이 없을 때보다 줄어드는 월 저축액"],
        rows: bonusRows.map((r) => [r.b === 0 ? "없음" : man(r.b), man(BONUS_TARGET - r.b), won(r.monthly), won(bonusRows[0].monthly - r.monthly)]),
        note: "목돈은 들어오는 대로 목표 통장에 넣는다고 보고, 그 돈에 붙는 이자는 계산에서 뺐습니다. 실제로는 이자만큼 조금 더 여유가 생깁니다.",
      },
      after: [
        "다만 아직 받지 않은 성과급이나 환급금을 크게 잡으면 그 돈이 줄었을 때 목표 전체가 흔들립니다. 지난 2~3년 동안 실제로 받은 금액 가운데 가장 적었던 해를 기준으로 잡고, 그보다 더 들어오면 목표를 앞당기는 데 쓰는 것이 안전합니다.",
        "목표 금액은 '손에 쥘 돈' 기준으로 정하는 것이 좋습니다. 목표 저축 계산기는 이자소득세를 뺀 세후 수령액이 목표 금액 이상이 되도록 월 저축액을 계산하므로, 목표에 넣은 숫자가 그대로 만기 때 받는 금액이 됩니다. 반대로 세전 이자로 계산한 다른 표를 쓴다면 이자에서 15.4%가 빠진다는 점을 감안해야 합니다.",
      ],
    },
    {
      heading: "분기마다 점검할 숫자를 정해 두세요",
      body: [
        "1년 목표는 12월에 한 번 확인하면 늦습니다. 분기마다 '여기까지는 모여 있어야 한다'는 숫자를 정해 두면 계획이 틀어진 것을 일찍 알아챌 수 있습니다. 적금 이자는 만기에 한꺼번에 붙으므로, 중간 점검은 넣은 원금 기준으로 보는 것이 간단합니다.",
      ],
      table: {
        caption: `1년 ${man(10_000_000)} 목표(월 ${won(goalHead.monthly)})의 분기별 점검표`,
        head: ["시점", "그때까지 넣었어야 할 원금", "목표 대비"],
        rows: checkpoints.map((c) => [`${c.m}개월 뒤`, won(c.paid), `${ratioPercent(c.paid, 10_000_000).toFixed(1)}%`]),
        note: "12개월 뒤 원금이 목표보다 조금 적은 부분은 만기 때 붙는 세후 이자로 채워집니다.",
      },
      after: [
        "점검일은 달력에 미리 적어 두고, 그날 적금 앱에서 납입 회차와 금액을 확인하세요. 빠진 회차가 있다면 그달 안에 채우는 것이 가장 쉽습니다. 성과급이나 연말정산 환급처럼 예상하지 못한 돈이 들어온 달은 점검표보다 앞서 나갈 기회입니다.",
      ],
    },
    {
      heading: "계획이 틀어졌을 때 다시 계산하는 법",
      body: [
        `예를 들어 1년 ${man(10_000_000)} 목표로 ${GOAL_DONE}개월 동안 ${won(goalSaved)}을 넣었는데, 이사나 병원비로 ${GOAL_SKIP}개월을 쉬었다고 해 봅시다. 남은 ${goalLeftMonths}개월 안에 목표를 맞추려면 남은 금액 ${won(10_000_000 - goalSaved)}을 기준으로 다시 계산해 매달 약 ${won(goalRedo.monthly)}을 넣어야 합니다.`,
        `부담이 크다면 기간을 늘리는 것이 현실적입니다. 쉰 ${GOAL_SKIP}개월만큼 기간을 늘려 ${goalLeftMonths + GOAL_SKIP}개월로 잡으면 매달 약 ${won(goalExtend.monthly)}이면 됩니다. 목표 저축 계산기에 남은 금액과 남은 개월 수를 넣으면 바로 다시 계산할 수 있습니다.`,
        "이 계산은 이미 넣은 돈에 붙을 이자를 빼고 남은 금액만으로 다시 잡은 것이라, 실제로는 조금 더 여유가 생깁니다. 계획이 틀어졌다고 처음부터 포기하기보다, 이렇게 숫자를 다시 맞추는 것이 1년을 끝까지 가는 방법입니다.",
      ],
    },
    {
      heading: "자동이체와 통장은 목표에 맞춰 설계하세요",
      body: [
        "월 저축액이 정해지면 적금 자동이체 날짜를 월급이 들어오는 날 바로 다음으로 맞추는 것이 기본입니다. 월 저축액이 커서 한 번에 빠지는 것이 부담스럽다면 월급날 한 번, 보름 뒤 한 번으로 나눠 걸어 두는 방법도 있습니다. 적금에 따라 납입 날짜와 횟수 규칙이 다르니 가입한 상품의 조건을 먼저 확인하세요.",
        "목표가 2,000만 원처럼 커지거나 여러 해에 걸치면, 만기 때 모인 돈을 어디에 둘지도 미리 정해야 합니다. 예금자보호는 금융회사별로 원금과 이자를 합쳐 1억 원까지이므로 목표 금액이 커질수록 금융회사를 나눠 두는 것이 안전하고, 만기가 지난 돈은 금리가 크게 떨어지므로 만기 때 원리금이 들어갈 계좌를 지정해 두세요.",
        "이 글의 금리와 실수령액은 계산을 위한 가정입니다. 실제 적금 금리와 세금 혜택이 있는 상품의 가입 조건은 금융회사마다 다르니 가입 전에 해당 금융회사에 확인하세요.",
      ],
    },
  ],
  sources: [
    { label: "국세청 – 원천징수 세율(이자소득 14%)", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2291&cntntsId=7703" },
    { label: "국가데이터처 – 2025년 4/4분기 가계동향조사 결과(2026-02-26)", url: "https://eiec.kdi.re.kr/policy/materialView.do?num=277383" },
    { label: "대한민국 정책브리핑 – 9월 1일부터 예금보호한도 1억 원으로(2025-07-22)", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148946400" },
    { label: "금융위원회 – 숨은 금융자산 예방을 위한 소비자보호기준 개선(2023-01-31)", url: "https://www.fsc.go.kr/po010105/79357" },
  ],
};

// ───────────── (다음 글을 여기에 이어 붙입니다) ─────────────

export const guidesB: Guide[] = [jeonseLoanGuide, housingSubscriptionGuide, leaseRenewalGuide, rateCutRequestGuide, depositReinvestGuide, householdBudgetGuide, newYearSavingsGuide];
