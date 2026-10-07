import type { Metadata } from "next";
import ToolBrowser from "@/components/ToolBrowser";
import Breadcrumbs from "@/components/Breadcrumbs";
import { navItems } from "@/data/nav";

export const metadata: Metadata = {
  title: "전체 계산기",
  description: "연봉 실수령액, 퇴직금, 대출이자부터 만 나이, 부가세, 모임 정산까지 노바랩 계산소의 계산기를 분류별로 찾아보세요.",
  alternates: { canonical: "/tools" },
};

export default function ToolsIndex() {
  return (
    <div className="w wide page">
      <Breadcrumbs items={[{ label: "계산기" }]} />
      <h1>전체 계산기</h1>
      <p className="lead">생활에 필요한 계산기 {navItems.length}개를 분류별로 모았습니다. 이름이나 쓰임새로 검색해 보세요.</p>
      <ToolBrowser />
    </div>
  );
}
