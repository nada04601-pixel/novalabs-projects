import { RATES } from "@/data/rates/2026";
import type { Source } from "@/data/content";

// 묶음 c(대출·저축·이자 세금) 보강 글이 함께 쓰는 숫자 표기와 세율, 참고 자료.

export const n = (v: number) => Math.round(v).toLocaleString("ko-KR");
export const won = (v: number) => `${n(v)}원`;
// 비율을 소수 자리 고정으로: 0.0354 → "3.54%"
export const pc = (r: number, d = 2) => `${(r * 100).toFixed(d)}%`;
// 예시 금리처럼 입력값을 쓸 때: 0.035 → "3.5%", 0.04 → "4%"
export const rt = (r: number) => `${parseFloat((r * 100).toFixed(2))}%`;
// 큰 금액을 만 원 단위로 반올림해 "2억 1,561만 원", "8,400만 원"처럼 씁니다.
export const krw = (v: number) => {
  const m = Math.round(v / 10_000);
  const eok = Math.floor(m / 10_000);
  const rest = m % 10_000;
  if (eok > 0) return rest ? `${eok}억 ${n(rest)}만 원` : `${eok}억 원`;
  return `${n(m)}만 원`;
};

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

// 이자소득세율. 일반과세 15.4%는 RATES에서 가져오고, 소득세 14%는 지방소득세(소득세의 10%)를 빼서 구합니다.
export const TAX_NORMAL = RATES.interestTax.normal;
export const TAX_PREF = RATES.interestTax.preferential;
export const INCOME_TAX = r6(RATES.interestTax.normal / (1 + RATES.localTaxRate)); // 소득세법 제129조: 14%
// 농어촌특별세법 제5조: 조세특례제한법으로 감면받은 이자소득세(14%로 계산한 세액 − 실제 소득세)의 10%
const NONGTEUK_RATE = 0.1;
const withNongteuk = (special: number) => r6(special + (INCOME_TAX - special) * NONGTEUK_RATE);
// 조세특례제한법 제89조의3(2025.12.23. 개정, 2026.1.1. 시행): 조합 등 예탁금
export const COOP_SPECIAL_2026 = 0.05; // 2026년 가입, 소득 요건 등 미충족
export const COOP_SPECIAL_2027 = 0.09; // 2027년 이후 가입, 소득 요건 등 미충족
export const TAX_COOP_EXEMPT = withNongteuk(0); // 비과세 + 농어촌특별세 = 1.4%
export const TAX_COOP_2026 = withNongteuk(COOP_SPECIAL_2026); // 5.9%
export const TAX_COOP_2027 = withNongteuk(COOP_SPECIAL_2027); // 9.5%
export const TAX_EXEMPT = RATES.interestTax.exempt;

export const SRC = {
  taxLaw: { label: "국가법령정보센터 – 조세특례제한법(제88조의2 비과세종합저축, 제89조 세금우대종합저축, 제89조의3 조합등예탁금)", url: "https://www.law.go.kr/법령/조세특례제한법" },
  taxDecree: { label: "국가법령정보센터 – 조세특례제한법 시행령(제82조의2, 제82조의5, 제83조의3)", url: "https://www.law.go.kr/법령/조세특례제한법시행령" },
  nongteuk: { label: "국가법령정보센터 – 농어촌특별세법(제4조 비과세, 제5조 과세표준과 세율)", url: "https://www.law.go.kr/법령/농어촌특별세법" },
  incomeTaxLaw: { label: "국가법령정보센터 – 소득세법(제129조 원천징수세율)", url: "https://www.law.go.kr/법령/소득세법" },
  ntsRate: { label: "국세청 – 원천세 세율(이자소득 14%)", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2291&cntntsId=7703" },
  ntsQna: { label: "국세청 세법상담센터 – 종합소득세 자주 묻는 상담(금융소득 종합과세)", url: "https://call.nts.go.kr/call/qna/selectQnaInfo.do?ctgId=CTG11775&mi=1441" },
  kdic: { label: "예금보험공사 – 예금자보호제도 보호한도", url: "https://www.kdic.or.kr/sp/dpstrprot/ProtSystProtLmts/selectScrn.do" },
  finlife: { label: "금융감독원 – 금융상품 통합 비교공시 금융상품한눈에", url: "https://finlife.fss.or.kr/finlife/main/main.do" },
  consumerLaw: { label: "국가법령정보센터 – 금융소비자 보호에 관한 법률(제20조 불공정영업행위의 금지)", url: "https://www.law.go.kr/법령/금융소비자보호에관한법률" },
  fscPrepay: { label: "금융위원회 – 1월 13일(월) 신규 대출부터 중도상환수수료율이 인하됩니다(2025.1.9.)", url: "https://www.fsc.go.kr/edu/news/83839" },
} satisfies Record<string, Source>;
