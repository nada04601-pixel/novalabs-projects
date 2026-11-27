import { calcCarTax, CC_RATES, reductionRate, type CarTaxInput } from "@/lib/calculators/carTax";
import type { ContentSection } from "@/data/content";
import type { ToolExtra } from "../types";

const n = (v: number) => Math.round(v).toLocaleString("ko-KR");
const won = (v: number) => `${n(v)}원`;

// 예시는 2027년 세액. 차령 2년 이하(2026년 1월 등록)면 경감이 없어 서울시 연납 안내 예시와 같은 조건입니다.
const TAX_YEAR = 2027;
const fresh = (input: Partial<CarTaxInput>) => calcCarTax({ kind: "cc", cc: 0, taxYear: TAX_YEAR, regYear: 2026, regMonth: 1, ...input });

const ccList = [998, 1_368, 1_598, 1_999, 2_497, 3_342];
const ageCc = 1_999;
const ages = [2, 3, 4, 5, 6, 8, 10, 12, 15];

const sections: ContentSection[] = [
  {
    heading: `계산 예시: 배기량별 ${TAX_YEAR}년 자동차세`,
    body: [
      `차령이 2년 이하라 경감이 없는 자가용 승용차를 기준으로, 배기량별 1년 자동차세와 지방교육세, 1월에 연납할 때 내는 금액을 계산했습니다. cc당 세액은 1,000cc 이하 ${CC_RATES[0].perCc}원, 1,600cc 이하 ${CC_RATES[1].perCc}원, 1,600cc 초과 ${CC_RATES[2].perCc}원입니다.`,
    ],
    table: {
      caption: `배기량별 ${TAX_YEAR}년 자동차세(차령 2년 이하, 자가용 승용차)`,
      head: ["배기량", "1년 자동차세", "지방교육세", "1년 합계", "6월·12월 각각", "1월 연납 때 낼 금액"],
      rows: [
        ...ccList.map((cc) => {
          const r = fresh({ cc });
          return [`${n(cc)}cc`, won(r.annualCarTax), won(r.annualEduTax), won(r.annualTotal), won(r.first.total), won(r.prepay[0].total)];
        }),
        (() => {
          const r = fresh({ kind: "electric" });
          return ["전기차", won(r.annualCarTax), won(r.annualEduTax), won(r.annualTotal), won(r.first.total), won(r.prepay[0].total)];
        })(),
      ],
      note: "1월 연납 금액은 자동차세에서 연납 공제를 빼고 지방교육세를 다시 계산한 값입니다. 1년 세액이 10만 원 이하인 차는 지자체가 6월에 1년치를 한꺼번에 고지할 수 있습니다.",
    },
    after: [
      "배기량 구간 경계에서 세액이 크게 달라집니다. 1,598cc는 cc당 140원이지만 1,600cc를 넘으면 배기량 전체에 200원이 붙습니다. 그래서 배기량이 비슷해도 1,600cc를 넘는지에 따라 1년 세액 차이가 큽니다. 계산할 때는 자동차등록증에 적힌 배기량을 그대로 넣으세요.",
    ],
  },
  {
    heading: "차령에 따라 줄어드는 금액",
    body: [
      `같은 ${n(ageCc)}cc 승용차라도 오래될수록 자동차세가 줄어듭니다. 아래 표는 1~6월에 처음 등록한 차를 기준으로 한 ${TAX_YEAR}년 세액입니다(1기분과 2기분의 차령이 같은 경우).`,
    ],
    table: {
      caption: `${n(ageCc)}cc 승용차의 차령별 ${TAX_YEAR}년 자동차세`,
      head: ["차령", "경감률", "1년 자동차세", "지방교육세 포함 1년 합계"],
      rows: ages.map((age) => {
        const r = fresh({ cc: ageCc, regYear: TAX_YEAR - age + 1, regMonth: 3 });
        return [age <= 2 ? "2년 이하" : `${age}년`, reductionRate(age) > 0 ? `${Math.round(reductionRate(age) * 100)}%` : "없음", won(r.annualCarTax), won(r.annualTotal)];
      }),
      note: "차령이 12년을 넘으면 12년으로 보아 경감률은 50%에서 더 늘지 않습니다. 7~12월에 등록한 차는 1기분 차령이 1년 적어 1기분 경감률이 5% 낮을 수 있습니다.",
    },
  },
  {
    heading: "언제 무엇을 내는지",
    body: [
      "자동차세는 1년에 두 번, 6월 16~30일(1~6월분)과 12월 16~31일(7~12월분)에 냅니다. 납세자는 납기가 있는 달 1일 현재 차를 가진 사람입니다. 1년치를 미리 내는 연납은 1월·3월·6월·9월의 16일부터 말일까지 신청할 수 있고, 일찍 낼수록 공제가 큽니다.",
      "1월과 3월 연납은 1년 세액에서 남은 날짜만큼 공제하고, 6월과 9월 연납은 7~12월분 세액에서 공제합니다. 6월이나 9월에 연납하면 1~6월분은 6월 정기분으로 따로 냅니다. 신청 방법과 고지서 안내는 지자체마다 다르므로 위택스나 차가 등록된 시·군·구 안내를 확인하세요.",
    ],
  },
];

export const carTaxExtra: ToolExtra = {
  updated: "2026-11-27",
  sections,
  sources: [
    { label: "국가법령정보센터 – 지방세법(제127조 세율, 제128조 납기와 연납, 제151조 지방교육세)", url: "https://www.law.go.kr/법령/지방세법" },
    { label: "국가법령정보센터 – 지방세법 시행령(제122조 차령, 제125조 연납 이자율)", url: "https://www.law.go.kr/법령/지방세법시행령" },
    { label: "내 손안에 서울 – 자동차세 1월 연납 안내와 계산 예시", url: "https://mediahub.seoul.go.kr/archives/2013200" },
    { label: "서울시 – 2026년 1월 자동차세 연납 안내", url: "https://news.seoul.go.kr/gov/archives/574407" },
  ],
};
