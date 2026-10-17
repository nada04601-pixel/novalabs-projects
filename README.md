# 노바랩 공작소 (novalabs.co.kr)

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
- `src/data/tools.ts` 도구 목록과 설명·FAQ. 분류는 `CATEGORIES`(디지털 도구는 PDF·이미지·동영상·오디오·텍스트·유틸리티로 나눔, 한 분류가 10개를 넘으면 다시 나누기를 권장) (본문, 메타데이터, FAQ 구조화 데이터로 사용)
- `src/data/guides.ts` 가이드 글 (`/guides/[slug]`), `tool` 필드로 계산기 페이지와 서로 연결
- `src/app/ads.txt/route.ts` 게시자 ID가 설정되면 `/ads.txt` 생성
- `src/app/tools/[slug]/page.tsx` 도구 페이지 (슬러그와 컴포넌트 연결)
- `src/data/nav.ts` 메뉴·검색·사이드바가 함께 쓰는 도구 목록 (계산기 + 모임 정산). 헤더의 도구함 메뉴, 홈 검색(`ToolBrowser`), 계산기 페이지 왼쪽 메뉴(`ToolSidebar`)가 여기서 자동으로 만들어짐
- `src/app/moim/` 모임 정산 계산기. 입력 상태를 공유 링크(`#d=…`)에 담아 서버 없이 동작 (`src/lib/moimState.ts`, `src/lib/calculators/settlement.ts`)
- 사주: `/tools/saju`. 절기·음력은 `lunar-javascript`(MIT, 중국 표준시 기준)로 계산하므로 연주·월주는 태어난 순간을 UTC+8로, 일주·시주는 경도 보정한 현지 시각으로 넘깁니다. 서머타임·UTC+8:30 시절은 브라우저의 `Asia/Seoul` 시간대 자료로 반영 (`src/lib/calculators/saju.ts`). 풀이 문구(일간 10종, 오행·십신 그룹이 많을 때/없을 때, 대운·세운의 십신별 풀이, 합·충·형·파·해와 자리 의미, 신살 11종)는 `src/data/sajuReading.ts`. 대운은 `calcLuck`이 절입까지의 시간을 3일 = 1년으로 바꿔 시작 시점을 정하며, 만 나이와 시작 연월로 표시. 합·충은 `findRelations`(천간합·충, 육합, 삼합·반합, 방합, 지지충, 삼형·형·자형, 파, 해), 지장간은 `HIDDEN_STEMS`(월률분야 일수)로 지장간 표·오행 세력(`elementPower`)·통근·투출을 계산, 결과 공유 링크는 `src/lib/sajuLink.ts`(입력값을 `#y=…&m=…&d=…` 해시에 담음, 버튼을 눌렀을 때만 만듦), 신살은 `findShinsal`(천을귀인·문창·도화·역마·화개·홍염·괴강·공망·양인·백호·원진). 영어 페이지 `/en/tools/saju`는 같은 컴포넌트가 `SAJU_KO`(`sajuReading.ts`)·`SAJU_EN`(`sajuReading.en.ts`) 중 하나를 골라 이름(천간·지지는 한국어 로마자 Gap·Ja…, 십신은 Friend·Rob Wealth… 등)과 풀이, 계산 안내 문구를 바꿔 씁니다
- 사주 궁합: `/tools/saju-match`. `src/lib/calculators/sajuMatch.ts`가 두 사람의 `calcSaju` 결과로 일간 관계(30)·일지(30)·오행 보완(25)·띠(15) 점수를 내고, 풀이 문구는 `src/data/sajuMatchText.ts`. 궁합 공유 링크는 `encodeMatchLink`(`#ay=…&by=…`, 사주 링크와 같은 `src/lib/sajuLink.ts`), 공유 버튼은 두 페이지가 함께 쓰는 `ShareLinkButtons`
- MBTI 성격 유형 테스트: `/tools/mbti`. 문항·점수 계산·공유 링크(`#r=INFP&p=…`, 지표별 E·S·T·J 비율)는 `src/lib/calculators/mbti.ts`, 16가지 유형 풀이는 `src/data/mbtiText.ts`(영어 풀이 `TYPE_TEXT_EN`도 같은 파일). 영어 페이지 `/en/tools/mbti`는 문항의 `en` 문장과 `useT()`로 같은 컴포넌트를 씁니다
- 로또: `/tools/lotto-simulator`(번호 생성 + 매주 샀다면? 시뮬레이션), `/lotto`(당첨번호 조회: 최신 회차·1등 배출점·전체 회차 검색·출현 통계), `/lotto/[회차]`(회차별 상세). 예전 `/tools/lotto`는 `public/_redirects`로 시뮬레이터로 옮김. 당첨 결과는 `src/data/lotto/draws.json`에 저장하고 빌드 때 정적 HTML로 들어감
- 동영상 자막 추출: `/tools/video-subtitle`. mediabunny는 입력 파일의 자막 트랙을 읽지 못해 `src/lib/tools/subtitleExtract.ts`가 MKV·WebM(EBML, zlib 압축 블록 포함)과 MP4·MOV(moov 표, tx3g·wvtt)를 직접 해석합니다. MKV는 자막 블록이 영상 사이에 흩어져 있어 파일 전체를 조각으로 읽고, 자막 트랙이 없으면 Tracks까지만 읽고 멈춥니다. SRT·VTT·ASS·TXT 변환은 `src/lib/tools/subtitles.ts`. PGS·VobSub 같은 그림 자막과 화면에 새겨진 자막은 꺼낼 수 없습니다
- 음성 인식 자막(같은 페이지): transformers.js(`@huggingface/transformers` 4.2)로 Whisper(`onnx-community/whisper-base`·`whisper-small`)를 웹 워커(`src/lib/tools/whisper.worker.ts`)에서 돌립니다. WebGPU가 있으면 인코더 fp16(없으면 fp32)·디코더 q4, 없으면 CPU에서 q8. 모델 파일은 Cloudflare 정적 파일 한도(25MiB)를 넘어 Hugging Face에서 처음 한 번 받고 브라우저 캐시에 둡니다. ONNX Runtime 실행 파일은 `scripts/copy-models.mjs`가 `public/models/ort/`로 복사해 사이트에서 내려줍니다. 소리는 `src/lib/tools/audioDecode.ts`가 16kHz 모노로 바꾸고, `src/lib/tools/transcribe.ts`가 30초 끝부분의 조용한 곳에서 잘라 조각마다 인식한 뒤 긴 문장을 나눕니다(최대 60분)

## 영어 페이지 (/en)
- 해외에서도 쓸 수 있는 도구(PDF·이미지·동영상·오디오·유틸리티) 15개만 영어 버전이 있습니다. 목록은 `src/lib/i18n.ts`의 `EN_TOOLS`(한글 타자 연습, 나이스 바이트 글자수 세기, 한국 기준 계산기는 한국어만).
- 주소: `/en`(영어 홈), `/en/tools/[slug]`. 한국어 주소는 그대로이고, 두 페이지는 hreflang(`alternates.languages`)과 사이트맵으로 서로 연결됩니다.
- 영어 제목·설명·사용법·FAQ: `src/data/tools.en.ts`. 화면 문구는 각 컴포넌트에서 `useT()`로 `t("한국어", "English")`처럼 나란히 적고, 경로가 `/en`이면 영어를 고릅니다(`src/lib/useT.ts`). 라이브러리의 오류 문구·파일 이름은 `lang` 인자(기본 `ko`)로 바꿉니다.
- 헤더의 언어 전환 링크는 같은 도구의 다른 언어 페이지로, 영어 버전이 없는 페이지에서는 영어 홈으로 갑니다.
- 새 도구에 영어 버전을 추가하려면: `EN_TOOLS`에 슬러그 추가 → `tools.en.ts`에 내용 추가 → 컴포넌트 문구를 `t()`로 감싸기 → `src/app/en/tools/[slug]/page.tsx`의 `components`에 연결.

## 이미지 업스케일 AI 모델
- `/tools/image-upscaler`의 AI 모드는 UpscalerJS(`upscaler`)와 ESRGAN Medium 모델(`@upscalerjs/esrgan-medium`, MIT)을 TensorFlow.js(`@tensorflow/tfjs` 4.11, upscaler가 요구하는 버전)로 브라우저에서 실행합니다.
- 모델 파일(2배·4배, 각 약 2.8MB)은 저장소에 넣지 않고 `npm run dev`/`npm run build` 직전에 `scripts/copy-models.mjs`가 `node_modules`에서 `public/models/esrgan-medium/`으로 복사합니다(`.gitignore`). 외부 CDN에서 받지 않습니다.

## 로또 당첨 결과 갱신
- 자료: 동행복권 추첨 결과를 회차별 JSON으로 공개하는 [smok95/lotto](https://github.com/smok95/lotto) 저장소
- 자동: `.github/workflows/update-lotto.yml`이 매주 일요일 07:00·12:00, 월요일 09:00(한국 시간)에 새 회차를 받아 `main`에 커밋 → Workers Builds가 다시 배포. `main`에 브랜치 보호가 있으면 Actions 봇의 푸시를 허용해야 합니다.
- 수동: `node scripts/update-lotto.mjs` (빠진 회차만 추가), `--all`은 전체를 다시 받음. Actions 탭에서 "Update lotto results"를 직접 실행해도 됩니다.
- 1등 배출점: `src/data/lotto/stores.json`. 동행복권 당첨 판매점 조회(`/wnprchsplcsrch/selectLtWnShp.do`)에서 `node scripts/update-lotto-stores.mjs`로 받으며, 같은 주간 워크플로가 함께 실행합니다. 동행복권은 해외(GitHub Actions) 접속이 자주 끊겨 요청마다 다시 시도하고, 시간이 다 되면 받은 데까지 저장한 뒤 다음 실행 때 빠진 회차부터 이어 받습니다. 실패해도 당첨번호 갱신은 막지 않습니다.

## 새 계산기 추가 (3단계)
1. `src/lib/calculators/`에 계산 함수 작성
2. `src/components/`에 입력·결과 컴포넌트 작성
3. `src/data/tools.ts`에 분류(`category`)·설명·FAQ 추가하고 `tools/[slug]/page.tsx`의 `calculators`에 컴포넌트 연결

## 네이버 검색 등록
1. [네이버 서치어드바이저](https://searchadvisor.naver.com) → 웹마스터 도구 → 사이트 등록에 `https://novalabs.co.kr` 입력
2. 소유 확인 방법에서 **HTML 태그**를 골라 `<meta name="naver-site-verification" content="...">`의 `content` 값만 복사
3. `src/data/site.ts`의 `naverVerification`에 넣고(또는 빌드 변수 `NEXT_PUBLIC_NAVER_SITE_VERIFICATION`) 재배포한 뒤 서치어드바이저에서 "소유확인" (완료)
4. 요청 → 사이트맵 제출에 `https://novalabs.co.kr/sitemap.xml` 제출, 검증 → robots.txt에서 수집 허용 확인
5. 요청 → RSS 제출에 `https://novalabs.co.kr/rss.xml` 제출 (공개된 가이드 글 목록. 예약 글은 공개일 재배포 때 자동으로 추가됨)

## 다음 검색 등록
1. [다음 웹마스터도구](https://webmaster.daum.net)에서 `https://novalabs.co.kr` 등록 → PIN코드 발급
2. `#DaumWebMasterTool:` 뒤의 값을 `src/data/site.ts`의 `daumVerification`에 넣고 재배포하면 `/robots.txt` 하단에 들어감 (완료)
3. 웹마스터도구에서 "로봇룰 테스트" → "인증 시작하기"

## 애드센스 승인 절차
1. ~~`src/data/site.ts`의 `email`을 실제 수신 가능한 주소로 변경~~ (완료: nada0460@naver.com)
2. 배포: Cloudflare Workers (아래 "Cloudflare Workers 배포" 참고) → Settings → Domains & Routes에서 `novalabs.co.kr` 연결
3. Search Console에 도메인 등록 후 `https://novalabs.co.kr/sitemap.xml` 제출, 색인 생성 확인 (1~2주)
4. 애드센스 가입 → 사이트 `novalabs.co.kr` 추가 → 게시자 ID(`ca-pub-...`) 확인
5. ~~`src/data/site.ts`의 `adsenseClient`에 게시자 ID 입력 후 재배포~~ (완료: ca-pub-6228511708822958. 빌드 변수 `NEXT_PUBLIC_ADSENSE_CLIENT`가 있으면 그 값을 우선 사용)
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
  - `NEXT_PUBLIC_ADSENSE_CLIENT`: 애드센스 게시자 ID(`ca-pub-...`, 선택, 비우면 `site.ts`의 기본값 사용)
  - `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`: Search Console HTML 태그 인증값(선택)
  - `NEXT_PUBLIC_NAVER_SITE_VERIFICATION`: 네이버 서치어드바이저 HTML 태그 인증값(선택, 비우면 `site.ts`의 기본값 사용)
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
