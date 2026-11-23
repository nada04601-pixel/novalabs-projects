import Link from "next/link";
import { site } from "@/data/site";

// 가이드 글 아래에 붙는 글쓴이 상자. 누가, 어떤 방식으로 쓰고 확인했는지 밝힙니다.
export default function AuthorBox({ updated }: { updated?: string }) {
  return (
    <aside className="author-box" aria-label="글쓴이">
      <p className="author-name">
        글쓴이 · <Link href="/about">{site.operator.name}</Link>
      </p>
      <p>{site.operator.bio}</p>
      <p>{site.operator.method}</p>
      {updated && <p className="note-sm">최종 확인 {updated.replaceAll("-", ".")}</p>}
      <p className="note-sm">
        틀린 내용이나 바뀐 제도를 발견하면 <Link href="/contact">문의</Link>로 알려 주세요. 확인 후 고칩니다.
      </p>
    </aside>
  );
}
