import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DIGITAL_CATEGORIES, getTool, isHiddenTool, tools } from "@/data/tools";
import { RATES } from "@/data/rates/2026";
import { toolExtras } from "@/data/extras";
import { ContentSections, SourceList } from "@/components/ContentSections";
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
import SajuCalculator from "@/components/SajuCalculator";
import SajuMatchCalculator from "@/components/SajuMatchCalculator";
import MbtiTest from "@/components/MbtiTest";
import PercentCalculator from "@/components/PercentCalculator";
import VatCalculator from "@/components/VatCalculator";
import WageConverterCalculator from "@/components/WageConverterCalculator";
import UnemploymentCalculator from "@/components/UnemploymentCalculator";
import SavingsGoalCalculator from "@/components/SavingsGoalCalculator";
import AreaConverterCalculator from "@/components/AreaConverterCalculator";
import DateCalculator from "@/components/DateCalculator";
import BmrCalculator from "@/components/BmrCalculator";
import NameGenerator from "@/components/NameGenerator";
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
import ImageToPdf from "@/components/ImageToPdf";
import PdfToImage from "@/components/PdfToImage";
import WatermarkRemover from "@/components/WatermarkRemover";
import ImageUpscaler from "@/components/ImageUpscaler";
import ImageConverter from "@/components/ImageConverter";
import BackgroundRemover from "@/components/BackgroundRemover";
import VideoTrimmer from "@/components/VideoTrimmer";
import VideoCompressor from "@/components/VideoCompressor";
import VideoToGif from "@/components/VideoToGif";
import AudioExtractor from "@/components/AudioExtractor";
import SubtitleExtractor from "@/components/SubtitleExtractor";
import SubtitleRemover from "@/components/SubtitleRemover";
import TypingTest from "@/components/TypingTest";
import PasswordGenerator from "@/components/PasswordGenerator";
import QrCodeGenerator from "@/components/QrCodeGenerator";
import CharacterCounter from "@/components/CharacterCounter";
import HwpToHtml from "@/components/HwpToHtml";
import LottoSimulatorTool from "@/components/LottoSimulatorTool";
import ShareButtons from "@/components/ShareButtons";

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
    // 영어 페이지가 심사 동안 noindex라 언어별 주소(hreflang)는 알리지 않습니다.
    alternates: { canonical: `/tools/${tool.slug}` },
    // 숨긴 도구는 검색 결과에서 뺍니다.
    ...(isHiddenTool(tool.slug) && { robots: { index: false, follow: true } }),
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
  saju: <SajuCalculator />,
  "saju-match": <SajuMatchCalculator />,
  mbti: <MbtiTest />,
  percent: <PercentCalculator />,
  vat: <VatCalculator />,
  "wage-converter": <WageConverterCalculator />,
  "unemployment-benefit": <UnemploymentCalculator />,
  "savings-goal": <SavingsGoalCalculator />,
  "pyeong-converter": <AreaConverterCalculator />,
  "date-calculator": <DateCalculator />,
  bmr: <BmrCalculator />,
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
  "jpg-to-pdf": <ImageToPdf />,
  "pdf-to-jpg": <PdfToImage />,
  "watermark-remover": <WatermarkRemover />,
  "remove-background": <BackgroundRemover />,
  "image-compress": <ImageConverter />,
  "image-upscaler": <ImageUpscaler />,
  "video-trim": <VideoTrimmer />,
  "video-compress": <VideoCompressor />,
  "video-to-gif": <VideoToGif />,
  "video-to-mp3": <AudioExtractor />,
  "video-subtitle": <SubtitleExtractor />,
  "video-subtitle-remove": <SubtitleRemover />,
  "typing-test": <TypingTest />,
  "password-generator": <PasswordGenerator />,
  "name-generator": <NameGenerator />,
  "qr-code": <QrCodeGenerator />,
  "character-counter": <CharacterCounter />,
  "hwp-to-html": <HwpToHtml />,
  "lotto-simulator": <LottoSimulatorTool />,
};

export default async function ToolPage({ params }: Props) {
  const tool = getTool((await params).slug);
  if (!tool) notFound();
  const related = guidesForTool(tool.slug);
  const extra = toolExtras[tool.slug];

  // 본문(article)을 먼저 두고 왼쪽 메뉴는 뒤에 둡니다. 화면에서는 CSS 격자로 메뉴가 왼쪽에 보입니다.
  return (
    <div className="w wide page with-side">
      <article>
      <Breadcrumbs items={[{ label: "도구함", href: "/tools" }, { label: tool.category, href: "/tools" }, { label: tool.title }]} />
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

      {extra && <ContentSections sections={extra.sections} />}

      <section>
        <h2>자주 묻는 질문</h2>
        {tool.faq.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      {extra && <SourceList sources={extra.sources} checked={extra.updated} />}

      <ShareButtons title={tool.title} path={`/tools/${tool.slug}`} />

      {related.length > 0 && (
        <aside className="related">
          <h2>관련 가이드</h2>
          <ul>
            {related.map((g) => <li key={g.slug}><Link href={`/guides/${g.slug}`}>{g.title}</Link></li>)}
          </ul>
        </aside>
      )}

      {tool.note ? (
        <p className="note">{tool.note}</p>
      ) : DIGITAL_CATEGORIES.includes(tool.category) ? (
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
      <ToolSidebar current={`/tools/${tool.slug}`} />
    </div>
  );
}
