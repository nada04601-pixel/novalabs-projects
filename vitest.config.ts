import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 시험에서도 Next.js와 같은 경로 별칭(@/ → src/)을 쓰게 합니다. 요율(@/data/rates)을 쓰는 계산 코드를 시험하려면 필요합니다.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
