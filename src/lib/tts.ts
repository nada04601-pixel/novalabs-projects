// 음성 합성(TTS) 비교 페이지(/lab/tts)와 Worker(worker/index.ts)가 함께 쓰는 서비스별 요청 규칙입니다.
// API 키는 Worker 비밀값에만 두고, 브라우저는 비밀번호로 Worker를 거쳐 요청합니다.

export type Provider = "openai" | "typecast" | "elevenlabs";
export type Tone = "host" | "review" | "premium";

export const PROVIDERS: { id: Provider; name: string; secret: string; models: { id: string; label: string }[] }[] = [
  { id: "openai", name: "OpenAI", secret: "OPENAI_API_KEY", models: [{ id: "gpt-4o-mini-tts", label: "gpt-4o-mini-tts" }] },
  { id: "typecast", name: "타입캐스트", secret: "TYPECAST_API_KEY", models: [{ id: "ssfm-v30", label: "SSFM 3.0" }] },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    secret: "ELEVENLABS_API_KEY",
    models: [
      { id: "eleven_multilingual_v2", label: "Multilingual v2" },
      { id: "eleven_v3", label: "v3 (감정 표현)" },
      { id: "eleven_flash_v2_5", label: "Flash v2.5 (빠름)" },
    ],
  },
];

// OpenAI 기본 목소리. marin·cedar가 가장 자연스럽다고 안내되어 있어 앞에 둡니다.
export const OPENAI_VOICES = ["marin", "cedar", "coral", "nova", "shimmer", "sage", "alloy", "ash", "ballad", "echo", "fable", "onyx", "verse"];

// 쇼핑 쇼츠에서 자주 쓰는 말투. 서비스마다 말투를 정하는 방식이 달라 각각 맞춰 둡니다.
// 타입캐스트 감정: normal·happy·sad·angry·whisper·toneup·tonedown, 세기 0~2.
// ElevenLabs v3는 stability를 0(Creative)·0.5(Natural)·1(Robust) 중 하나만 받습니다.
export const TONES: {
  id: Tone;
  label: string;
  openai: string;
  typecast: { preset: string; intensity: number };
  elevenlabs: { stability: number; v3Stability: number; style: number };
}[] = [
  {
    id: "host",
    label: "쇼호스트",
    openai: "한국어 원어민 홈쇼핑 쇼호스트처럼 밝고 에너지 넘치게, 빠른 템포로 말하세요. 첫 문장은 귀를 확 잡게 시작하고, 가격·할인·혜택은 힘주어 강조하세요. 문장 끝은 늘이지 말고 시원하게 끊으세요.",
    typecast: { preset: "toneup", intensity: 1.5 },
    elevenlabs: { stability: 0.3, v3Stability: 0, style: 0.6 },
  },
  {
    id: "review",
    label: "솔직 리뷰",
    openai: "한국어 원어민이 친구에게 직접 써 본 물건을 추천하듯 자연스럽고 친근하게 말하세요. 과장하지 말고 대화하듯 편안한 속도로.",
    typecast: { preset: "happy", intensity: 1 },
    elevenlabs: { stability: 0.5, v3Stability: 0.5, style: 0.3 },
  },
  {
    id: "premium",
    label: "고급 제품",
    openai: "한국어 원어민 광고 내레이터처럼 차분하고 신뢰감 있게, 고급스러운 톤으로 또박또박 말하세요. 서두르지 마세요.",
    typecast: { preset: "tonedown", intensity: 1 },
    elevenlabs: { stability: 0.7, v3Stability: 1, style: 0.1 },
  },
];

export const MAX_TEXT = 1000;
// 서비스별 속도 범위(OpenAI 0.25~4, 타입캐스트 0.5~2, ElevenLabs 0.7~1.2)
const SPEED: Record<Provider, [number, number]> = { openai: [0.25, 4], typecast: [0.5, 2], elevenlabs: [0.7, 1.2] };

export interface SpeakRequest {
  provider: Provider;
  text: string;
  voice: string;
  model: string;
  tone: Tone;
  speed: number;
  // 타입캐스트 목소리가 고른 말투의 감정을 지원하지 않으면 페이지가 normal로 바꿔 보냅니다.
  emotion?: string;
}

export interface Voice {
  id: string;
  name: string;
  detail: string;
  emotions?: string[];
}

const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v));
const isProvider = (v: unknown): v is Provider => PROVIDERS.some((p) => p.id === v);

// 받은 요청 본문을 확인하고, 잘못됐으면 오류 문구를 돌려줍니다.
export function parseSpeak(body: unknown): SpeakRequest | string {
  if (!body || typeof body !== "object") return "요청 형식이 올바르지 않습니다.";
  const b = body as Record<string, unknown>;
  if (!isProvider(b.provider)) return "지원하지 않는 서비스입니다.";
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (!text) return "대본을 입력하세요.";
  if (text.length > MAX_TEXT) return `대본은 ${MAX_TEXT}자까지 넣을 수 있습니다.`;
  const voice = typeof b.voice === "string" ? b.voice.trim() : "";
  if (!/^[\w-]{1,64}$/.test(voice)) return "목소리를 고르세요.";
  const provider = PROVIDERS.find((p) => p.id === b.provider)!;
  const model = provider.models.some((m) => m.id === b.model) ? (b.model as string) : provider.models[0].id;
  const tone = TONES.some((t) => t.id === b.tone) ? (b.tone as Tone) : "host";
  const speed = typeof b.speed === "number" && Number.isFinite(b.speed) ? b.speed : 1;
  const emotion = typeof b.emotion === "string" && /^[a-z]{1,20}$/.test(b.emotion) ? b.emotion : undefined;
  return { provider: provider.id, text, voice, model, tone, speed, emotion };
}

// 서비스에 보낼 음성 합성 요청. 결과는 모두 MP3입니다.
export function speakRequest(r: SpeakRequest, key: string): { url: string; init: RequestInit } {
  const tone = TONES.find((t) => t.id === r.tone)!;
  const speed = clamp(r.speed, SPEED[r.provider]);
  const json = (headers: Record<string, string>, body: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (r.provider === "openai") {
    return {
      url: "https://api.openai.com/v1/audio/speech",
      init: json(
        { Authorization: `Bearer ${key}` },
        { model: r.model, voice: r.voice, input: r.text, instructions: tone.openai, response_format: "mp3", speed },
      ),
    };
  }
  if (r.provider === "typecast") {
    return {
      url: "https://api.typecast.ai/v1/text-to-speech",
      init: json(
        { "X-API-KEY": key },
        {
          voice_id: r.voice,
          text: r.text,
          model: r.model,
          language: "kor",
          prompt: {
            emotion_type: "preset",
            emotion_preset: r.emotion ?? tone.typecast.preset,
            emotion_intensity: r.emotion === "normal" ? 1 : tone.typecast.intensity,
          },
          output: { audio_format: "mp3", audio_tempo: speed, volume: 100, audio_pitch: 0 },
        },
      ),
    };
  }
  const v3 = r.model === "eleven_v3";
  return {
    url: `https://api.elevenlabs.io/v1/text-to-speech/${r.voice}?output_format=mp3_44100_128`,
    init: json(
      { "xi-api-key": key },
      {
        text: r.text,
        model_id: r.model,
        // multilingual_v2는 language_code를 받지 않습니다.
        ...(r.model !== "eleven_multilingual_v2" && { language_code: "ko" }),
        voice_settings: {
          stability: v3 ? tone.elevenlabs.v3Stability : tone.elevenlabs.stability,
          similarity_boost: 0.75,
          style: tone.elevenlabs.style,
          use_speaker_boost: true,
          speed,
        },
      },
    ),
  };
}

// 목소리 목록 요청. OpenAI는 목소리가 정해져 있어 요청하지 않습니다.
export function voicesRequest(provider: Provider, key: string): { url: string; init: RequestInit } | null {
  if (provider === "typecast") return { url: "https://api.typecast.ai/v2/voices?model=ssfm-v30", init: { headers: { "X-API-KEY": key } } };
  if (provider === "elevenlabs") return { url: "https://api.elevenlabs.io/v2/voices?page_size=100", init: { headers: { "xi-api-key": key } } };
  return null;
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

// 서비스마다 다른 목소리 목록 응답을 같은 모양으로 바꿉니다. 타입캐스트는 v2(models 안의 emotions)와 v1(emotions) 모양을 모두 받습니다.
export function parseVoices(provider: Provider, data: unknown): Voice[] {
  if (provider === "openai") return OPENAI_VOICES.map((v) => ({ id: v, name: v, detail: "" }));
  const list = Array.isArray(data) ? data : Array.isArray((data as { voices?: unknown })?.voices) ? (data as { voices: unknown[] }).voices : [];
  return list.flatMap((item): Voice[] => {
    if (!item || typeof item !== "object") return [];
    const v = item as Record<string, unknown>;
    const id = str(v.voice_id);
    if (!id) return [];
    if (provider === "elevenlabs") {
      const labels = (v.labels ?? {}) as Record<string, unknown>;
      const detail = [labels.gender, labels.age, labels.accent, labels.descriptive ?? labels.description].map(str).filter(Boolean).join(" · ");
      return [{ id, name: str(v.name) || id, detail }];
    }
    const models = Array.isArray(v.models) ? (v.models as Record<string, unknown>[]) : [];
    const model = models.find((m) => str(m.version) === "ssfm-v30") ?? models[0];
    const emotions = (Array.isArray(model?.emotions) ? model.emotions : Array.isArray(v.emotions) ? v.emotions : []).map(str).filter(Boolean);
    const detail = [v.gender, v.age, ...(Array.isArray(v.use_cases) ? v.use_cases.slice(0, 2) : [])].map(str).filter(Boolean).join(" · ");
    return [{ id, name: str(v.voice_name) || str(v.name) || id, detail, emotions: emotions.length ? emotions : undefined }];
  });
}

// 대략적인 읽는 시간(초). 한국어 보통 속도를 공백 제외 초당 6자로 잡습니다.
export function estimateSeconds(text: string, speed: number): number {
  const chars = text.replace(/\s/g, "").length;
  return chars / 6 / (speed > 0 ? speed : 1);
}
