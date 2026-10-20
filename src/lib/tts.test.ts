import { describe, expect, it } from "vitest";
import { MAX_TEXT, estimateSeconds, parseSpeak, parseVoices, speakRequest, type SpeakRequest } from "./tts";

const base: SpeakRequest = { provider: "openai", text: "오늘만 39,900원!", voice: "marin", model: "gpt-4o-mini-tts", tone: "host", speed: 1.15 };
const body = (r: { init: RequestInit }) => JSON.parse(r.init.body as string);

describe("음성 합성 비교", () => {
  it("잘못된 요청을 걸러낸다", () => {
    expect(parseSpeak(null)).toMatch(/형식/);
    expect(parseSpeak({ ...base, provider: "naver" })).toMatch(/서비스/);
    expect(parseSpeak({ ...base, text: "  " })).toMatch(/대본/);
    expect(parseSpeak({ ...base, text: "가".repeat(MAX_TEXT + 1) })).toMatch(/1000자/);
    expect(parseSpeak({ ...base, voice: "../x" })).toMatch(/목소리/);
    // 모르는 모델·말투는 기본값으로
    expect(parseSpeak({ ...base, model: "x", tone: "x", speed: "fast" })).toEqual({ ...base, tone: "host", speed: 1, emotion: undefined });
  });

  it("OpenAI 요청에 말투 지시와 속도를 넣는다", () => {
    const r = speakRequest(base, "sk-test");
    expect(r.url).toBe("https://api.openai.com/v1/audio/speech");
    expect((r.init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const b = body(r);
    expect(b).toMatchObject({ model: "gpt-4o-mini-tts", voice: "marin", input: "오늘만 39,900원!", response_format: "mp3", speed: 1.15 });
    expect(b.instructions).toMatch(/쇼호스트/);
  });

  it("타입캐스트는 한국어·감정 프리셋·MP3로, 감정을 바꿔 보낼 수 있다", () => {
    const r = speakRequest({ ...base, provider: "typecast", voice: "tc_1", model: "ssfm-v30", speed: 3 }, "k");
    expect((r.init.headers as Record<string, string>)["X-API-KEY"]).toBe("k");
    const b = body(r);
    expect(b).toMatchObject({ voice_id: "tc_1", model: "ssfm-v30", language: "kor", prompt: { emotion_type: "preset", emotion_preset: "toneup" } });
    expect(b.output).toMatchObject({ audio_format: "mp3", audio_tempo: 2 });
    const n = body(speakRequest({ ...base, provider: "typecast", voice: "tc_1", model: "ssfm-v30", emotion: "normal" }, "k"));
    expect(n.prompt).toMatchObject({ emotion_preset: "normal", emotion_intensity: 1 });
  });

  it("ElevenLabs는 모델에 맞게 language_code와 stability를 정한다", () => {
    const v2 = speakRequest({ ...base, provider: "elevenlabs", voice: "abc", model: "eleven_multilingual_v2", speed: 1.3 }, "k");
    expect(v2.url).toBe("https://api.elevenlabs.io/v1/text-to-speech/abc?output_format=mp3_44100_128");
    expect(body(v2).language_code).toBeUndefined();
    expect(body(v2).voice_settings).toMatchObject({ stability: 0.3, speed: 1.2 });
    const v3 = body(speakRequest({ ...base, provider: "elevenlabs", voice: "abc", model: "eleven_v3", tone: "review" }, "k"));
    expect(v3.language_code).toBe("ko");
    expect([0, 0.5, 1]).toContain(v3.voice_settings.stability);
  });

  it("서비스마다 다른 목소리 목록을 같은 모양으로 바꾼다", () => {
    expect(parseVoices("openai", null)[0]).toEqual({ id: "marin", name: "marin", detail: "" });
    expect(parseVoices("elevenlabs", { voices: [{ voice_id: "e1", name: "Anna", labels: { gender: "female", age: "young" } }, { name: "ID 없음" }] }))
      .toEqual([{ id: "e1", name: "Anna", detail: "female · young" }]);
    // v2: models 안의 emotions, v1: emotions
    expect(parseVoices("typecast", [{ voice_id: "tc_1", voice_name: "지민", gender: "female", age: "young_adult", models: [{ version: "ssfm-v21", emotions: ["normal"] }, { version: "ssfm-v30", emotions: ["normal", "toneup"] }] }]))
      .toEqual([{ id: "tc_1", name: "지민", detail: "female · young_adult", emotions: ["normal", "toneup"] }]);
    expect(parseVoices("typecast", { voices: [{ voice_id: "tc_2", voice_name: "도윤", emotions: ["normal"] }] })[0].emotions).toEqual(["normal"]);
    expect(parseVoices("typecast", "oops")).toEqual([]);
  });

  it("읽는 시간을 대략 계산한다", () => {
    expect(estimateSeconds("가".repeat(60), 1)).toBe(10);
    expect(estimateSeconds("가 나 다 라 마 바", 0.5)).toBe(2);
  });
});
