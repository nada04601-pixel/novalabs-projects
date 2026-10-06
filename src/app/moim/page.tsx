import type { Metadata } from "next";
import Link from "next/link";
import MoimSettlement from "@/components/MoimSettlement";

const faq = [
  {
    q: "가입하거나 앱을 설치해야 하나요?",
    a: "필요 없습니다. 참여자 이름과 차수별 금액만 넣으면 바로 계산되고, 결과는 링크 하나로 단톡방에 공유할 수 있습니다.",
  },
  {
    q: "입력한 내용은 어디에 저장되나요?",
    a: "서버에 저장하지 않습니다. 입력한 내용은 주소창의 링크 안에 담기므로, 링크를 가진 사람만 정산 내역을 볼 수 있습니다. 계좌번호를 넣었다면 링크를 공유할 상대를 확인하세요.",
  },
  {
    q: "술 안 마신 사람은 어떻게 계산되나요?",
    a: "차수별로 술값을 따로 입력하고 마신 사람을 체크하면, 음식값은 참석자 전원이, 술값은 마신 사람끼리만 나눕니다.",
  },
  {
    q: "나누어떨어지지 않는 금액은 어떻게 하나요?",
    a: "원 단위 자투리는 그 차수를 결제한 사람이 부담하도록 계산해 전체 합계가 정확히 맞습니다. 송금액을 100원 단위로 올려 표시하는 옵션도 있습니다.",
  },
  {
    q: "송금도 여기서 할 수 있나요?",
    a: "송금은 각자 쓰는 은행·간편송금 앱에서 합니다. 받을 계좌나 송금 링크를 적어 두면 정산 안내 메시지에 함께 들어갑니다.",
  },
];

export const metadata: Metadata = {
  title: "모임 정산 계산기 (차수별 N빵)",
  description:
    "1차·2차·3차 참석 여부와 술값까지 나눠 계산하는 모임 정산 계산기. 송금 횟수를 최소로 줄이고, 정산 안내와 미입금 재촉 메시지를 링크 하나로 공유합니다.",
  alternates: { canonical: "/moim" },
};

export default function MoimPage() {
  return (
    <article className="w page">
      <h1>모임 정산 계산기</h1>
      <p className="lead">
        1차는 다 같이, 2차는 일부만, 술은 마신 사람끼리. 차수별로 누가 참석했고 누가 결제했는지만 넣으면 각자 보낼 돈을 계산하고 송금 횟수를 최소로 줄여 줍니다. 가입 없이 링크로 공유하세요.
      </p>
      <MoimSettlement />

      <section>
        <h2>계산 방식</h2>
        <p>
          차수마다 결제 금액에서 술값을 뺀 금액을 그 차수 참석자 수로 나누고, 술값은 그 차수에서 마신 사람 수로만 나눕니다. 이렇게 구한 차수별 부담액을 사람별로 더한 뒤, 실제로 결제한 금액을 빼면 각자 받을 돈과 낼 돈이 나옵니다.
        </p>
        <p>
          송금 목록은 낼 돈이 가장 큰 사람과 받을 돈이 가장 큰 사람을 차례로 짝지어 만듭니다. 그래서 결제한 사람이 여럿이어도 송금 건수가 참여자 수보다 적게 나옵니다.
        </p>
      </section>
      <section>
        <h2>총무가 할 일은 세 가지</h2>
        <p>
          참여자 이름을 넣고, 차수별 장소·금액·결제자와 참석자를 체크한 뒤, &apos;정산 안내 복사&apos;로 단톡방에 올리면 끝입니다. 며칠 뒤 아직 안 보낸 사람이 있다면 &apos;미입금 재촉 메시지 복사&apos;를 눌러 정중한 안내 문구를 그대로 보내세요.
        </p>
      </section>

      <section>
        <h2>자주 묻는 질문</h2>
        {faq.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      <p className="note">
        단순히 금액을 인원수로 나누기만 하면 된다면 <Link href="/tools/percent">퍼센트 계산기</Link>나 계산기 앱으로도 충분합니다. 이 계산기는 차수와 술값이 섞인 모임을 위해 만들었습니다.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }),
        }}
      />
    </article>
  );
}
