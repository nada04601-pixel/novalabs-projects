import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { CAMS_BASE, cams, categoryOf, getCam, relatedCams } from "@/features/cams/lib/cams";
import CamPlayer from "@/features/cams/components/CamPlayer";
import CamWeather from "@/features/cams/components/CamWeather";
import CamMap from "@/features/cams/components/CamMap";
import CamCard from "@/features/cams/components/CamCard";
import s from "@/features/cams/cams.module.css";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return cams.map((c) => ({ id: c.id }));
}

const find = async (params: Props["params"]) => getCam((await params).id);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await find(params);
  if (!c) return {};
  return { title: c.title, description: c.description, robots: { index: false, follow: false } };
}

export default async function CamDetailPage({ params }: Props) {
  const cam = await find(params);
  if (!cam) notFound();
  const cat = categoryOf(cam.category);
  return (
    <div className={s.wrap}>
      <Link className={s.back} href={CAMS_BASE}>← 전체 CCTV</Link>
      <span className={s.badge}>{cat.emoji} {cat.label} · {cam.region}</span>
      <h1>{cam.title}</h1>
      <div className={s.detail}>
        <div>
          <CamPlayer cam={cam} />
          <section className={s.panel}>
            <h2>장소 소개</h2>
            <p>{cam.description}</p>
          </section>
        </div>
        <aside>
          <CamWeather lat={cam.lat} lng={cam.lng} />
          <div className={s.miniMap}>
            <CamMap cams={[cam]} selectedId={cam.id} zoom={12} />
          </div>
        </aside>
      </div>
      <h2>함께 보면 좋은 라이브</h2>
      <div className={s.grid}>
        {relatedCams(cam).map((c) => <CamCard key={c.id} cam={c} />)}
      </div>
    </div>
  );
}
