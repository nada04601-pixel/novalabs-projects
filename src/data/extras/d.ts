import type { GuideExtra, ToolExtra } from "./types";
import { areaGuideExtra } from "./d/area";
import { brokerageGuideExtra, brokerageToolExtra } from "./d/brokerage";
import { rentConversionGuideExtra, rentConversionToolExtra } from "./d/rentConversion";
import { rentTaxCreditGuideExtra, rentTaxCreditToolExtra } from "./d/rentTaxCredit";
import { yearEndTaxGuideExtra } from "./d/yearEndTax";

// 묶음 d: 가이드·도구 보강 내용. 키는 가이드·도구 슬러그입니다.
// 금액과 비율은 모두 src/data/rates/2026.ts와 src/lib/calculators/*.ts로 빌드할 때 계산합니다.
export const guideExtrasD: Record<string, GuideExtra> = {
  "year-end-tax-settlement-basics": yearEndTaxGuideExtra,
  "monthly-rent-tax-credit": rentTaxCreditGuideExtra,
  "brokerage-fee-guide": brokerageGuideExtra,
  "jeonse-monthly-rent-conversion": rentConversionGuideExtra,
  "apartment-area-pyeong": areaGuideExtra,
};

export const toolExtrasD: Record<string, ToolExtra> = {
  "rent-tax-credit": rentTaxCreditToolExtra,
  "brokerage-fee": brokerageToolExtra,
  "rent-conversion": rentConversionToolExtra,
};
