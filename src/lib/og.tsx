import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/data/site";

// 카카오톡·SNS에 링크를 붙였을 때 보이는 공유 미리보기 이미지(1200×630)를 빌드 때 만듭니다.
// 글꼴은 사이트와 같은 Pretendard(SIL OFL 1.1)이고, 빌드에만 쓰여 방문자에게 내려가지 않습니다.
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

const fontDir = join(process.cwd(), "node_modules/pretendard/dist/public/static");
let fonts: Promise<{ name: string; data: Buffer; weight: 600 | 800; style: "normal" }[]> | undefined;
const loadFonts = () =>
  (fonts ??= Promise.all([
    readFile(join(fontDir, "Pretendard-SemiBold.otf")).then((data) => ({ name: "Pretendard", data, weight: 600 as const, style: "normal" as const })),
    readFile(join(fontDir, "Pretendard-ExtraBold.otf")).then((data) => ({ name: "Pretendard", data, weight: 800 as const, style: "normal" as const })),
  ]));

// src/app/icon.svg와 같은 로고
const logo = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b3aa6"/><stop offset="1" stop-color="#2b2a86"/></linearGradient><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4b5fd"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><circle cx="20" cy="21" r="17.5" fill="url(#g)"/><g stroke="#fff" stroke-width="2.3" stroke-linecap="round" fill="none"><path d="M10.5 15.5h6M13.5 12.5v6"/><path d="M21.5 15.5h6"/><path d="M11 24.5l5 5M16 24.5l-5 5"/></g><g fill="#fff"><circle cx="24.5" cy="12.3" r="1.25"/><circle cx="24.5" cy="18.7" r="1.25"/></g><path d="M23.2 22.3h5.6M24.4 22.3v3.2l-3.1 5.3a1.3 1.3 0 0 0 1.1 2h7.2a1.3 1.3 0 0 0 1.1-2l-3.1-5.3v-3.2" fill="none" stroke="url(#f)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M22.6 29.4h7.6l1.1 1.9a1 1 0 0 1-.9 1.5h-8a1 1 0 0 1-.9-1.5Z" fill="url(#f)"/><path d="M34.5 1.6c.4 2.5.9 3 3.4 3.4-2.5.4-3 .9-3.4 3.4-.4-2.5-.9-3-3.4-3.4 2.5-.4 3-.9 3.4-3.4Z" fill="#a78bfa"/></svg>`,
).toString("base64")}`;

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export async function ogImage({ label, title, description, lang = "ko" }: { label: string; title: string; description: string; lang?: "ko" | "en" }) {
  const titleSize = title.length > 34 ? 54 : title.length > 22 ? 62 : 72;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #1b1a5e 0%, #2b2a86 60%, #4c3fb0 100%)",
          color: "#fff",
          fontFamily: "Pretendard",
          position: "relative",
        }}
      >
        {/* 오른쪽 배경 장식: 사칙연산 기호 */}
        <div style={{ position: "absolute", right: 56, top: 40, display: "flex", fontSize: 220, fontWeight: 800, color: "rgba(255,255,255,0.06)", letterSpacing: 24 }}>
          +÷×
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={64} height={64} alt="" />
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>
            {lang === "en" ? "Nova" : "노바랩"}<span style={{ color: "#c4b5fd", marginLeft: lang === "en" ? 0 : 8 }}>{lang === "en" ? "Labs" : "공작소"}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600, padding: "8px 22px", borderRadius: 999, background: "rgba(196,181,253,0.18)", color: "#ddd6fe" }}>
              {label}
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: titleSize, fontWeight: 800, lineHeight: 1.25, letterSpacing: -1.5, wordBreak: "keep-all" }}>
            {clip(title, 52)}
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 30, fontWeight: 600, lineHeight: 1.45, color: "#c7c9f0", wordBreak: "keep-all" }}>
            {clip(description, 70)}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, fontWeight: 600, color: "#a5a8e0" }}>
          <div style={{ display: "flex" }}>{lang === "en" ? "Free · No sign-up · Runs in your browser" : "무료 · 가입 없이 바로 사용"}</div>
          <div style={{ display: "flex", color: "#fff" }}>{site.domain}</div>
        </div>
      </div>
    ),
    { ...ogSize, fonts: await loadFonts() },
  );
}
