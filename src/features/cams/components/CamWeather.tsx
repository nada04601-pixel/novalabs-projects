"use client";
// 현재 날씨. Open-Meteo는 키 없이 쓸 수 있어 브라우저에서 바로 받습니다(세계 어디나 같은 방식).
import { useEffect, useState } from "react";
import { weatherLabel } from "../lib/cams";
import s from "../cams.module.css";

type Now = { temperature_2m: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number; time: string };

export default function CamWeather({ lat, lng }: { lat: number; lng: number }) {
  const [now, setNow] = useState<Now | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&wind_speed_unit=ms&timezone=Asia%2FSeoul";
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setNow(d.current))
      .catch(() => !ctrl.signal.aborted && setFailed(true));
    return () => ctrl.abort();
  }, [lat, lng]);

  return (
    <section className={s.panel}>
      <h2>현재 날씨</h2>
      {now ? (
        <dl>
          <dt>날씨</dt><dd>{weatherLabel(now.weather_code)}</dd>
          <dt>기온</dt><dd>{now.temperature_2m.toFixed(1)}℃</dd>
          <dt>습도</dt><dd>{now.relative_humidity_2m}%</dd>
          <dt>바람</dt><dd>{now.wind_speed_10m.toFixed(1)}m/s</dd>
          <dt>기준</dt><dd>{now.time.slice(11, 16)}</dd>
        </dl>
      ) : (
        <p>{failed ? "날씨 정보를 불러오지 못했습니다." : "불러오는 중…"}</p>
      )}
    </section>
  );
}
