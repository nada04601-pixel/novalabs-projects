"use client";
import { usePathname } from "next/navigation";
import { langOf, pick, type Lang } from "@/lib/i18n";

// 지금 보는 페이지의 언어. 정적 빌드 때도 경로를 알 수 있어 영어 페이지 HTML에는 처음부터 영어가 들어갑니다.
export const useLang = (): Lang => langOf(usePathname());

// t("한국어", "English") 꼴로 씁니다.
export function useT() {
  const lang = useLang();
  return Object.assign((ko: string, en: string) => pick(lang, ko, en), { lang });
}
