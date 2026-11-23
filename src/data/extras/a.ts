import type { GuideExtra, ToolExtra } from "./types";
import { guidePagesA } from "./a/guidePages";
import { toolPagesA } from "./a/toolPages";

// 묶음 a: 가이드·도구 보강 내용. 키는 가이드·도구 슬러그입니다.
// 급여·4대보험·최저임금·주휴수당 글과 연봉 실수령액·주휴수당·시급 변환 도구를 맡습니다.
// 숫자는 모두 src/data/rates/2026.ts와 src/lib/calculators/*.ts로 빌드할 때 계산합니다(내용은 ./a/ 폴더).
export const guideExtrasA: Record<string, GuideExtra> = guidePagesA;

export const toolExtrasA: Record<string, ToolExtra> = toolPagesA;
