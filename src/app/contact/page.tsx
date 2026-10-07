import Link from "next/link";
import type { Metadata } from "next";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "문의",
  description: `${site.name}의 계산 오류 제보, 기능 제안, 제휴 문의 방법과 답변 안내입니다.`,
};

export default function Contact() {
  return (
    <div className="w page">
      <h1>문의</h1>
      <p>계산 오류 제보, 기능 제안, 제휴 문의는 아래 이메일로 보내주세요. 보내주신 메일은 운영자가 직접 읽고, 영업일 기준 3일 안에 답변드리는 것을 목표로 합니다.</p>
      <p><a className="btn" href={`mailto:${site.email}`}>{site.email}</a></p>

      <h2>이런 내용을 보내주세요</h2>
      <ul>
        <li><strong>계산 오류 제보</strong>: 결과가 급여명세서, 은행 안내, 관계 기관 자료와 다를 때</li>
        <li><strong>바뀐 제도 알림</strong>: 요율, 공제 한도, 지원 기준이 바뀌었는데 아직 반영되지 않았을 때</li>
        <li><strong>기능 제안</strong>: 있었으면 하는 계산기나 입력 항목, 불편한 화면</li>
        <li><strong>제휴·기타 문의</strong>: 콘텐츠 협업, 출처 표기, 그 밖의 문의</li>
      </ul>

      <h2>계산 오류를 알려주실 때</h2>
      <p>아래 내용을 함께 적어 주시면 같은 조건으로 다시 계산해 보고 원인을 빠르게 찾을 수 있습니다.</p>
      <ol>
        <li>사용한 계산기 이름이나 페이지 주소</li>
        <li>입력한 값 (금액, 기간, 선택한 옵션)</li>
        <li>화면에 나온 결과와 기대한 결과</li>
        <li>기대한 결과의 근거 (급여명세서, 기관 안내 페이지 등)</li>
      </ol>
      <p>확인된 오류는 계산기와 관련 가이드에 함께 반영하고, 반영 후 답장으로 알려드립니다.</p>

      <h2>개인정보 관련 안내</h2>
      <p>{site.name}의 계산은 모두 브라우저 안에서 이루어지며, 계산기에 입력한 값은 서버로 전송되지 않습니다. 문의 메일에 주민등록번호, 계좌 비밀번호처럼 민감한 정보는 적지 마세요. 받은 메일 주소와 내용은 답변과 오류 수정에만 사용합니다. 자세한 내용은 <Link href="/privacy">개인정보처리방침</Link>에서 확인할 수 있습니다.</p>

      <h2>문의 전에 확인해 보세요</h2>
      <p>계산기마다 계산 방식과 자주 묻는 질문을 페이지 아래에 정리해 두었습니다. 제도 설명은 <Link href="/guides">생활 계산 가이드</Link>, 사이트 운영 원칙과 기준 자료는 <Link href="/about">소개</Link> 페이지에 있습니다.</p>
      <p className="note">세무·법률 판단이 필요한 개별 상담에는 답변드리기 어렵습니다. 이런 경우 국세청 126, 고용노동부 1350 같은 관계 기관 상담 창구를 이용해 주세요.</p>
    </div>
  );
}
