import { site } from "@/data/site";
import { ogContentType, ogImage, ogSize } from "@/lib/og";

export const dynamic = "force-static";
export const alt = "NovaLabs";
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image() {
  return ogImage({ label: "Free online tools", title: "PDF, image & video tools that run in your browser", description: site.descriptionEn, lang: "en" });
}
