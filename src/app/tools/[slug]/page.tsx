import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTool, tools } from "@/data/tools";
import { RATES } from "@/data/rates/2026";
import Link from "next/link";
import { guidesForTool } from "@/data/guides";
import ToolSidebar from "@/components/ToolSidebar";
import Breadcrumbs from "@/components/Breadcrumbs";
import NetSalaryCalculator from "@/components/NetSalaryCalculator";
import SeveranceCalculator from "@/components/SeveranceCalculator";
import LoanCalculator from "@/components/LoanCalculator";
import SavingsCalculator from "@/components/SavingsCalculator";
import WeeklyHolidayPayCalculator from "@/components/WeeklyHolidayPayCalculator";
import BrokerageCalculator from "@/components/BrokerageCalculator";
import AnnualLeaveCalculator from "@/components/AnnualLeaveCalculator";
import OvertimePayCalculator from "@/components/OvertimePayCalculator";
import RentConversionCalculator from "@/components/RentConversionCalculator";
import RentTaxCreditCalculator from "@/components/RentTaxCreditCalculator";
import AgeCalculator from "@/components/AgeCalculator";
import PercentCalculator from "@/components/PercentCalculator";
import VatCalculator from "@/components/VatCalculator";
import WageConverterCalculator from "@/components/WageConverterCalculator";
import UnemploymentCalculator from "@/components/UnemploymentCalculator";
import SavingsGoalCalculator from "@/components/SavingsGoalCalculator";
import AreaConverterCalculator from "@/components/AreaConverterCalculator";
import DateCalculator from "@/components/DateCalculator";
import GpaCalculator from "@/components/GpaCalculator";
import TargetScoreCalculator from "@/components/TargetScoreCalculator";
import GraduationCalculator from "@/components/GraduationCalculator";
import AttendanceCalculator from "@/components/AttendanceCalculator";
import FreePeriodCalculator from "@/components/FreePeriodCalculator";
import MeetingAgendaCalculator from "@/components/MeetingAgendaCalculator";
import TaskTimeCalculator from "@/components/TaskTimeCalculator";
import PomodoroCalculator from "@/components/PomodoroCalculator";
import DeadlinePlannerCalculator from "@/components/DeadlinePlannerCalculator";
import WeeklyGoalCalculator from "@/components/WeeklyGoalCalculator";
import PdfCompressor from "@/components/PdfCompressor";
import PdfMerger from "@/components/PdfMerger";
import PdfSplitter from "@/components/PdfSplitter";
import PdfOrganizer from "@/components/PdfOrganizer";
import TypingTest from "@/components/TypingTest";
import PasswordGenerator from "@/components/PasswordGenerator";
import QrCodeGenerator from "@/components/QrCodeGenerator";
import CharacterCounter from "@/components/CharacterCounter";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = getTool((await params).slug);
  if (!tool) return {};
  return {
    title: tool.title,
    description: tool.metaDescription,
    alternates: { canonical: `/tools/${tool.slug}` },
  };
}

// 새 도구를 추가하면 여기에 슬러그와 컴포넌트를 연결하세요.
const calculators: Record<string, React.ReactNode> = {
  "net-salary": <NetSalaryCalculator />,
  "severance-pay": <SeveranceCalculator />,
  "loan-interest": <LoanCalculator />,
  "savings-interest": <SavingsCalculator />,
  "weekly-holiday-pay": <WeeklyHolidayPayCalculator />,
  "brokerage-fee": <BrokerageCalculator />,
  "annual-leave": <AnnualLeaveCalculator />,
  "overtime-pay": <OvertimePayCalculator />,
  "rent-conversion": <RentConversionCalculator />,
  "rent-tax-credit": <RentTaxCreditCalculator />,
  "korean-age": <AgeCalculator />,
  percent: <PercentCalculator />,
  vat: <VatCalculator />,
  "wage-converter": <WageConverterCalculator />,
  "unemployment-benefit": <UnemploymentCalculator />,
  "savings-goal": <SavingsGoalCalculator />,
  "pyeong-converter": <AreaConverterCalculator />,
  "date-calculator": <DateCalculator />,
  gpa: <GpaCalculator />,
  "target-score": <TargetScoreCalculator />,
  "graduation-credits": <GraduationCalculator />,
  attendance: <AttendanceCalculator />,
  "free-period": <FreePeriodCalculator />,
  "meeting-agenda": <MeetingAgendaCalculator />,
  "task-time": <TaskTimeCalculator />,
  pomodoro: <PomodoroCalculator />,
  "deadline-planner": <DeadlinePlannerCalculator />,
  "weekly-goal": <WeeklyGoalCalculator />,
  "pdf-compress": <PdfCompressor />,
  "pdf-merge": <PdfMerger />,
  "pdf-split": <PdfSplitter />,
  "pdf-organize": <PdfOrganizer />,
  "typing-test": <TypingTest />,
  "password-generator": <PasswordGenerator />,
  "qr-code": <QrCodeGenerator />,
  "character-counter": <CharacterCounter />,
};

export default async function ToolPage({ params }: Props) {
  const tool = getTool((await params).slug);
  if (!tool) notFound();
  const related = guidesForTool(tool.slug);

  return (
    <div className="w wide page with-side">
      <ToolSidebar current={`/tools/${tool.slug}`} />
      <article>
      <Breadcrumbs items={[{ label: "계산기", href: "/tools" }, { label: tool.category, href: "/tools" }, { label: tool.title }]} />
      <span className="badge">{tool.category}</span>
      <h1>{tool.title}</h1>
      <p className="lead">{tool.intro}</p>
      {calculators[tool.slug]}

      {tool.howTo.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          <p>{s.body}</p>
        </section>
      ))}

      <section>
        <h2>자주 묻는 질문</h2>
        {tool.faq.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      {related.length > 0 && (
        <aside className="related">
          <h2>관련 가이드</h2>
          <ul>
            {related.map((g) => <li key={g.slug}><Link href={`/guides/${g.slug}`}>{g.title}</Link></li>)}
          </ul>
        </aside>
      )}

      {tool.category === "디지털 도구" ? (
        <p className="note">모든 처리는 이 브라우저 안에서 이루어지며, 입력한 내용과 파일은 서버로 전송하거나 저장하지 않습니다.</p>
      ) : (
        <p className="note">
          적용 기준: {RATES.year}년 요율(확인 {RATES.checkedAt}). 참고용 추정치이며 실제 금액은 회사, 금융회사, 관계 기관의 안내를 따릅니다.
        </p>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: tool.faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
      </article>
    </div>
  );
}
