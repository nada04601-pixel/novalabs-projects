export const site = {
  name: "노바랩 공작소",
  // 영어 페이지(/en)에서 쓰는 이름과 소개
  nameEn: "NovaLabs",
  descriptionEn:
    "Free online tools that run right in your browser: compress, merge and split PDFs, upscale images with AI, trim and compress videos, and more. Files are never uploaded.",
  domain: "novalabs.co.kr",
  url: "https://novalabs.co.kr",
  tagline: "계산부터 문서까지, 자주 쓰는 도구를 한곳에",
  description:
    "연봉 실수령액, 퇴직금, 대출이자 같은 생활 계산부터 PDF 용량 줄이기 같은 문서 작업까지, 자주 쓰는 도구를 무료로 바로 쓸 수 있는 노바랩 공작소입니다.",
  email: "nada0460@naver.com",
  // 운영자 소개(가이드 글쓴이 상자와 소개 페이지에서 씀). 개인 경력은 밝히지 않고 회사 이름만 씁니다(대표 선택 2026-11-23).
  operator: {
    name: "노바랩스",
    bio: "소프트웨어 개발 회사 노바랩스가 만들고 운영합니다.",
    method: "글의 계산 예시와 표는 공작소 계산기와 같은 계산 코드로 만들고, 요율과 기준은 관계 기관이 공개한 자료로 확인합니다.",
  },
  year: 2026,
  // 애드센스 게시자 ID(ca-pub-로 시작). 페이지에 그대로 공개되는 값이라 코드에 둡니다. 빌드 변수가 있으면 그 값을 씁니다.
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-6228511708822958",
  // Search Console HTML 태그 인증값(content 속성 값)
  googleVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "",
  // 네이버 서치어드바이저 HTML 태그 인증값(content 속성 값). 페이지에 그대로 공개되는 값이라 코드에 둡니다.
  // 다음 웹마스터도구 인증값(robots.txt 하단의 #DaumWebMasterTool: 뒤 값). robots.txt에 그대로 공개되는 값입니다.
  daumVerification: "f7a076fbb14df91a7adc32085e4d53a49c0a42ae062204ce61eeb72d82a954dc:UjR58tlt8ZMRZi79BVamzQ==",
  naverVerification: process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION || "97502a7fa05b10fbb9b4ed9f301c9bcd3f143822",
};
