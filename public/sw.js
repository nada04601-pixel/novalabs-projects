// 노바랩 공작소 서비스 워커
// - 페이지(HTML)는 항상 네트워크에서 먼저 받아 최신 내용을 보여주고, 인터넷이 끊겼을 때만 저장본이나 오프라인 안내를 띄웁니다.
// - 파일 이름에 해시가 붙은 빌드 파일(/_next/static)은 바뀌지 않으므로 저장본을 바로 씁니다.
// - 다른 사이트(광고, 분석 등)로 가는 요청은 건드리지 않습니다.
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const OFFLINE_ICON = "/icons/icon-192.png";
const MAX_PAGES = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES);
      const res = await fetch(OFFLINE_URL, { cache: "reload" });
      // 서버가 주소를 바꿔(리디렉션) 응답해도 오프라인 화면으로 쓸 수 있게 새 응답으로 감쌉니다.
      await cache.put(OFFLINE_URL, new Response(await res.blob(), { headers: { "Content-Type": "text/html; charset=utf-8" } }));
      // 오프라인 안내 화면의 로고도 미리 저장해 둡니다.
      await (await caches.open(STATIC)).add(OFFLINE_ICON).catch(() => {});
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, STATIC];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const req of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) {
    if (!req.url.endsWith(OFFLINE_URL)) await cache.delete(req);
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && !res.redirected) {
            const cache = await caches.open(PAGES);
            await cache.put(url.pathname, res.clone());
            trim(cache);
          }
          return res;
        } catch {
          const cache = await caches.open(PAGES);
          return (await cache.match(url.pathname)) || (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
  }
});
