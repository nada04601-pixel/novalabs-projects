import type { Metadata } from "next";
import ToolBrowser from "@/components/ToolBrowser";
import Breadcrumbs from "@/components/Breadcrumbs";
import { navItems } from "@/data/nav";

export const metadata: Metadata = {
  title: "도구함",
  description: "연봉 실수령액, 퇴직금, 대출이자부터 모임 정산, PDF·이미지 도구까지 노바랩 공작소의 도구를 분류별로 찾아보세요.",
  alternates: { canonical: "/tools" },
};

export default function ToolsIndex() {
  return (
    <div className="w wide page">
      <Breadcrumbs items={[{ label: "도구함" }]} />
      <h1>도구함</h1>
      <p className="lead">생활에 필요한 계산기와 디지털 도구 {navItems.length}개를 분류별로 모았습니다. 이름이나 쓰임새로 검색해 보세요.</p>
      <ToolBrowser />
    </div>
  );
}
