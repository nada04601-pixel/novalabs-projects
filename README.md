# 노바랩 계산소 (novalabs.co.kr)

Next.js (App Router) + TypeScript 기반 계산기 모음 사이트입니다.

## 실행
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # out/ 폴더에 정적 HTML 생성
npm test         # 정산 로직 등 단위 테스트(Vitest)
```

## 구조
- `src/lib/calculators/` 계산 로직(순수 함수)
- `src/data/rates/2026.ts` 연도별 요율·기준값 (출처와 확인일 기록)
- `src/data/tools.ts` 도구 목록과 설명·FAQ (본문, 메타데이터, FAQ 구조화 데이터로 사용)
- `src/data/guides.ts` 가이드 글 (`/guides/[slug]`), `tool` 필드로 계산기 페이지와 서로 연결
- `src/app/ads.txt/route.ts` 게시자 ID가 설정되면 `/ads.txt` 생성
- `src/app/tools/[slug]/page.tsx` 도구 페이지 (슬러그와 컴포넌트 연결)
- `src/data/nav.ts` 메뉴·검색·사이드바가 함께 쓰는 도구 목록 (계산기 + 모임 정산). 헤더의 계산기 메뉴, 홈 검색(`ToolBrowser`), 계산기 페이지 왼쪽 메뉴(`ToolSidebar`)가 여기서 자동으로 만들어짐
- `src/app/moim/` 모임 정산 계산기. 입력 상태를 공유 링크(`#d=…`)에 담아 서버 없이 동작 (`src/lib/moimState.ts`, `src/lib/calculators/settlement.ts`)

## 새 계산기 추가 (3단계)
1. `src/lib/calculators/`에 계산 함수 작성
2. `src/components/`에 입력·결과 컴포넌트 작성
3. `src/data/tools.ts`에 분류(`category`)·설명·FAQ 추가하고 `tools/[slug]/page.tsx`의 `calculators`에 컴포넌트 연결

## 애드센스 승인 절차
1. ~~`src/data/site.ts`의 `email`을 실제 수신 가능한 주소로 변경~~ (완료: nada0460@naver.com)
2. 배포: Cloudflare Workers (아래 "Cloudflare Workers 배포" 참고) → Settings → Domains & Routes에서 `novalabs.co.kr` 연결
3. Search Console에 도메인 등록 후 `https://novalabs.co.kr/sitemap.xml` 제출, 색인 생성 확인 (1~2주)
4. 애드센스 가입 → 사이트 `novalabs.co.kr` 추가 → 게시자 ID(`ca-pub-...`) 확인
5. Cloudflare Workers의 **빌드 변수** `NEXT_PUBLIC_ADSENSE_CLIENT`에 게시자 ID 입력 후 재배포 (아래 "환경변수" 참고)
   - 광고 스크립트, `google-adsense-account` 메타 태그, `/ads.txt`가 자동 생성됨
6. 애드센스에서 "사이트 확인"(메타 태그 또는 ads.txt 방식) → "검토 요청"
7. 승인 후 애드센스 > 광고 > 자동 광고 켜기 (추가 코드 불필요)

승인 확률을 높이려면 가이드 글을 꾸준히 추가하세요(목표 20~30편, 한 편당 공백 포함 1,500자 이상). 새 글은 `src/data/guides.ts`에 항목을 추가하면 목록, 사이트맵, 관련 글에 자동 반영됩니다.

### 가이드 예약 공개
- 가이드의 `date`는 공개일입니다. 빌드 날짜(한국 시간)보다 미래인 글은 빌드에서 빠지고, 공개일 이후 다시 배포하면 나타납니다.
- 한꺼번에 올리지 않고 며칠 간격으로 날짜를 나눠 두면 사이트가 꾸준히 갱신되는 것으로 보입니다.
- 매일 자동으로 다시 배포하려면 아래 "매일 자동 재배포"를 설정하세요. 설정하지 않으면 공개일마다 직접 다시 배포해야 합니다.

## Cloudflare Workers 배포
`next.config.ts`의 `output: "export"`로 모든 페이지를 `out/` 폴더에 정적 HTML로 만들고, `wrangler.jsonc`의 정적 자산 설정으로 `out/`을 Worker에 올립니다. 배포는 Workers Builds(Git 연결)가 맡습니다.

Workers & Pages → `novalabs-projects` → Settings → Build:

| 항목 | 값 |
|---|---|
| Git 저장소 | `novalabs-projects`, 프로덕션 브랜치 `main` |
| Root directory | (비워 둠, 저장소 루트) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| 비프로덕션 브랜치 배포 명령 | `npx wrangler versions upload` (미리보기용) |

`main`에 푸시(또는 PR 병합)하면 자동으로 프로덕션에 배포됩니다.

### 환경변수
`NEXT_PUBLIC_` 값은 `next build` 때 HTML에 들어가므로 Worker 런타임 변수가 아니라 **빌드 변수**로 넣어야 합니다.

- Settings → Build → **Variables and secrets**에 추가
  - `NEXT_PUBLIC_ADSENSE_CLIENT`: 애드센스 게시자 ID(`ca-pub-...`)
  - `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`: Search Console HTML 태그 인증값(선택)
- 값을 바꾼 뒤에는 꼭 다시 배포하세요.

### 매일 자동 재배포
예약 공개한 가이드가 공개일에 나타나도록 매일 한 번 다시 빌드합니다.

1. Workers & Pages → `novalabs-projects` → Settings → Build → **Deploy Hooks**에서 후크 추가 (브랜치: `main`)
2. 만들어진 주소(`https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/<ID>`)를 복사. 이 주소만 알면 누구나 빌드를 일으킬 수 있으니 공개하지 마세요.
3. GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret
   - Name: `DEPLOY_HOOK_URL`, Secret: 위 주소
4. Actions 탭 → **Scheduled redeploy** → **Run workflow**로 한 번 실행해 Cloudflare 빌드 목록에 새 빌드가 생기는지 확인

`.github/workflows/scheduled-deploy.yml`이 매일 00:10(한국 시간)에 후크를 호출합니다. 시크릿이 없으면 아무것도 하지 않고 넘어갑니다.

- GitHub 예약 실행은 붐비는 시간에 수십 분 늦어질 수 있습니다.
- 공개 저장소는 60일 동안 커밋이 없으면 예약 실행이 자동으로 꺼집니다. Actions 탭에서 다시 켜면 됩니다.

### 미리보기 빌드 실패
PR(비프로덕션 브랜치)의 `Workers Builds` 체크가 시작 직후 실패하는 일이 있습니다. 같은 코드가 `main`에서는 성공하므로 코드가 아니라 비프로덕션 브랜치 빌드 설정 문제일 가능성이 큽니다. PR 댓글의 "View logs"에서 오류를 확인하고, 미리보기가 필요 없다면 Settings → Build → Branch control에서 비프로덕션 브랜치 빌드를 꺼도 됩니다.

## 매년 점검
- 국민연금 기준소득월액 상·하한: 매년 7월
- 건강보험·장기요양 요율: 매년 초
- 소득세 세율·공제: 세법 개정 시
- 최저임금: 매년 8월 고시, 다음 해 1월 시행
- 가이드 글의 `date`와 본문 수치
