import { configDefaults, defineConfig } from "vitest/config";

// apps/ 아래는 따로 의존성과 테스트를 가진 별도 프로그램입니다(각 폴더에서 npm test)
export default defineConfig({ test: { exclude: [...configDefaults.exclude, "apps/**"] } });
