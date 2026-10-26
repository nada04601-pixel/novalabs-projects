import { describe, expect, it } from "vitest";
import { assTime, buildArgs, buildAss, fillClips, lineSeconds, planLines } from "./shopping-shorts.mjs";

describe("lineSeconds", () => {
  it("공백을 뺀 글자 수로 길이를 정하고 최소 1.2초", () => {
    expect(lineSeconds("1초 만에 설치 끝이에요.")).toBe(1.95);
    expect(lineSeconds("네")).toBe(1.2);
  });
});

describe("planLines", () => {
  it("내레이션이 없으면 줄 길이를 이어 붙인다", () => {
    const plan = planLines(["네", "1초 만에 설치 끝이에요."]);
    expect(plan.map((l) => [l.start, l.end])).toEqual([
      [0, 1.2],
      [1.2, 3.15],
    ]);
  });

  it("내레이션 길이가 있으면 글자 수 비율로 나누고 끝을 맞춘다", () => {
    const plan = planLines(["가나", "다라마바"], 9);
    expect(plan[0].end).toBeCloseTo(3);
    expect(plan[1].end).toBe(9);
  });
});

describe("assTime", () => {
  it("ASS 시간 표기로 바꾼다", () => {
    expect(assTime(0)).toBe("0:00:00.00");
    expect(assTime(65.5)).toBe("0:01:05.50");
    expect(assTime(3725.256)).toBe("1:02:05.26");
  });
});

describe("buildAss", () => {
  const spec = { title: ["다이소 가면", "이거 사오세요"], cta: "구매 링크는 고정 댓글에", disclosure: "광고 표시" };
  const ass = buildAss(spec, planLines(["첫 줄 {강조}", "둘째 줄"]), 10);

  it("제목 둘째 줄을 노란색으로, 대본 자막을 시간대로 넣는다", () => {
    expect(ass).toContain("Dialogue: 0,0:00:00.00,0:00:10.00,Title,,0,0,0,,다이소 가면\\N{\\c&H00F0FF&}이거 사오세요");
    expect(ass).toContain(",Caption,,0,0,0,,둘째 줄");
  });

  it("대본의 중괄호는 ASS 명령으로 읽히지 않게 바꾼다", () => {
    expect(ass).toContain("첫 줄 ｛강조｝");
  });

  it("구매 안내는 마지막 3초, 광고 표시는 영상 내내", () => {
    expect(ass).toContain("Dialogue: 0,0:00:07.00,0:00:10.00,Cta,,0,0,0,,구매 링크는 고정 댓글에");
    expect(ass).toContain("Dialogue: 0,0:00:00.00,0:00:10.00,Note,,0,0,0,,광고 표시");
  });

  it("넣지 않은 항목은 빠진다", () => {
    const plain = buildAss({ title: ["제목"] }, planLines(["한 줄"]), 2);
    expect(plain).not.toContain(",Cta,");
    expect(plain).not.toContain(",Note,");
    expect(plain).not.toContain("\\N");
  });
});

describe("fillClips", () => {
  it("길이가 찰 때까지 클립을 차례로 반복한다", () => {
    const a = { file: "a.mp4", start: 0, end: 4 };
    const b = { file: "b.mp4", start: 2, end: 5 };
    expect(fillClips([a, b], 12).map((c) => c.file)).toEqual(["a.mp4", "b.mp4", "a.mp4", "b.mp4"]);
  });

  it("길이가 0 이하인 클립은 오류", () => {
    expect(() => fillClips([{ file: "a.mp4", start: 3, end: 3 }], 5)).toThrow();
  });
});

describe("buildArgs", () => {
  const clips = [{ file: "a.mp4", start: 0, end: 10 }];

  it("소리가 하나도 없으면 무음 트랙을 넣는다", () => {
    const args = buildArgs({ clips, out: "o.mp4" }, 5, "/tmp/s.ass", "/w");
    expect(args).toContain("anullsrc=r=44100:cl=stereo");
    expect(args.at(-1)).toBe("/w/o.mp4");
  });

  it("내레이션과 배경 음악을 섞는다", () => {
    const args = buildArgs({ clips, narration: "n.mp3", bgm: "b.mp3" }, 5, "/tmp/s.ass", "/w");
    const graph = args[args.indexOf("-filter_complex") + 1];
    expect(args).toContain("/w/n.mp3");
    expect(graph).toContain("[n][b]amix=inputs=2");
    expect(args).not.toContain("anullsrc=r=44100:cl=stereo");
  });
});
