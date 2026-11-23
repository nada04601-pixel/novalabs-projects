// 가이드·도구 페이지가 함께 쓰는 본문 조각(문단 + 표 + 참고 자료).

// 표: 계산 예시처럼 숫자를 한눈에 비교할 때 씁니다. 칸 값은 이미 보기 좋게 만든 글자로 넣습니다.
export type ContentTable = {
  caption: string; // 표 제목(무엇을 어떤 조건으로 계산했는지)
  head: string[];
  rows: string[][];
  note?: string; // 표 아래 작은 글씨(가정, 반올림 기준 등)
};

// 소제목 하나: 문단 → (표) → (표 뒤 문단)
export type ContentSection = {
  heading: string;
  body: string[];
  table?: ContentTable;
  after?: string[];
};

// 참고한 자료(관계 기관·법령 원문)
export type Source = { label: string; url: string };
