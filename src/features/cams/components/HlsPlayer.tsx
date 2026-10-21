"use client";
// HLS(.m3u8) 실시간 영상. 사파리는 기본 지원하고, 나머지 브라우저는 hls.js를 화면에서만 불러와 재생합니다.
import { useEffect, useRef, useState } from "react";
import s from "../cams.module.css";

export default function HlsPlayer({ src, title }: { src: string; title: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    setFailed(false);
    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
      return () => v.removeAttribute("src");
    }
    let hls: import("hls.js").default | null = null;
    let off = false;
    import("hls.js").then(({ default: Hls }) => {
      if (off) return;
      if (!Hls.isSupported()) return setFailed(true);
      hls = new Hls({ liveDurationInfinity: true });
      // 네트워크·형식 오류처럼 되살릴 수 없는 오류만 안내합니다(잠깐 끊기는 것은 hls.js가 다시 시도).
      hls.on(Hls.Events.ERROR, (_, d) => d.fatal && setFailed(true));
      hls.loadSource(src);
      hls.attachMedia(v);
    });
    return () => {
      off = true;
      hls?.destroy();
    };
  }, [src]);

  return (
    <>
      <video ref={video} title={title} muted autoPlay playsInline controls />
      {failed && (
        <div className={s.noSource}>
          <strong>영상을 불러오지 못했습니다</strong>
          <p>CCTV 점검이나 송출 중단으로 잠시 영상이 나오지 않을 수 있습니다. 잠시 후 다시 시도해 주세요.</p>
        </div>
      )}
    </>
  );
}
