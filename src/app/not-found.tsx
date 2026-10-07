import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다",
};

export default function NotFound() {
  return (
    <div className="w page">
      <h1>페이지를 찾을 수 없습니다</h1>
      <p className="lead">주소가 바뀌었거나 삭제된 페이지입니다. 아래에서 원하는 내용을 다시 찾아보세요.</p>
      <ul>
        <li><Link href="/tools">전체 계산기 보기</Link></li>
        <li><Link href="/guides">생활 계산 가이드 읽기</Link></li>
        <li><Link href="/moim">모임 정산하기</Link></li>
      </ul>
      <p><Link className="btn" href="/">홈으로</Link></p>
    </div>
  );
}
