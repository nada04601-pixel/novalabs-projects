"use client";
import { useEffect, useState } from "react";
import { site } from "@/data/site";
import { useT } from "@/lib/useT";

// 페이지 공유 버튼. 휴대폰처럼 공유 창(navigator.share)을 지원하면 "공유하기"로 카카오톡 등 설치된 앱을 고를 수 있고,
// 어디서든 "링크 복사"로 주소를 복사할 수 있습니다.
export default function ShareButtons({ title, path }: { title: string; path: string }) {
  const t = useT();
  const url = `${site.url}${path}`;
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  // 서버에서 만든 HTML과 어긋나지 않도록 화면이 뜬 뒤에 확인합니다.
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt(t("아래 주소를 복사하세요", "Copy the link below"), url);
    }
  };

  return (
    <div className="share">
      <span>{t("도움이 되었다면 공유해 주세요", "Found it useful? Share it")}</span>
      <div className="actions">
        {canShare && (
          <button
            type="button"
            className="btn sm"
            onClick={() => navigator.share({ title: `${title} | ${t.lang === "en" ? site.nameEn : site.name}`, url }).catch(() => {})}
          >
            {t("공유하기", "Share")}
          </button>
        )}
        <button type="button" className="btn sm ghost" onClick={copy}>
          {copied ? t("복사했어요", "Copied") : t("링크 복사", "Copy link")}
        </button>
      </div>
    </div>
  );
}
