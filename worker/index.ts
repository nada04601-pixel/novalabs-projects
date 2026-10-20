// Cloudflare Worker 입구. /api/* 요청만 여기로 오고(wrangler.jsonc의 run_worker_first), 나머지는 out/ 정적 파일을 그대로 내려줍니다.
// /api/tts/*는 음성 합성 비교 페이지(/lab/tts)용입니다. API 키는 Worker 비밀값에 두고, TTS_PASSWORD를 아는 사람만 쓸 수 있습니다.
import { PROVIDERS, parseSpeak, parseVoices, speakRequest, voicesRequest, type Provider } from "../src/lib/tts";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  TTS_PASSWORD?: string;
  OPENAI_API_KEY?: string;
  TYPECAST_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const keyOf = (env: Env, p: Provider) => env[PROVIDERS.find((x) => x.id === p)!.secret as "OPENAI_API_KEY" | "TYPECAST_API_KEY" | "ELEVENLABS_API_KEY"];

// 길이와 상관없이 같은 시간이 걸리도록 해시끼리 비교합니다.
async function samePassword(given: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([given, expected].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))));
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// 서비스 오류 응답에서 사람이 읽을 문구만 꺼냅니다.
async function upstreamError(name: string, res: Response): Promise<Response> {
  const body = (await res.text()).slice(0, 2000);
  let message = body;
  try {
    const d = JSON.parse(body);
    const m = d?.error?.message ?? d?.detail?.message ?? d?.detail ?? d?.message ?? d?.error;
    message = typeof m === "string" ? m : JSON.stringify(m ?? d);
  } catch {}
  return json({ error: `${name} 오류 (${res.status}): ${message.slice(0, 300) || res.statusText}` }, 502);
}

async function tts(request: Request, env: Env, path: string): Promise<Response> {
  if (!env.TTS_PASSWORD) return json({ error: "Worker에 TTS_PASSWORD 비밀값이 설정되지 않았습니다." }, 503);
  if (!(await samePassword(request.headers.get("X-Tts-Password") ?? "", env.TTS_PASSWORD))) return json({ error: "비밀번호가 맞지 않습니다." }, 401);

  if (path === "status" && request.method === "GET") {
    return json({ providers: Object.fromEntries(PROVIDERS.map((p) => [p.id, !!keyOf(env, p.id)])) });
  }

  if (path === "voices" && request.method === "GET") {
    const provider = new URL(request.url).searchParams.get("provider") as Provider;
    const info = PROVIDERS.find((p) => p.id === provider);
    if (!info) return json({ error: "지원하지 않는 서비스입니다." }, 400);
    const key = keyOf(env, provider);
    if (!key) return json({ error: `${info.secret}가 설정되지 않았습니다.` }, 400);
    const req = voicesRequest(provider, key);
    if (!req) return json({ voices: parseVoices(provider, null) });
    const res = await fetch(req.url, req.init);
    if (!res.ok) return upstreamError(info.name, res);
    return json({ voices: parseVoices(provider, await res.json()) });
  }

  if (path === "speak" && request.method === "POST") {
    const r = parseSpeak(await request.json().catch(() => null));
    if (typeof r === "string") return json({ error: r }, 400);
    const info = PROVIDERS.find((p) => p.id === r.provider)!;
    const key = keyOf(env, r.provider);
    if (!key) return json({ error: `${info.secret}가 설정되지 않았습니다.` }, 400);
    const req = speakRequest(r, key);
    const res = await fetch(req.url, req.init);
    if (!res.ok) return upstreamError(info.name, res);
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  }

  return json({ error: "없는 주소입니다." }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/tts/")) {
      try {
        return await tts(request, env, pathname.slice("/api/tts/".length));
      } catch (e) {
        return json({ error: `처리 중 오류가 났습니다: ${e instanceof Error ? e.message : String(e)}` }, 500);
      }
    }
    if (pathname.startsWith("/api/")) return json({ error: "없는 주소입니다." }, 404);
    return env.ASSETS.fetch(request);
  },
};
