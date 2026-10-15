"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/useT";

// 입력값을 담은 링크(현재 주소 + #해시)를 공유하는 버튼. 해시는 서버로 보내지지 않습니다.
// 휴대폰처럼 공유 창(navigator.share)을 지원하면 "결과 공유하기"도 보여 줍니다.
export default function ShareLinkButtons({ hash, title, note }: { hash: () => string; title: string; note: string }) {
  const t = useT();
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  // 서버에서 만든 HTML과 어긋나지 않도록 화면이 뜬 뒤에 확인합니다.
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const url = () => `${window.location.origin}${window.location.pathname}#${hash()}`;

  const copy = async () => {
    const u = url();
    try {
      await navigator.clipboard.writeText(u);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt(t("아래 주소를 복사하세요", "Copy this link"), u);
    }
  };

  return (
    <div className="actions">
      {canShare && (
        <button type="button" className="btn sm" onClick={() => navigator.share({ title, url: url() }).catch(() => {})}>
          {t("결과 공유하기", "Share result")}
        </button>
      )}
      <button type="button" className={`btn sm${canShare ? " ghost" : ""}`} onClick={copy}>
        {copied ? t("복사했어요", "Copied") : t("결과 링크 복사", "Copy result link")}
      </button>
      <span className="saju-muted saju-share-note">{note}</span>
    </div>
  );
}
