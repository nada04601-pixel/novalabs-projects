import { calcElectricity, CLIMATE_PRICE, FUEL_PRICE_2026Q4, TARIFF, type Voltage } from "@/lib/calculators/electricity";
import type { ContentSection } from "@/data/content";
import type { ToolExtra } from "../types";

const n = (v: number) => Math.round(v).toLocaleString("ko-KR");
const won = (v: number) => `${n(v)}원`;
const el = (kwh: number, month = 11, voltage: Voltage = "low") => calcElectricity({ kwh, month, voltage });

const ex = el(350);
const levels = [100, 200, 201, 250, 300, 350, 400, 401, 450, 500, 600];
const winter = [800, 1_000, 1_100, 1_200, 1_500];
const lowHigh = [200, 300, 400, 500];

const sections: ContentSection[] = [
  {
    heading: "계산 예시: 11월에 350kWh를 쓰면",
    body: [
      `주택용 저압 가구가 11월에 350kWh를 쓰면 201~400kWh 구간에 들어가 기본요금은 ${won(ex.basic)}입니다. 전력량요금은 처음 200kWh에 ${TARIFF.low.tiers[0].price}원, 나머지 150kWh에 ${TARIFF.low.tiers[1].price}원을 곱해 더합니다. 기후환경요금 ${CLIMATE_PRICE.toFixed(1)}원과 연료비조정요금 ${FUEL_PRICE_2026Q4.toFixed(1)}원(2026년 4분기)은 사용량 전체에 곱합니다.`,
    ],
    table: {
      caption: "주택용 저압 11월 350kWh 전기요금",
      head: ["항목", "계산", "금액"],
      rows: [
        ["기본요금", "201~400kWh 구간", won(ex.basic)],
        ...ex.uses.map((u) => [`전력량요금 ${u.label}`, `${n(u.kwh)}kWh × ${u.price}원`, `${(Math.round(u.amount * 10) / 10).toLocaleString("ko-KR")}원`]),
        ["전력량요금 합계", "원 미만 버림", won(ex.energy)],
        ["기후환경요금", `350kWh × ${CLIMATE_PRICE.toFixed(1)}원`, won(ex.climate)],
        ["연료비조정요금", `350kWh × ${FUEL_PRICE_2026Q4.toFixed(1)}원`, won(ex.fuel)],
        ["전기요금계", "", won(ex.subtotal)],
        ["부가가치세", "전기요금계 × 10%, 원 미만 반올림", won(ex.vat)],
        ["전력산업기반기금", "전기요금계 × 2.7%, 10원 미만 버림", won(ex.fund)],
        ["청구액", "10원 미만 버림", won(ex.bill)],
      ],
      note: "한전ON 전기요금계산기에 같은 조건(2026년 10~11월 사용, 복지할인 없음)을 넣은 결과와 같습니다. TV 수신료는 따로 붙습니다.",
    },
  },
  {
    heading: "사용량별 청구액",
    body: [
      "누진 구간 경계(200kWh, 400kWh)를 넘는 순간 기본요금이 함께 오르기 때문에 1kWh 차이로도 요금이 꽤 달라집니다. 1~6월, 9~12월(기타계절) 기준 청구액입니다.",
    ],
    table: {
      caption: "주택용 저압 사용량별 청구액(기타계절, 2026년 4분기 단가)",
      head: ["한 달 사용량", "기본요금", "전기요금계", "청구액"],
      rows: levels.map((k) => {
        const r = el(k);
        return [`${n(k)}kWh`, won(r.basic), won(r.subtotal), won(r.bill)];
      }),
      note: "7~8월(하계)에는 구간이 300kWh와 450kWh로 넓어져 같은 사용량이라도 요금이 낮아집니다.",
    },
  },
  {
    heading: "겨울철 많이 쓰는 집: 슈퍼유저 요금",
    body: [
      `12~2월과 7~8월에는 1,000kWh를 넘게 쓴 부분에 슈퍼유저 단가(저압 ${TARIFF.low.superPrice}원, 고압 ${TARIFF.high.superPrice}원)가 붙습니다. 전기난방을 많이 쓰는 집이라면 11월과 12월 요금이 같은 사용량에서도 달라질 수 있습니다.`,
    ],
    table: {
      caption: "주택용 저압 11월과 12월 청구액 비교",
      head: ["한 달 사용량", "11월(슈퍼유저 없음)", "12월(슈퍼유저 적용)", "차이"],
      rows: winter.map((k) => {
        const a = el(k, 11).bill;
        const b = el(k, 12).bill;
        return [`${n(k)}kWh`, won(a), won(b), won(b - a)];
      }),
    },
  },
  {
    heading: "저압과 고압 비교",
    body: [
      "주택용 고압은 기본요금과 kWh당 단가가 모두 저압보다 낮습니다. 다만 고압인지 저압인지는 집이 전기를 받는 방식에 따라 정해지므로, 우리 집 계약은 고지서의 계약종별로 확인합니다.",
    ],
    table: {
      caption: "주택용 저압과 고압의 청구액(기타계절)",
      head: ["한 달 사용량", "저압", "고압"],
      rows: lowHigh.map((k) => [`${n(k)}kWh`, won(el(k, 11, "low").bill), won(el(k, 11, "high").bill)]),
    },
    after: [
      "계산기와 고지서가 다르면 먼저 사용 기간과 사용량을 확인하세요. 고지서의 사용량은 검침일 사이의 양이라 달력의 한 달과 다를 수 있고, 아파트는 관리비에 공용 전기료가 따로 붙습니다. 복지할인이나 자동이체 할인을 받는 집은 그만큼 더 적게 나옵니다. 정확한 금액은 한전ON이나 고객센터(국번 없이 123)에서 확인하세요.",
    ],
  },
];

export const electricityExtra: ToolExtra = {
  updated: "2026-11-27",
  sections,
  sources: [
    { label: "한전ON – 전기요금표(주택용 전력 저압·고압)", url: "https://online.kepco.co.kr/PRM004D00" },
    { label: "한전ON – 원가연계형 요금제(기후환경요금·연료비조정요금)", url: "https://online.kepco.co.kr/PRM097D00" },
    { label: "한전ON – 전기요금계산기(청구액 계산 방법)", url: "https://online.kepco.co.kr/PRM033D00" },
    { label: "국가법령정보센터 – 전기사업법 시행령(제36조 전력산업기반기금 부담금)", url: "https://www.law.go.kr/법령/전기사업법시행령" },
  ],
};
