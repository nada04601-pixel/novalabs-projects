import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getToolEn, toolsEn } from "@/data/tools.en";
import { site } from "@/data/site";
import ToolSidebar from "@/components/ToolSidebar";
import Breadcrumbs from "@/components/Breadcrumbs";
import ShareButtons from "@/components/ShareButtons";
import PdfCompressor from "@/components/PdfCompressor";
import PdfMerger from "@/components/PdfMerger";
import PdfSplitter from "@/components/PdfSplitter";
import PdfOrganizer from "@/components/PdfOrganizer";
import ImageToPdf from "@/components/ImageToPdf";
import PdfToImage from "@/components/PdfToImage";
import ImageUpscaler from "@/components/ImageUpscaler";
import ImageConverter from "@/components/ImageConverter";
import WatermarkRemover from "@/components/WatermarkRemover";
import VideoTrimmer from "@/components/VideoTrimmer";
import VideoCompressor from "@/components/VideoCompressor";
import VideoToGif from "@/components/VideoToGif";
import AudioExtractor from "@/components/AudioExtractor";
import SubtitleExtractor from "@/components/SubtitleExtractor";
import SubtitleRemover from "@/components/SubtitleRemover";
import PasswordGenerator from "@/components/PasswordGenerator";
import QrCodeGenerator from "@/components/QrCodeGenerator";
import MbtiTest from "@/components/MbtiTest";
import SajuCalculator from "@/components/SajuCalculator";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return toolsEn.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = getToolEn((await params).slug);
  if (!tool) return {};
  return {
    title: { absolute: `${tool.title} - Free Online | ${site.nameEn}` },
    description: tool.metaDescription,
    alternates: {
      canonical: `/en/tools/${tool.slug}`,
      languages: { ko: `/tools/${tool.slug}`, en: `/en/tools/${tool.slug}`, "x-default": `/tools/${tool.slug}` },
    },
    openGraph: { siteName: site.nameEn, locale: "en_US", type: "website", title: tool.title, description: tool.short, url: `/en/tools/${tool.slug}` },
  };
}

// 영어 버전 도구. 화면 문구는 각 컴포넌트가 경로(/en)를 보고 영어로 바꿉니다.
const components: Record<string, React.ReactNode> = {
  "pdf-compress": <PdfCompressor />,
  "pdf-merge": <PdfMerger />,
  "pdf-split": <PdfSplitter />,
  "pdf-organize": <PdfOrganizer />,
  "jpg-to-pdf": <ImageToPdf />,
  "pdf-to-jpg": <PdfToImage />,
  "image-compress": <ImageConverter />,
  "image-upscaler": <ImageUpscaler />,
  "watermark-remover": <WatermarkRemover />,
  "video-trim": <VideoTrimmer />,
  "video-compress": <VideoCompressor />,
  "video-to-gif": <VideoToGif />,
  "video-to-mp3": <AudioExtractor />,
  "video-subtitle": <SubtitleExtractor />,
  "video-subtitle-remove": <SubtitleRemover />,
  "password-generator": <PasswordGenerator />,
  "qr-code": <QrCodeGenerator />,
  mbti: <MbtiTest />,
  saju: <SajuCalculator />,
};

export default async function EnToolPage({ params }: Props) {
  const tool = getToolEn((await params).slug);
  if (!tool) notFound();

  return (
    <div className="w wide page with-side" lang="en">
      <ToolSidebar current={`/en/tools/${tool.slug}`} lang="en" />
      <article>
        <Breadcrumbs lang="en" items={[{ label: "Tools", href: "/en" }, { label: tool.category, href: "/en" }, { label: tool.title }]} />
        <span className="badge">{tool.category}</span>
        <h1>{tool.title}</h1>
        <p className="lead">{tool.intro}</p>
        {components[tool.slug]}

        {tool.howTo.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            <p>{s.body}</p>
          </section>
        ))}

        <section>
          <h2>FAQ</h2>
          {tool.faq.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        <ShareButtons title={tool.title} path={`/en/tools/${tool.slug}`} />
        <p className="note">{tool.note ?? "Everything runs inside your browser. Files and text you use with this tool are never uploaded or stored on a server."}</p>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              inLanguage: "en",
              mainEntity: tool.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            }),
          }}
        />
      </article>
    </div>
  );
}
