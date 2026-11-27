import type { GuideExtra, ToolExtra } from "./types";
import { socialInsuranceExtra } from "./e/socialInsurance";
import { carTaxExtra } from "./e/carTax";
import { electricityExtra } from "./e/electricity";

// 묶음 e: 2026-11-27에 새로 만든 계산기(4대보험·전기요금·자동차세)의 계산 예시와 참고 자료입니다.
export const guideExtrasE: Record<string, GuideExtra> = {};

export const toolExtrasE: Record<string, ToolExtra> = {
  "social-insurance": socialInsuranceExtra,
  "car-tax": carTaxExtra,
  "electricity-bill": electricityExtra,
};
