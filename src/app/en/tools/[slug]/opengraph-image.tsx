import { getToolEn, toolsEn } from "@/data/tools.en";
import { ogContentType, ogImage, ogSize } from "@/lib/og";

export const dynamic = "force-static";
export const alt = "Tool preview";
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return toolsEn.map((t) => ({ slug: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const tool = getToolEn((await params).slug)!;
  return ogImage({ label: tool.category, title: tool.title, description: tool.short, lang: "en" });
}
