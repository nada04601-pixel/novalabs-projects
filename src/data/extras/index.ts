import type { GuideExtra, ToolExtra } from "./types";
import { guideExtrasA, toolExtrasA } from "./a";
import { guideExtrasB, toolExtrasB } from "./b";
import { guideExtrasC, toolExtrasC } from "./c";
import { guideExtrasD, toolExtrasD } from "./d";
import { guideExtrasE, toolExtrasE } from "./e";

export type { GuideExtra, ToolExtra } from "./types";

// 가이드·도구 보강 내용을 한데 모읍니다(2026-11 애드센스 재신청 준비로 추가, e는 2026-11-27 새 계산기).
export const guideExtras: Record<string, GuideExtra> = { ...guideExtrasA, ...guideExtrasB, ...guideExtrasC, ...guideExtrasD, ...guideExtrasE };
export const toolExtras: Record<string, ToolExtra> = { ...toolExtrasA, ...toolExtrasB, ...toolExtrasC, ...toolExtrasD, ...toolExtrasE };
