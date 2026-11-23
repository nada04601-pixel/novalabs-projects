import type { GuideExtra, ToolExtra } from "./types";
import { severanceGuide, severanceTool } from "./b/severance";
import { annualLeaveGuide, annualLeaveTool } from "./b/annualLeave";
import { overtimeGuide, overtimeTool } from "./b/overtime";
import { unemploymentGuide, unemploymentTool } from "./b/unemployment";

// 묶음 b: 가이드·도구 보강 내용. 키는 가이드·도구 슬러그입니다.
// 퇴직금·연차·연장근로수당·실업급여. 숫자는 src/lib/calculators 함수와 RATES로 빌드할 때 계산합니다(내용은 ./b/ 폴더).
export const guideExtrasB: Record<string, GuideExtra> = {
  "severance-pay-guide": severanceGuide,
  "annual-leave-guide": annualLeaveGuide,
  "overtime-night-holiday-pay": overtimeGuide,
  "unemployment-benefit-basics": unemploymentGuide,
};

export const toolExtrasB: Record<string, ToolExtra> = {
  "severance-pay": severanceTool,
  "annual-leave": annualLeaveTool,
  "overtime-pay": overtimeTool,
  "unemployment-benefit": unemploymentTool,
};
