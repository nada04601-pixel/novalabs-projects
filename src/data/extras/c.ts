import type { GuideExtra, ToolExtra } from "./types";
import { loanGuide, loanTool } from "./c/loan";
import { compoundGuide, installmentGuide, savingsTool } from "./c/savings";
import { interestTaxGuide } from "./c/tax";
import { goalGuide, goalTool } from "./c/goal";

// 묶음 c: 가이드·도구 보강 내용. 키는 가이드·도구 슬러그입니다.
// 대출·저축·이자 세금 글. 숫자는 모두 src/lib/calculators와 RATES로 빌드할 때 계산합니다(c/ 폴더).
export const guideExtrasC: Record<string, GuideExtra> = {
  "loan-repayment-methods": loanGuide,
  "installment-savings-interest": installmentGuide,
  "interest-income-tax": interestTaxGuide,
  "simple-vs-compound-interest": compoundGuide,
  "monthly-savings-plan": goalGuide,
};

export const toolExtrasC: Record<string, ToolExtra> = {
  "loan-interest": loanTool,
  "savings-interest": savingsTool,
  "savings-goal": goalTool,
};
