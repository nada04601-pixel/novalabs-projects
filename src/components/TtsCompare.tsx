"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_TEXT, PROVIDERS, TONES, estimateSeconds, parseVoices, type Provider, type Tone, type Voice } from "@/lib/tts";

const SAMPLE = "아직도 손으로 거품 내세요? 손만 갖다 대면 쫀쫀한 거품이 3초 만에 나와요. 아이들도 손 씻기를 놀이처럼 좋아하고요. 오늘만 39,900원, 지금 바로 고정 댓글 확인하세요!";
const PW_KEY = "nl-tts-pw";

interface Result { url: string; ms: number; size: number }
interface Slot {
  on: boolean;
  voice: string;
  model: string;
  voices: Voice[];
  loading: boolean;
  busy: boolean;
  error: string;
  result: Result | null;
}

const initSlots = (): Record<Provider, Slot> =>
  Object.fromEntries(
    PROVIDERS.map((p) => [p.id, { on: true, voice: "", model: p.models[0].id, voices: p.id === "openai" ? parseVoices("openai", null) : [], loading: false, busy: false, error: "", result: null }]),
  ) as Record<Provider, Slot>;

const errorText = async (res: Response) => {
  const d = await res.json().catch(() => null);
  return typeof d?.error === "string" ? d.error : `요청 실패 (${res.status})`;
};

export default function TtsCompare() {
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(false);
  const [ready, setReady] = useState<Record<Provider, boolean> | null>(null);
  const [connectError, setConnectError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [text, setText] = useState(SAMPLE);
  const [tone, setTone] = useState<Tone>("host");
  const [speed, setSpeed] = useState(1.15);
  const [slots, setSlots] = useState(initSlots);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PW_KEY);
      if (saved) { setPw(saved); setRemember(true); }
    } catch {}
    return () => urls.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const patch = (p: Provider, s: Partial<Slot>) => setSlots((prev) => ({ ...prev, [p]: { ...prev[p], ...s } }));
  const headers = { "X-Tts-Password": pw };

  const loadVoices = async (p: Provider) => {
    patch(p, { loading: true, error: "" });
    try {
      const res = await fetch(`/api/tts/voices?provider=${p}`, { headers });
      if (!res.ok) throw new Error(await errorText(res));
      const { voices } = (await res.json()) as { voices: Voice[] };
      setSlots((prev) => ({ ...prev, [p]: { ...prev[p], loading: false, voices, voice: prev[p].voice || voices[0]?.id || "" } }));
    } catch (e) {
      patch(p, { loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  };

  const connect = async () => {
    setConnecting(true);
    setConnectError("");
    try {
      const res = await fetch("/api/tts/status", { headers });
      if (!res.ok) throw new Error(res.status === 404 ? "API가 없습니다. 배포된 사이트(또는 wrangler dev)에서 열어 주세요." : await errorText(res));
      const { providers } = (await res.json()) as { providers: Record<Provider, boolean> };
      setReady(providers);
      try { remember ? localStorage.setItem(PW_KEY, pw) : localStorage.removeItem(PW_KEY); } catch {}
      setSlots((prev) => {
        const next = { ...prev };
        for (const p of PROVIDERS) next[p.id] = { ...next[p.id], on: providers[p.id], voice: next[p.id].voice || (p.id === "openai" ? "marin" : "") };
        return next;
      });
      for (const p of PROVIDERS) if (providers[p.id] && p.id !== "openai") loadVoices(p.id);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  };

  const speak = async (p: Provider) => {
    const s = slots[p];
    // 고른 목소리가 말투의 감정을 지원하지 않으면(목록에 감정 정보가 있을 때만) normal로 바꿉니다.
    const want = TONES.find((t) => t.id === tone)!.typecast.preset;
    const emotions = s.voices.find((v) => v.id === s.voice)?.emotions;
    const emotion = p === "typecast" && emotions && !emotions.includes(want) ? "normal" : undefined;
    patch(p, { busy: true, error: "" });
    const started = performance.now();
    try {
      const res = await fetch("/api/tts/speak", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p, text, voice: s.voice, model: s.model, tone, speed, emotion }),
      });
      if (!res.ok) throw new Error(await errorText(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      setSlots((prev) => {
        if (prev[p].result) URL.revokeObjectURL(prev[p].result!.url);
        return { ...prev, [p]: { ...prev[p], busy: false, result: { url, ms: performance.now() - started, size: blob.size } } };
      });
    } catch (e) {
      patch(p, { busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  };

  const active = PROVIDERS.filter((p) => ready?.[p.id] && slots[p.id].on);
  const secs = estimateSeconds(text, speed);
  const anyBusy = PROVIDERS.some((p) => slots[p.id].busy);

  if (!ready) {
    return (
      <div className="calc">
        <form onSubmit={(e) => { e.preventDefault(); connect(); }}>
          <div className="fields">
            <label>비밀번호
              <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
          </div>
          <label className="inline" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> 이 브라우저에 기억하기
          </label>
          <div className="actions">
            <button type="submit" className="btn sm" disabled={!pw || connecting}>{connecting ? "확인 중…" : "연결하기"}</button>
          </div>
        </form>
        {connectError && <div className="result"><p className="warn">{connectError}</p></div>}
      </div>
    );
  }

  return (
    <div className="calc">
      <label>대본
        <textarea rows={6} value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} />
      </label>
      <p className="note-sm">
        {text.length.toLocaleString("ko-KR")} / {MAX_TEXT.toLocaleString("ko-KR")}자 · 예상 길이 약 {Math.round(secs)}초
        {secs > 60 && " (쇼츠 60초를 넘을 수 있어요)"}
      </p>

      <h3 className="sub">말투</h3>
      <div className="seg" role="group" aria-label="말투">
        {TONES.map((t) => (
          <button key={t.id} type="button" aria-pressed={tone === t.id} onClick={() => setTone(t.id)}>{t.label}</button>
        ))}
      </div>

      <h3 className="sub">속도 {speed.toFixed(2)}배</h3>
      <input type="range" min={0.8} max={1.5} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} style={{ width: "100%" }} aria-label="속도" />
      <p className="note-sm">쇼츠는 1.1~1.3배가 자연스러운 편입니다. ElevenLabs는 1.2배까지만 적용됩니다.</p>

      <h3 className="sub">서비스</h3>
      <div className="checks">
        {PROVIDERS.map((p) => (
          <label key={p.id} className="inline">
            <input type="checkbox" disabled={!ready[p.id]} checked={ready[p.id] && slots[p.id].on} onChange={(e) => patch(p.id, { on: e.target.checked })} />
            {p.name}{!ready[p.id] && ` (${p.secret} 없음)`}
          </label>
        ))}
      </div>

      <div className="actions">
        <button type="button" className="btn sm" disabled={!text.trim() || anyBusy || !active.length} onClick={() => active.forEach((p) => speak(p.id))}>
          {anyBusy ? "만드는 중…" : `${active.length}곳 모두 만들기`}
        </button>
      </div>

      {active.map((p) => {
        const s = slots[p.id];
        const voice = s.voices.find((v) => v.id === s.voice);
        return (
          <section key={p.id} className="result">
            <h3>{p.name}</h3>
            <div className="fields">
              {p.models.length > 1 && (
                <label>모델
                  <select value={s.model} onChange={(e) => patch(p.id, { model: e.target.value })}>
                    {p.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </label>
              )}
              <label>목소리{s.loading && " (불러오는 중…)"}
                {s.voices.length ? (
                  <select value={s.voice} onChange={(e) => patch(p.id, { voice: e.target.value })}>
                    {s.voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.detail && ` · ${v.detail}`}</option>)}
                  </select>
                ) : (
                  <input value={s.voice} placeholder="목소리 ID" onChange={(e) => patch(p.id, { voice: e.target.value.trim() })} />
                )}
              </label>
            </div>
            {voice?.emotions && p.id === "typecast" && !voice.emotions.includes(TONES.find((t) => t.id === tone)!.typecast.preset) && (
              <p className="note-sm">이 목소리는 고른 말투의 감정을 지원하지 않아 기본(normal)으로 읽습니다.</p>
            )}
            <div className="actions">
              <button type="button" className="btn sm ghost" disabled={!text.trim() || !s.voice || s.busy} onClick={() => speak(p.id)}>
                {s.busy ? "만드는 중…" : s.result ? "다시 만들기" : "만들기"}
              </button>
              {!s.voices.length && p.id !== "openai" && !s.loading && (
                <button type="button" className="btn sm ghost" onClick={() => loadVoices(p.id)}>목소리 목록 다시 불러오기</button>
              )}
            </div>
            {s.error && <p className="warn" style={{ marginTop: 12 }}>{s.error}</p>}
            {s.result && (
              <div style={{ marginTop: 12 }}>
                <audio className="wm-audio" src={s.result.url} controls />
                <div className="actions">
                  <a className="btn sm" href={s.result.url} download={`tts-${p.id}-${s.voice}.mp3`}>MP3 내려받기 ({Math.round(s.result.size / 1024)}KB)</a>
                </div>
                <p className="note-sm">만드는 데 {(s.result.ms / 1000).toFixed(1)}초</p>
              </div>
            )}
          </section>
        );
      })}

      <p className="note">대본은 고른 서비스로 보내져 음성으로 바뀌며, 서비스마다 사용량만큼 요금이 나갑니다. API 키는 서버(Worker)에만 있고 이 브라우저로는 내려오지 않습니다.</p>
    </div>
  );
}
