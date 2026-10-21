import Link from "next/link";
import type { Cam } from "../types";
import { camHref, categoryOf, hasSource, thumbnailUrl } from "../lib/cams";
import s from "../cams.module.css";

export default function CamCard({ cam, on, onHover }: { cam: Cam; on?: boolean; onHover?: (cam: Cam | null) => void }) {
  const thumb = thumbnailUrl(cam);
  return (
    <Link
      href={camHref(cam)}
      className={on ? `${s.card} ${s.on}` : s.card}
      onMouseEnter={onHover && (() => onHover(cam))}
      onMouseLeave={onHover && (() => onHover(null))}
    >
      <div className={s.thumb}>
        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span aria-hidden>{categoryOf(cam.category).emoji}</span>}
        {hasSource(cam) && cam.isLive ? <span className={s.live}>● LIVE</span> : !hasSource(cam) && <span className={s.wait}>영상 준비 중</span>}
      </div>
      <div className={s.body}>
        <h3>{cam.name}</h3>
        <p>{cam.region} · {categoryOf(cam.category).label}</p>
      </div>
    </Link>
  );
}
