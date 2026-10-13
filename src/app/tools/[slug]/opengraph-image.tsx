import { getTool, tools } from "@/data/tools";
import { ogContentType, ogImage, ogSize } from "@/lib/og";

export const dynamic = "force-static";
export const alt = "도구 미리보기";
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const tool = getTool((await params).slug)!;
  return ogImage({ label: tool.category, title: tool.title, description: tool.short });
}
