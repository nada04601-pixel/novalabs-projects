"use client";
import { useEffect, useState } from "react";
import { site } from "@/data/site";

type KakaoSdk = {
  isInitialized(): boolean;
  init(key: string): void;
  Share: { sendDefault(options: object): void };
};
declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

const KAKAO_SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";

// 카카오 SDK를 한 번만 불러와 초기화합니다. PC에서는 공유 창이 팝업으로 열려 버튼을 누르기 전에 미리 불러 둡니다.
let kakaoReady: Promise<KakaoSdk> | undefined;
function loadKakao(key: string) {
  kakaoReady ??= new Promise<KakaoSdk>((resolve, reject) => {
    const done = () => {
      const k = window.Kakao;
      if (!k) return reject(new Error("Kakao SDK unavailable"));
      if (!k.isInitialized()) k.init(key);
      resolve(k);
    };
    if (window.Kakao) return done();
    const s = document.createElement("script");
    s.src = KAKAO_SDK;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = done;
    s.onerror = () => {
      kakaoReady = undefined;
      reject(new Error("Kakao SDK load failed"));
    };
    document.head.appendChild(s);
  });
  return kakaoReady;
}

// 페이지 공유 버튼.
// - 카카오톡 공유: site.kakaoJsKey가 있을 때만 보이며, 미리보기 이미지와 "바로 보기" 버튼이 있는 카드로 보냅니다.
// - 공유하기: 휴대폰처럼 공유 창(navigator.share)을 지원하면 설치된 앱을 고를 수 있습니다.
// - 링크 복사: 어디서든 주소를 복사합니다.
export default function ShareButtons({ title, description, path }: { title: string; description: string; path: string }) {
  const url = `${site.url}${path}`;
  const [canShare, setCanShare] = useState(false);
  const [kakao, setKakao] = useState<KakaoSdk | null>(null);
  const [copied, setCopied] = useState(false);
  // 서버에서 만든 HTML과 어긋나지 않도록 화면이 뜬 뒤에 확인합니다.
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
    if (site.kakaoJsKey) loadKakao(site.kakaoJsKey).then(setKakao, () => {});
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("아래 주소를 복사하세요", url);
    }
  };

  const shareKakao = () => {
    const link = { mobileWebUrl: url, webUrl: url };
    kakao?.Share.sendDefault({
      objectType: "feed",
      content: { title, description, imageUrl: `${url}/opengraph-image`, imageWidth: 1200, imageHeight: 630, link },
      buttons: [{ title: "바로 보기", link }],
    });
  };

  return (
    <div className="share">
      <span>도움이 되었다면 공유해 주세요</span>
      <div className="actions">
        {kakao && (
          <button type="button" className="btn sm kakao" onClick={shareKakao}>
            카카오톡 공유
          </button>
        )}
        {canShare && (
          <button
            type="button"
            className="btn sm"
            onClick={() => navigator.share({ title: `${title} | ${site.name}`, url }).catch(() => {})}
          >
            공유하기
          </button>
        )}
        <button type="button" className="btn sm ghost" onClick={copy}>
          {copied ? "복사했어요" : "링크 복사"}
        </button>
      </div>
    </div>
  );
}
