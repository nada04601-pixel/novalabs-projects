export const site = {
  name: "노바랩 공작소",
  domain: "novalabs.co.kr",
  url: "https://novalabs.co.kr",
  tagline: "계산부터 문서까지, 자주 쓰는 도구를 한곳에",
  description:
    "연봉 실수령액, 퇴직금, 대출이자 같은 생활 계산부터 PDF 용량 줄이기 같은 문서 작업까지, 자주 쓰는 도구를 무료로 바로 쓸 수 있는 노바랩 공작소입니다.",
  email: "nada0460@naver.com",
  year: 2026,
  // 애드센스 게시자 ID(ca-pub-로 시작). 비워두면 광고 스크립트와 ads.txt가 나가지 않습니다.
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "",
  // Search Console HTML 태그 인증값(content 속성 값)
  googleVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "",
};
