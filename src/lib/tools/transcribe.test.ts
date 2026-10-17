import { describe, expect, it } from "vitest";
import { chunkCues, mergeRepeats, planChunks, splitLongCue } from "./transcribe";

describe("음성 인식 자막", () => {
  it("30초 조각 끝부분의 가장 조용한 곳에서 자른다", () => {
    const rate = 100;
    const s = new Float32Array(70 * rate).fill(0.5);
    s.fill(0, 27 * rate, 27 * rate + 10); // 27초에 0.1초 조용함
    const chunks = planChunks(s, rate);
    expect(chunks[0]).toEqual([0, 27 * rate + 5]);
    expect(chunks[chunks.length - 1][1]).toBe(70 * rate);
    for (let i = 1; i < chunks.length; i++) expect(chunks[i][0]).toBe(chunks[i - 1][1]);
    expect(chunks.every(([a, b]) => b - a <= 30 * rate)).toBe(true);
    expect(planChunks(new Float32Array(5 * rate), rate)).toEqual([[0, 5 * rate]]);
  });
  it("조각 시간을 더하고, 끝 시간이 없으면 조각 끝까지", () => {
    const cues = chunkCues(
      [
        { timestamp: [0, 2.5], text: " 안녕하세요. " },
        { timestamp: [3, null], text: "반갑습니다" },
        { timestamp: [4, 5], text: " ... " },
      ],
      60,
      88,
    );
    expect(cues).toEqual([
      { start: 60, end: 62.5, text: "안녕하세요." },
      { start: 63, end: 64, text: "반갑습니다" },
    ]);
    expect(chunkCues([{ timestamp: [1, null], text: "끝" }], 10, 20)).toEqual([{ start: 11, end: 20, text: "끝" }]);
  });
  it("긴 문장은 문장 끝이나 띄어쓰기에서 나누고 시간을 글자 수로 나눈다", () => {
    const text = "오늘은 날씨가 정말 좋네요. 산책하러 나가 볼까요? 공원에는 사람이 많을 것 같아요 그래도 괜찮아요";
    const parts = splitLongCue({ start: 0, end: 10, text });
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.text.length <= 42)).toBe(true);
    expect(parts.map((p) => p.text).join(" ")).toBe(text);
    expect(parts[0].start).toBe(0);
    expect(parts[parts.length - 1].end).toBe(10);
    expect(splitLongCue({ start: 0, end: 1, text: "짧음" })).toEqual([{ start: 0, end: 1, text: "짧음" }]);
  });
  it("바로 이어서 되풀이된 문장은 합친다", () => {
    expect(mergeRepeats([
      { start: 0, end: 1, text: "감사합니다" },
      { start: 1.2, end: 2, text: "감사합니다" },
      { start: 5, end: 6, text: "감사합니다" },
    ])).toEqual([
      { start: 0, end: 2, text: "감사합니다" },
      { start: 5, end: 6, text: "감사합니다" },
    ]);
  });
});
