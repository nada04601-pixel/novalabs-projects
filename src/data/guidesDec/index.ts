import type { Guide } from "@/data/guides";
import { guidesA } from "./a";
import { guidesB } from "./b";
import { guidesC } from "./c";
import { guidesD } from "./d";
import { guidesE } from "./e";

// 2026-11-29~12-31 하루 한 편씩 공개할 예약 가이드(2026-11-27 작성).
// a: 급여·세금, b: 대출·저축, c: 파일 도구, d: 생활·연말정산, e: 새 계산기(4대보험·전기요금·자동차세)
export const guidesDec: Guide[] = [...guidesA, ...guidesB, ...guidesC, ...guidesD, ...guidesE];
