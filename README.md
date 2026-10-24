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
- 로또: `/tools/lotto-simulator`(번호 생성 + 매주 샀다면? 시뮬레이션), `/lotto`(당첨번호 조회: 최신 회차·1등 배출점·전체 회차 검색·출현 통계), `/lotto/[회차]`(회차별 상세, 같은 틀의 페이지가 1,000개가 넘어 `noindex`이고 사이트맵에서도 뺌). 예전 `/tools/lotto`는 `public/_redirects`로 시뮬레이터로 옮김. 당첨 결과는 `src/data/lotto/draws.json`에 저장하고 빌드 때 정적 HTML로 들어감
- 동영상 자막 추출: `/tools/video-subtitle`. mediabunny는 입력 파일의 자막 트랙을 읽지 못해 `src/lib/tools/subtitleExtract.ts`가 MKV·WebM(EBML, zlib 압축 블록 포함)과 MP4·MOV(moov 표, tx3g·wvtt)를 직접 해석합니다. MKV는 자막 블록이 영상 사이에 흩어져 있어 파일 전체를 조각으로 읽고, 자막 트랙이 없으면 Tracks까지만 읽고 멈춥니다. SRT·VTT·ASS·TXT 변환은 `src/lib/tools/subtitles.ts`. PGS·VobSub 같은 그림 자막과 화면에 새겨진 자막은 꺼낼 수 없습니다
- 음성 인식 자막(같은 페이지): transformers.js(`@huggingface/transformers` 4.2)로 Whisper(`onnx-community/whisper-base`·`whisper-small`)를 웹 워커(`src/lib/tools/whisper.worker.ts`)에서 돌립니다. WebGPU가 있으면 인코더 fp16(없으면 fp32)·디코더 q8, 없거나 실패하면 CPU에서 q8(그다음은 그래프 최적화를 끈 CPU). q4 디코더는 지금 ONNX Runtime이 불러오다 실패해 쓰지 않으며, 방식마다 1초 무음으로 시험 실행해 통과한 쪽을 씁니다. 모델 파일은 Cloudflare 정적 파일 한도(25MiB)를 넘어 Hugging Face에서 처음 한 번 받고 브라우저 캐시에 둡니다. ONNX Runtime 실행 파일은 `scripts/copy-models.mjs`가 `public/models/ort/`로 복사해 사이트에서 내려줍니다. 소리는 `src/lib/tools/audioDecode.ts`가 16kHz 모노로 바꾸고, `src/lib/tools/transcribe.ts`가 30초 끝부분의 조용한 곳에서 잘라 조각마다 인식한 뒤 긴 문장을 나눕니다(최대 60분)
- 동영상 자막 지우기: `/tools/video-subtitle-remove`. 자막 트랙은 `dropSubtitleTracks`(`src/lib/tools/videoConvert.ts`)가 영상·소리를 다시 인코딩하지 않고 옮겨 뺍니다(mediabunny가 입력 자막 트랙을 읽지 않으므로 자연히 빠짐, MKV는 MKV로 저장). 트랙이 있는지는 자막 추출의 `extractSubtitles`로 확인합니다. 화면에 새겨진 자막은 `processFrames`가 프레임마다 다시 인코딩하면서 `src/lib/tools/subtitleRemove.ts`로 고른 영역 안의 글자 픽셀(글자색이고, 획 굵기 거리 안의 가장 어두운 곳보다 충분히 밝은 픽셀)만 찾아 넓힌 뒤 워터마크 지우기의 `inpaint`로 메웁니다. 글자 픽셀이 적은 프레임은 그대로 둡니다. 긴 변 1920px 이하, H.264 MP4(안 되면 WEBM)
- 이미지 용량 줄이기·형식 변환: `/tools/image-compress`. 캔버스로 다시 그려 JPG·WebP·PNG로 저장합니다(`src/components/ImageConverter.tsx`). 목표 용량은 `findQuality`(`src/lib/tools/imageConvert.ts`)가 화질을 이분 탐색해 맞추고, 결과 크기는 `outputSize`가 원본보다 키우지 않고 iOS 캔버스 한도(약 1,670만 화소) 안으로 줄입니다. 같은 형식·같은 크기에서 결과가 더 크면 원본을 그대로 돌려줍니다. HEIC는 브라우저가 열 수 있을 때(Safari)만 변환하고, 아니면 `isHeic`로 알아보고 안내합니다
- 배경 제거(누끼): `/tools/remove-background`. transformers.js의 `background-removal` 파이프라인을 웹 워커(`src/lib/tools/bgRemove.worker.ts`)에서 돌립니다. 모델은 인물용 MODNet(`Xenova/modnet`, Apache-2.0)과 사물·상품용 BiRefNet lite(`onnx-community/BiRefNet_lite`, MIT)이고(RMBG-1.4는 상업적 사용이 제한돼 쓰지 않음), WebGPU가 있으면 fp16(없으면 fp32), 실패하면 CPU fp32로 다시 시도합니다. 워커에는 긴 변 2048px로 줄인 RGB만 보내고 마스크만 돌려받아, 화면 쪽에서 원본 크기로 키워 오려 냅니다. 배경색·자르기는 마스크를 다시 쓰므로 모델을 다시 돌리지 않습니다(`src/lib/tools/bgRemove.ts`의 `maskBounds`·`cropBox`). ONNX Runtime 경로 설정은 Whisper와 같은 `src/lib/tools/ortEnv.ts`

- HWP·HWPX → HTML 변환: `/tools/hwp-to-html`(`src/components/HwpToHtml.tsx`). 파일 첫 바이트로 형식을 가립니다(OLE → HWP, ZIP → HWPX).
  - HWP(5.x): 웹 워커(`src/lib/tools/hwp.worker.ts`)가 브라우저용 Python(Pyodide 0.27.7)에서 pyhwp(`hwp5html`)를 돌리고, PC용 도구와 같은 `tools/hwp2html/hwp2html.py`의 `hwp5_to_dir`·`inline_html`로 그림·CSS를 넣은 HTML 한 파일을 만듭니다. Pyodide 본체는 `scripts/copy-models.mjs`가 `public/pyodide/`로, `hwp2html.py`는 `public/hwp/`로 복사하고, npm에 없는 휠(lxml·six는 Pyodide 0.27.7 배포본, olefile, 직접 만든 pyhwp 0.1b15 휠)은 `public/hwp/`에 넣어 두었습니다. pyhwp는 AGPL-3.0이라 고치지 않고 쓰며, 페이지 FAQ에 출처를 적었습니다. pyhwp가 쓰는 `cryptography`(배포용 문서 해독)는 받지 않으므로 배포용 문서는 바꾸지 못합니다
  - HWPX: `src/lib/tools/hwpx.ts`가 ZIP(`unzip.ts`, 내장 DecompressionStream)을 풀어 OWPML XML을 직접 HTML로 바꿉니다(DOMParser를 써서 화면 쪽에서 실행). 글자·문단 모양은 `header.xml`의 id별 CSS 클래스(`.c{id}`, `.p{id}`, `.b{id}`)로, 표는 열 너비를 한 칸 셀부터 정해 `table-layout:fixed`로, 글 앞·뒤 개체는 쪽 기준 절대 위치로 그립니다. 수식 스크립트는 `hwpxEquation.ts`, 차트(OOXML)는 `hwpxChart.ts`가 SVG로 그립니다. 테스트는 `hwpx.test.ts`(실제 문서는 `HWPX_SAMPLE=경로.hwpx`)
- HWP·HWPX → HTML PC용 도구(Windows의 한컴오피스로 HWPX·HWP 3.x를 HWP로 저장한 뒤 pyhwp로 변환): `tools/hwp2html/`. 사용법은 `tools/hwp2html/README.md`

## 영어 페이지 (/en)
- 해외에서도 쓸 수 있는 도구(PDF·이미지·동영상·오디오·유틸리티) 18개만 영어 버전이 있습니다. 목록은 `src/lib/i18n.ts`의 `EN_TOOLS`(한글 타자 연습, 나이스 바이트 글자수 세기, 한국 기준 계산기는 한국어만).
- 주소: `/en`(영어 홈), `/en/tools/[slug]`. 한국어 주소는 그대로이고, 두 페이지는 hreflang(`alternates.languages`)과 사이트맵으로 서로 연결됩니다.
- 영어 제목·설명·사용법·FAQ: `src/data/tools.en.ts`. 화면 문구는 각 컴포넌트에서 `useT()`로 `t("한국어", "English")`처럼 나란히 적고, 경로가 `/en`이면 영어를 고릅니다(`src/lib/useT.ts`). 라이브러리의 오류 문구·파일 이름은 `lang` 인자(기본 `ko`)로 바꿉니다.
- 헤더의 언어 전환 링크는 같은 도구의 다른 언어 페이지로, 영어 버전이 없는 페이지에서는 영어 홈으로 갑니다.
- 새 도구에 영어 버전을 추가하려면: `EN_TOOLS`에 슬러그 추가 → `tools.en.ts`에 내용 추가 → 컴포넌트 문구를 `t()`로 감싸기 → `src/app/en/tools/[slug]/page.tsx`의 `components`에 연결.

## 실시간 관광지 CCTV (/cams, 시험 운영)
- 나중에 별도 도메인으로 옮길 기능이라 코드를 `src/features/cams/` 한 곳에 모았습니다(사이트의 다른 코드를 가져다 쓰지 않음). 페이지는 `src/app/cams/`(목록·지도)와 `src/app/cams/[id]/`(상세)뿐이고, 메뉴·사이트맵에 넣지 않으며 `noindex`입니다.
- 장소 자료: `src/features/cams/data/cams.json`. 영상 출처는 `sourceName`(필요하면 `sourceUrl`)에 넣으면 플레이어 아래와 카드에 "○○ 제공"으로 표시됩니다(없으면 "YouTube"). 영상은 `youtubeId`(라이브 영상 ID) 또는 `youtubeChannelId`(UC…, 방송이 다시 시작돼도 그 채널의 현재 라이브를 띄움) 중 하나를 넣고 `isLive`를 `true`로 바꿉니다. 비어 있으면 "영상 준비 중"과 `searchQuery`로 유튜브 라이브 검색 링크를 보여 줍니다. 퍼가기(embed)가 허용된 영상만 재생됩니다.
- 유튜브가 아닌 영상은 `hlsUrl`(HLS, .m3u8, 고정 주소)에 넣으면 hls.js로 재생합니다(사파리는 기본 재생). http 주소는 https로 바꿔 재생합니다(`hlsSrc`).
- 국가교통정보센터(ITS) CCTV는 영상 주소가 24시간만 유효해서 `itsCctv: { type: "its"(국도) | "ex"(고속도로), name: "CCTV 이름" }`만 적어 둡니다. Worker의 `/api/cams/streams`가 도로 유형마다 한 번씩 ITS를 불러(`cctvType=4`, https 주소) 장소 ID → 영상 주소를 만들고 데이터센터마다 20시간 캐시합니다(`src/features/cams/lib/its.ts`). 이름이 바뀌어도 300m 안의 CCTV로 짝을 짓습니다.
  - 준비: its.go.kr 마이페이지에서 받은 인증키를 Cloudflare Workers & Pages → `novalabs-projects` → Settings → Variables and Secrets에 비밀값 `ITS_API_KEY`로 저장(키 신청 때 사용처를 `https://novalabs.co.kr`로 등록). 호출 한도: 개발용 월 100건.
  - CCTV 이름 찾기: `https://openapi.its.go.kr:9443/cctvInfo?apiKey=…&type=its|ex&cctvType=4&minX=…&maxX=…&minY=…&maxY=…&getType=json`(국내 IP에서만 응답). 기술기준상 연속 재생 시간과 동시 재생 수가 제한될 수 있습니다.
- 경찰청 UTIC 개방데이터는 영상 재생까지 등록 IP 대역에서만 되어 공개 사이트에는 쓸 수 없습니다.
- 지도는 Leaflet + OpenStreetMap(키 불필요), 날씨는 브라우저에서 Open-Meteo를 바로 부릅니다(키 불필요). 스타일은 `cams.module.css`에 두고 사이트 색 변수만 빌려 씁니다.
- 분류·검색·추천(가까운 곳 + 같은 분류의 다른 지역)은 `src/features/cams/lib/cams.ts`, 테스트는 같은 폴더의 `cams.test.ts`.
- 라이브 점검: 라이브는 방송이 끊겼다 다시 열리면 영상 ID가 바뀌므로 `.github/workflows/check-cams.yml`이 매일 08:43(한국 시간) 연결된 영상이 아직 방송 중인지 확인합니다(`src/features/cams/scripts/check-live.mjs`, 판단 로직은 `lib/liveCheck.ts`). 끊긴 영상이 있으면 "실시간 CCTV 영상 점검" 이슈를 열고(이미 열려 있으면 결과가 바뀔 때만 댓글), 모두 정상이 되면 닫습니다. Actions 탭에서 "Check cam streams"를 직접 실행할 수도 있습니다.
  - 준비: [Google Cloud 콘솔](https://console.cloud.google.com/)에서 프로젝트를 만들고 "YouTube Data API v3"를 사용 설정 → 사용자 인증 정보 → API 키 만들기(키 제한에서 API를 YouTube Data API v3로만 제한 권장) → 저장소 Settings > Secrets and variables > Actions에 `YOUTUBE_API_KEY`로 저장. 키가 없으면 점검을 건너뜁니다.
  - 비용: 무료 할당량(하루 10,000단위) 안에서 동작합니다. 영상 50개당 1단위, 채널 ID로 연결한 곳은 곳마다 100단위.
  - 로컬 실행: `YOUTUBE_API_KEY=... node --experimental-strip-types src/features/cams/scripts/check-live.mjs` (결과는 `cams-report.md`)
- 도메인 분리 때: `src/features/cams/`와 `src/app/cams/`를 새 Next.js 프로젝트로 옮기고 `CAMS_BASE`를 `""`로 바꾼 뒤, 이 사이트의 `public/_redirects`에 `/cams/*` → 새 도메인 301을 추가합니다.

## 이미지 업스케일 AI 모델
- `/tools/image-upscaler`의 AI 모드는 UpscalerJS(`upscaler`)와 ESRGAN Medium 모델(`@upscalerjs/esrgan-medium`, MIT)을 TensorFlow.js(`@tensorflow/tfjs` 4.11, upscaler가 요구하는 버전)로 브라우저에서 실행합니다.
- 모델 파일(2배·4배, 각 약 2.8MB)은 저장소에 넣지 않고 `npm run dev`/`npm run build` 직전에 `scripts/copy-models.mjs`가 `node_modules`에서 `public/models/esrgan-medium/`으로 복사합니다(`.gitignore`). 외부 CDN에서 받지 않습니다.

## 로또 당첨 결과 갱신
- 자료: 동행복권 추첨 결과를 회차별 JSON으로 공개하는 [smok95/lotto](https://github.com/smok95/lotto) 저장소
- 자동: `.github/workflows/update-lotto.yml`이 매주 일요일 07:00·12:00, 월요일 09:00(한국 시간)에 새 회차를 받아 `main`에 커밋 → Workers Builds가 다시 배포. `main`에 브랜치 보호가 있으면 Actions 봇의 푸시를 허용해야 합니다.
- 수동: `node scripts/update-lotto.mjs` (빠진 회차만 추가), `--all`은 전체를 다시 받음. Actions 탭에서 "Update lotto results"를 직접 실행해도 됩니다.
- 1등 배출점: `src/data/lotto/stores.json`. 동행복권 당첨 판매점 조회(`/wnprchsplcsrch/selectLtWnShp.do`)에서 `node scripts/update-lotto-stores.mjs`로 받으며, 같은 주간 워크플로가 함께 실행합니다. 동행복권은 해외(GitHub Actions) 접속이 자주 끊겨 요청마다 다시 시도하고, 시간이 다 되면 받은 데까지 저장한 뒤 다음 실행 때 빠진 회차부터 이어 받습니다. 실패해도 당첨번호 갱신은 막지 않습니다.

## 유튜브 해외반응 쇼츠 주제 찾기

- 구독자는 적은데 조회수가 큰 쇼츠(조회수 ÷ 구독자 배수)를 찾습니다. 사이트와는 따로 쓰는 도구입니다.
- 실행: Actions 탭 > "Find outlier shorts" > Run workflow에서 검색어·기간·구독자 최대·조회수 최소·배수·정렬 기준을 정해 실행 → 실행 결과 화면에 상위 30개 표, 전체는 `outlier-shorts` CSV로 첨부(`.github/workflows/find-outlier-shorts.yml`).
- 키: 실시간 CCTV 점검과 같은 `YOUTUBE_API_KEY`. 기본값(검색어 3개 × 2쪽)으로 한 번에 약 600단위를 씁니다(하루 무료 10,000단위).
- 기준: 최근 30일, 구독자 1만 이하, 조회수 10만 이상, 10배 이상, 조회수 높은 순(`--sort ratio`면 배수 큰 순). 쇼츠 여부는 API가 알려 주지 않아 3분 이하 영상을 쇼츠로 봅니다. 구독자 수를 숨긴 채널은 뺍니다.
- CSV에는 영상 설명란(앞 300자, 줄바꿈은 한 칸으로)과 "원본 표시"(설명란에 적힌 틱톡·인스타·유튜브 등 SNS 링크와 `@아이디`)도 담습니다. 번역·재업로드 영상의 원작자를 찾을 때 씁니다. 기본은 원본 출처가 적힌 영상만 보여 주고(`--credits only`, 배경음악 출처 줄의 링크는 원본으로 치지 않음), 실행 화면에서 `all`을 고르면 출처 상관없이 모두 봅니다.
- 로컬 실행: `YOUTUBE_API_KEY=... node scripts/youtube-outliers.mjs [--days 30] [--max-subs 10000] [--min-views 100000] [--min-ratio 10] [--sort views|ratio] [--credits only|all] [검색어 ...]` (결과는 `outlier-shorts.csv`), 테스트는 `scripts/youtube-outliers.test.mjs`.

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

### 음성 합성 비교 페이지 (/lab/tts, 혼자 쓰는 용도)
쇼핑 쇼츠 대본을 OpenAI(`gpt-4o-mini-tts`)·타입캐스트(SSFM 3.0)·ElevenLabs 목소리로 만들어 비교합니다. 메뉴·사이트맵에 넣지 않고 `noindex`입니다.
- 브라우저 → `worker/index.ts`(`/api/tts/status`·`voices`·`speak`) → 각 서비스. `wrangler.jsonc`의 `run_worker_first`로 `/api/*`만 Worker가 받고 나머지는 정적 파일 그대로입니다. 서비스별 요청 모양·말투(쇼호스트·솔직 리뷰·고급 제품)는 `src/lib/tts.ts`
- 사이트 전체에 광고 스크립트가 있어 API 키는 브라우저에 두지 않고 Worker **런타임** 비밀값에 둡니다. Workers & Pages → `novalabs-projects` → Settings → **Variables and Secrets**(빌드 변수 아님)에 Secret으로 추가:
  - `TTS_PASSWORD`: 페이지에서 입력할 비밀번호(필수, 없으면 API가 동작하지 않음)
  - `OPENAI_API_KEY`, `TYPECAST_API_KEY`, `ELEVENLABS_API_KEY`: 쓸 서비스만 넣으면 되고, 없는 서비스는 페이지에서 꺼집니다
- `npm run dev`에는 API가 없습니다. 로컬에서는 `npm run build` 뒤 `.dev.vars`에 위 값을 적고 `npx wrangler dev`로 확인합니다(`.dev.vars`는 커밋하지 않음)

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
