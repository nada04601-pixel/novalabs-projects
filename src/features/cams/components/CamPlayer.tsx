import type { Cam } from "../types";
import { embedUrl, searchUrl, sourceHref } from "../lib/cams";
import s from "../cams.module.css";

// 유튜브 라이브를 띄우고 아래에 영상 출처를 표시합니다. 아직 영상 소스가 없으면 유튜브에서 찾아볼 수 있는 안내를 보여 줍니다.
export default function CamPlayer({ cam }: { cam: Cam }) {
  const src = embedUrl(cam);
  const href = sourceHref(cam);
  return (
    <>
      <div className={s.player}>
        {src ? (
          <iframe
            src={src}
            title={cam.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className={s.noSource}>
            <strong>영상 연결 준비 중</strong>
            <p>이 장소의 실시간 영상은 아직 연결되지 않았습니다.</p>
            <a className={s.btn} href={searchUrl(cam)} target="_blank" rel="noopener noreferrer">유튜브에서 라이브 찾아보기</a>
          </div>
        )}
      </div>
      {src && href && (
        <p className={s.credit}>
          영상 제공: {cam.sourceName ?? "YouTube"} · <a href={href} target="_blank" rel="noopener noreferrer">YouTube에서 보기</a>
        </p>
      )}
    </>
  );
}
