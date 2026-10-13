import { site } from "@/data/site";

export const dynamic = "force-static";

// robots.ts로는 주석 줄을 넣을 수 없어 직접 만듭니다. 다음 웹마스터도구 인증값은 파일 하단에 둡니다.
export function GET() {
  const lines = ["User-Agent: *", "Allow: /", "", `Sitemap: ${site.url}/sitemap.xml`];
  if (site.daumVerification) lines.push("", `#DaumWebMasterTool:${site.daumVerification}`);
  return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
