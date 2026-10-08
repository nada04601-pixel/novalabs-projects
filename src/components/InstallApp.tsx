"use client";
import { useEffect, useState } from "react";

// 크롬·엣지·삼성 인터넷이 주는 설치 이벤트(표준 타입에는 아직 없음)
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

type Mode = "hidden" | "prompt" | "ios" | "done";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function InstallApp() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [evt, setEvt] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // 이미 앱으로 실행 중이면 안내하지 않습니다.
    if (isIos()) setMode("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault(); // 브라우저 기본 배너 대신 버튼으로 설치를 안내합니다.
      setEvt(e as InstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => {
      (window as Window & { __installPrompt?: Event }).__installPrompt = undefined;
      setEvt(null);
      setMode("done");
    };
    // 화면이 준비되기 전에 온 설치 이벤트는 layout의 스크립트가 받아 둡니다.
    const early = (window as Window & { __installPrompt?: Event }).__installPrompt;
    if (early) onPrompt(early);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;
  if (mode === "done") return <p className="install">앱으로 설치했어요. 앱 목록에서 노바랩 공작소를 찾아 실행하세요.</p>;

  if (mode === "ios") {
    return (
      <div className="install">
        <button type="button" className="install-btn" aria-expanded={showIosHelp} onClick={() => setShowIosHelp((v) => !v)}>
          아이폰 홈 화면에 추가하기
        </button>
        {showIosHelp && (
          <p>
            Safari 아래쪽의 <b>공유 버튼(□↑)</b>을 누르고 <b>홈 화면에 추가</b>를 고르세요. 앱처럼 주소창 없이 열립니다.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="install">
      <button
        type="button"
        className="install-btn"
        onClick={async () => {
          if (!evt) return;
          await evt.prompt();
          const { outcome } = await evt.userChoice;
          setEvt(null); // 설치 창은 한 번만 띄울 수 있습니다.
          (window as Window & { __installPrompt?: Event }).__installPrompt = undefined;
          setMode(outcome === "accepted" ? "done" : "hidden");
        }}
      >
        앱으로 설치하기
      </button>
      <span>설치하면 앱 목록에 나타나고 주소창 없이 열립니다.</span>
    </div>
  );
}
