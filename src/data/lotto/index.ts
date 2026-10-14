import type { Draw } from "@/lib/lotto";
import raw from "./draws.json";

// 1회부터 최신 회차까지 오름차순. 갱신: node scripts/update-lotto.mjs (매주 GitHub Actions가 자동 실행)
export const draws = raw as Draw[];
export const latestDraw = draws[draws.length - 1];
export const getDraw = (no: number): Draw | undefined => draws[no - 1];
