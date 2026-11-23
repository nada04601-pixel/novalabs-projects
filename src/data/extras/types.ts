import type { ContentSection, Source } from "@/data/content";

// 가이드 보강: 원래 글 뒤에 소제목을 덧붙이거나(append), 글 전체를 바꿉니다(replace).
export type GuideExtra = {
  updated: string; // 고친 날 YYYY-MM-DD (글에 "최종 확인"으로 보임)
  mode: "append" | "replace";
  title?: string;
  description?: string;
  sections: ContentSection[];
  sources: Source[];
};

// 도구 페이지 보강: 사용법(howTo) 뒤, 자주 묻는 질문 앞에 "계산 예시"·"계산 근거" 같은 소제목을 덧붙입니다.
export type ToolExtra = {
  updated: string;
  sections: ContentSection[];
  sources: Source[];
};
