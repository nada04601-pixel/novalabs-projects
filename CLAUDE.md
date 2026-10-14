# 노바랩 공작소 (novalabs.co.kr)

회원가입 없이 브라우저에서 바로 쓰는 계산기·파일 도구 모음과 생활 계산 가이드 사이트. 배포, 검색엔진 등록, 애드센스 절차는 `README.md`를 참고한다.

## 스택과 제약
- Next.js 15 (App Router), React 19, TypeScript (`strict`), Vitest. 경로 별칭 `@/*` → `src/*`
- **정적 사이트다.** `next.config.ts`의 `output: "export"`로 `out/`에 HTML을 만들고 Cloudflare Workers에 정적 자산으로 올린다. API Route, 서버 액션, 요청마다 렌더링, `cookies()`/`headers()` 같은 서버 기능은 쓸 수 없다. 동적 경로에는 `generateStaticParams`가 필요하다.
- 스타일은 `src/app/globals.css`의 일반 CSS만 쓴다. Tailwind는 없다.
- ESLint가 없으므로 `npm run lint`는 없다.

## 명령
- `npm run dev`: 개발 서버
- `npm test`: 단위 테스트 (`vitest run`)
- `npx tsc --noEmit`: 타입 체크
- `npm run build`: 정적 export 빌드. 서버 기능을 잘못 쓰면 여기서 깨진다

작업을 마치기 전에 `npx tsc --noEmit && npm test && npm run build`를 실행해 모두 통과하는지 확인한다.

## 핵심 원칙
1. **입력값을 밖으로 보내지 않는다.** 급여·금액·업로드한 PDF/이미지/영상은 모두 브라우저 안에서 처리한다. 개인정보처리방침(`src/app/privacy/page.tsx`)에 "서버로 전송하거나 저장하지 않는다"고 약속했기 때문이다. 외부 API 호출, 분석용 전송, 파일 업로드 코드를 추가하지 않는다.
2. **계산은 정확하고 근거가 있어야 한다.** 급여·세금·노동법·부동산 계산은 사용자가 실제 결정에 쓴다. 요율과 기준값은 `src/data/rates/2026.ts`의 `RATES`에서만 가져오고, 컴포넌트나 계산 함수에 숫자를 직접 적지 않는다. 값을 바꾸면 출처와 확인일 주석도 함께 갱신한다. 원 단위 절사(`Math.floor`)와 반올림(`Math.round`)은 법령 기준에 맞춰 구분하고, 어느 쪽인지 주석으로 남긴다.
3. **도구 페이지는 설명 콘텐츠와 함께 간다.** 입력 폼만 두지 않는다. `src/data/tools.ts`의 `intro`·`howTo`·`faq`가 페이지 본문, 메타데이터, FAQ 구조화 데이터(JSON-LD)로 자동 렌더링되므로 이 필드를 채우면 된다. JSON-LD를 페이지에 따로 추가하지 않는다.

## 디렉터리
- `src/lib/calculators/`: 계산기 로직. UI와 분리된 순수 함수. 입력·결과 타입을 함께 export한다 (예: `SeveranceInput`, `SeveranceResult`)
- `src/lib/tools/`: PDF·이미지·영상·텍스트 같은 파일 도구 로직
- `src/lib/format.ts`: `won`, `num`, `pct` 같은 공용 포맷 함수
- 테스트: 대상 파일 옆의 `*.test.ts` (예: `src/lib/calculators/settlement.test.ts`)
- `src/components/`: 도구별 Client Component(`"use client"`)와 공용 UI (`CopyButton`, `ShareButtons`, `InfoTip` 등). 하위 폴더 없이 둔다
- `src/app/tools/[slug]/page.tsx`: 모든 도구 페이지를 처리하는 단일 라우트. `calculators` 매핑으로 slug와 컴포넌트를 연결한다
- `src/data/tools.ts`: 도구 목록, 분류(`CATEGORIES`), 설명, FAQ
- `src/data/nav.ts`: 헤더 메뉴, 홈 검색, 사이드바용 목록. `tools.ts`에서 자동으로 만들어진다 (`/moim`만 직접 추가)
- `src/data/guides.ts`: 가이드 글. `date`는 공개일이며, 빌드일(한국 시간)보다 미래인 글은 빌드에서 빠진다. `tool`에 계산기 slug를 넣으면 서로 연결된다
- `src/data/rates/2026.ts`: 연도별 요율과 기준값
- `src/app/moim/`: 모임 정산. 상태를 URL 해시(`#d=…`)에 담아 서버 없이 공유한다
- `src/data/lotto/draws.json`: `scripts/update-lotto.mjs`와 `.github/workflows/update-lotto.yml`이 자동으로 갱신한다. 직접 편집하지 않는다

## 새 도구 추가 / 계산 로직 수정
1. `src/lib/calculators/`(또는 `src/lib/tools/`)에 순수 함수와 입력·결과 타입을 작성한다. 음수, 0, 빈 값, 상한·하한 경계, 날짜 경계 같은 엣지 케이스를 먼저 정리한다.
2. 급여·세금·노동법·부동산·대출처럼 돈이 걸린 계산은 `*.test.ts`에 정상 케이스와 엣지 케이스 테스트를 추가한다. 단순 도구(글자 수, QR 등)는 필요할 때만 추가한다.
3. `src/components/`에 컴포넌트를 만든다. 컴포넌트에는 상태와 표시만 두고, 수식은 1단계 함수를 호출한다.
4. `src/data/tools.ts`에 항목(slug, category, title, short, metaDescription, intro, howTo, faq)을 추가하고, `src/app/tools/[slug]/page.tsx`의 `calculators`에 컴포넌트를 연결한다. 메뉴와 사이트맵에는 자동으로 반영된다.
5. 위의 검증 명령을 실행한다.

## 코딩 규칙
- `any`를 쓰지 않는다. 기존 코드처럼 `type`으로 입력과 결과를 정의한다.
- `<input>`은 `<label>`과 연결한다. 금액 입력은 천 단위 콤마로 표시하고, 결과에는 `CopyButton`이나 `ShareButtons`를 붙인다. 이 규칙은 새로 만들거나 수정하는 컴포넌트에 적용하고, 요청받지 않은 기존 코드를 이 규칙에 맞추려고 고치지 않는다.
- 사용자에게 보이는 문구와 코드 주석은 한국어로, 기존 톤(짧은 "~합니다", "~하세요" 문장)에 맞춰 쓴다.
