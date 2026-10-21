"use client";
// Leaflet + OpenStreetMap 지도. 앱 키가 필요 없어 도메인을 옮겨도 다시 설정할 것이 없고, 해외 지역도 그대로 그립니다.
// Leaflet은 불러오는 순간 window를 쓰므로 화면에서만 동적으로 불러옵니다.
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { Cam, CamCategory } from "../types";
import s from "../cams.module.css";

export const CATEGORY_COLOR: Record<CamCategory, string> = { beaches: "#0284c7", mountains: "#16a34a", city: "#9333ea", traffic: "#ea580c" };

type Props = {
  cams: Cam[];
  selectedId?: string;
  onSelect?: (cam: Cam) => void;
  zoom?: number; // 지정하면 첫 번째 장소를 가운데에 두고, 없으면 모든 장소가 들어오게 맞춥니다.
};

export default function CamMap({ cams, selectedId, onSelect, zoom }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    let off = false;
    import("leaflet").then((mod) => {
      if (off || !box.current) return;
      L.current = mod;
      map.current = mod.map(box.current, { scrollWheelZoom: false }).setView([36.3, 127.8], 7);
      mod.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      layer.current = mod.layerGroup().addTo(map.current);
      // 지도 파일을 받는 사이에 목록이 바뀌었을 수 있어 최신 함수로 그립니다.
      latest.current.draw();
      latest.current.fit();
    });
    return () => {
      off = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  function draw() {
    const mod = L.current, m = map.current, g = layer.current;
    if (!mod || !m || !g) return;
    g.clearLayers();
    for (const c of cams) {
      const on = c.id === selectedId;
      mod.circleMarker([c.lat, c.lng], {
        radius: on ? 11 : 8,
        color: "#fff",
        weight: 2,
        fillColor: CATEGORY_COLOR[c.category],
        fillOpacity: on ? 1 : 0.85,
      })
        .bindTooltip(c.name, { className: s.tip, direction: "top", offset: [0, -6], permanent: on })
        .on("click", () => select.current?.(c))
        .addTo(g);
    }
  }

  function fit() {
    const mod = L.current, m = map.current;
    if (!mod || !m) return;
    if (zoom && cams[0]) m.setView([cams[0].lat, cams[0].lng], zoom);
    else if (cams.length) m.fitBounds(mod.latLngBounds(cams.map((c) => [c.lat, c.lng])), { padding: [30, 30], maxZoom: 12 });
  }

  const latest = useRef({ draw, fit });
  latest.current = { draw, fit };

  // 목록이 바뀌거나(분류·검색) 고른 장소가 바뀌면 표시를 다시 그리고, 보이는 범위는 목록이 바뀔 때만 다시 맞춥니다.
  useEffect(draw, [cams, selectedId]);
  useEffect(fit, [cams, zoom]);

  // 모바일에서 목록↔지도를 바꿔 보이면 크기를 다시 잽니다.
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(() => map.current?.invalidateSize());
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  return <div ref={box} className={s.map} role="region" aria-label="CCTV 위치 지도" />;
}
