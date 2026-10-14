import type { Draw, Store } from "@/lib/lotto";
import raw from "./draws.json";
import rawStores from "./stores.json";

// 1회부터 최신 회차까지 오름차순. 갱신: node scripts/update-lotto.mjs (매주 GitHub Actions가 자동 실행)
export const draws = raw as Draw[];
export const latestDraw = draws[draws.length - 1];
export const getDraw = (no: number): Draw | undefined => draws[no - 1];

// 회차별 1등 배출점. 갱신: node scripts/update-lotto-stores.mjs. 아직 받지 못한 회차는 undefined
const stores = rawStores as unknown as Record<string, Store[]>;
export const getStores = (no: number): Store[] | undefined => stores[no];
