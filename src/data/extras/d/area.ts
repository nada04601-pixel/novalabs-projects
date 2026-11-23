import { SQM_PER_PYEONG, sqmToPyeong } from "@/lib/calculators/area";
import type { GuideExtra } from "../types";
import { fx, krw } from "./fmt";

const py = (m: number, d = 1) => `${fx(sqmToPyeong(m), d)}평`;

// 표 1: 전용면적별 평수와 전용률별 공급 평수(추정)
const exclusives = [39, 49, 59, 74, 84, 102, 114, 135];
const efficiency = [0.8, 0.75, 0.7];
const e84_75 = sqmToPyeong(84 / 0.75);
const e84_80 = sqmToPyeong(84 / 0.8);

// 계산 예시: 아파트 A와 오피스텔 B의 평당 가격
const A = { price: 600_000_000, exclusive: 84, supply: 112 };
const B = { price: 300_000_000, exclusive: 33, contract: 66 };
const aSupplyPer = A.price / sqmToPyeong(A.supply);
const bContractPer = B.price / sqmToPyeong(B.contract);
const aExclPer = A.price / sqmToPyeong(A.exclusive);
const bExclPer = B.price / sqmToPyeong(B.exclusive);
const roundGap = (SQM_PER_PYEONG - 3.3) / SQM_PER_PYEONG;

// 표 2: 제도에서 쓰는 면적 기준
const rules: [string, number, string][] = [
  ["국민주택규모", 85, "월세 세액공제 대상 주택, 국민주택 공급 기준 등"],
  ["국민주택규모(수도권 밖 도시지역이 아닌 읍·면)", 100, "같은 제도에서 이 지역에 적용"],
  ["자녀·손자녀 3명 이상 가구의 월세 세액공제", 100, "2026년 세법 개정으로 넓어진 기준"],
  ["주거용 오피스텔 중개보수 요율", 85, "전용 85㎡ 이하에 전용 부엌·화장실·목욕시설을 갖추면 매매 0.5%, 임대차 0.4% 상한"],
];
const k85Low = Math.round(sqmToPyeong(85 / 0.8));
const k85High = Math.round(sqmToPyeong(85 / 0.75));

export const areaGuideExtra: GuideExtra = {
  updated: "2026-11-23",
  mode: "append",
  sections: [
    {
      heading: "전용면적별 평수와 평형 추정표",
      body: [
        "광고의 '평형'은 보통 공급면적 기준이라, 전용면적만 알 때는 전용률을 가정해 평형을 어림할 수 있습니다. 아래 표는 평수 계산기와 같은 식(1평 = 400/121㎡)으로 전용면적을 평으로 바꾸고, 전용률이 80%·75%·70%일 때의 공급면적 평수를 계산한 것입니다.",
      ],
      table: {
        caption: "전용면적별 평수와 전용률별 공급 평수",
        head: ["전용면적", "전용 평수", "공급 평수(전용률 80%)", "공급 평수(75%)", "공급 평수(70%)"],
        rows: exclusives.map((m) => [`${m}㎡`, py(m), ...efficiency.map((e) => py(m / e))]),
        note: "공급면적 = 전용면적 ÷ 전용률로 계산한 추정값이며 소수 둘째 자리에서 반올림했습니다. 실제 공급면적은 단지와 동 구조에 따라 다르므로 분양공고나 건축물대장에서 확인하세요.",
      },
      after: [
        `전용 84㎡는 전용률이 75%라면 공급 약 ${fx(e84_75)}평으로 '${Math.round(e84_75)}평형'에 가깝고, 80%라면 약 ${fx(e84_80)}평으로 '${Math.round(e84_80)}평형' 정도가 됩니다. 같은 전용면적이라도 전용률에 따라 평형 이름이 달라지는 이유입니다.`,
      ],
    },
    {
      heading: "아파트와 오피스텔의 평당 가격 계산 예시",
      body: [
        `면적 기준이 다른 두 매물을 같은 방식으로 비교해 보겠습니다. 아파트 A는 ${krw(A.price)}, 전용 ${A.exclusive}㎡, 공급 ${A.supply}㎡입니다. 오피스텔 B는 ${krw(B.price)}, 전용 ${B.exclusive}㎡, 계약면적 ${B.contract}㎡(전용률 ${Math.round((B.exclusive / B.contract) * 100)}%)라고 가정합니다.`,
        `1단계, 면적을 평으로: A는 전용 ${py(A.exclusive, 2)}·공급 ${py(A.supply, 2)}, B는 전용 ${py(B.exclusive, 2)}·계약 ${py(B.contract, 2)}입니다.`,
        `2단계, 광고 기준 평당 가격: A를 공급면적으로 나누면 평당 약 ${krw(aSupplyPer)}, B를 계약면적으로 나누면 평당 약 ${krw(bContractPer)}입니다. 이 숫자만 보면 B가 더 싸 보입니다.`,
        `3단계, 전용면적 기준으로 다시 계산: A는 평당 약 ${krw(aExclPer)}, B는 평당 약 ${krw(bExclPer)}입니다. 실제로 쓰는 공간으로 보면 B가 평당 약 ${krw(bExclPer - aExclPer)} 더 비쌉니다.`,
        `4단계, ㎡당 가격: 등기부와 실거래가 자료에는 면적이 ㎡로 적혀 있어 ㎡당 가격으로 비교해도 됩니다. 전용 ㎡당 A는 약 ${krw(A.price / A.exclusive)}, B는 약 ${krw(B.price / B.exclusive)}입니다.`,
      ],
      after: [
        `'3.3㎡당 가격'이라고 쓴 자료는 1평을 3.3㎡로 어림해 계산한 값입니다. 정확한 1평(약 ${fx(SQM_PER_PYEONG, 4)}㎡)과의 차이는 약 ${fx(roundGap * 100, 2)}%라 비교에는 큰 문제가 없지만, 같은 비교 안에서 두 방식을 섞지 않도록 주의하세요.`,
      ],
    },
    {
      heading: "제도에서 쓰는 면적 기준을 평으로 바꾸면",
      body: [
        "세금과 주택 제도는 대부분 전용면적(㎡)을 기준으로 합니다. 자주 나오는 기준을 평으로 바꾸면 다음과 같습니다.",
      ],
      table: {
        caption: "주택 제도의 전용면적 기준과 평 환산",
        head: ["기준", "전용면적", "평 환산", "쓰이는 곳"],
        rows: rules.map(([name, m, use]) => [name, `${m}㎡ 이하`, `약 ${py(m, 2)}`, use]),
        note: "평 환산은 1평 = 400/121㎡로 계산해 소수 셋째 자리에서 반올림했습니다. 월세 세액공제는 면적 대신 기준시가 4억 원 이하 요건을 충족해도 되는 등 다른 요건이 함께 있으니 해당 법령을 확인하세요.",
      },
      after: [
        `전용 85㎡는 약 ${py(85, 1)}이라, 전용률이 75~80%인 아파트라면 공급면적 기준 ${k85Low}~${k85High}평형 정도가 이 기준 안에 들어갑니다. 평형 이름만 보고 '국민주택규모를 넘는다'고 판단하지 말고 전용면적으로 확인하세요.`,
      ],
    },
    {
      heading: "면적을 잘못 읽기 쉬운 경우",
      body: [
        "① 분양공고의 면적 표시: 주택공급에 관한 규칙은 공동주택의 세대별 면적을 주거전용면적으로 표시하게 하고, 주거공용면적(계단·복도·현관 등 지상층 공용면적)과 그 밖의 공용면적(지하층·관리사무소·노인정 등)은 따로 적을 수 있게 합니다. 공고의 표에서 전용면적을 먼저 보고, 공용면적이 어떤 항목인지 나눠 읽으세요.",
        "② 다가구주택: 건물 전체가 아니라 내가 빌리는 가구의 전용면적을 봅니다. 월세 세액공제의 면적 요건도 다가구주택이면 가구당 전용면적을 기준으로 합니다.",
        `③ 3.3으로 나누기: ㎡를 3.3으로 나누면 평수가 조금 크게 나옵니다. 84㎡를 3.3으로 나누면 ${fx(84 / 3.3, 2)}평이지만 정확히는 ${fx(sqmToPyeong(84), 2)}평입니다. 면적이 클수록 차이도 커집니다.`,
        "④ 계약면적과 공급면적: 오피스텔은 기타 공용면적까지 더한 계약면적으로 분양하는 경우가 많아, 아파트의 공급면적과 같은 숫자라도 실제 공간이 훨씬 작을 수 있습니다. 서로 다른 유형을 비교할 때는 반드시 전용면적끼리 비교하세요.",
      ],
    },
  ],
  sources: [
    { label: "국가법령정보센터 · 주택법(제2조 국민주택규모 정의)", url: "https://www.law.go.kr/법령/주택법" },
    { label: "국가법령정보센터 · 주택공급에 관한 규칙(제21조 공급면적 표시)", url: "https://www.law.go.kr/법령/주택공급에관한규칙" },
    { label: "국가법령정보센터 · 조세특례제한법 시행령(제95조 월세 세액공제 대상 주택)", url: "https://www.law.go.kr/법령/조세특례제한법시행령" },
  ],
};
