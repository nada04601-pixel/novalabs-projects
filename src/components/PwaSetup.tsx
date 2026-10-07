"use client";
import { useEffect } from "react";

// 앱 설치와 오프라인 안내에 필요한 서비스 워커를 등록합니다(배포 빌드에서만).
export default function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
