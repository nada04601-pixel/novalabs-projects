import { describe, expect, it } from "vitest";
import { vttToLines } from "./vtt-to-text.mjs";

describe("vttToLines", () => {
  it("시간과 문장을 뽑고 태그를 지운다", () => {
    const vtt = "WEBVTT\nKind: captions\n\n00:00:01.000 --> 00:00:03.000\nHello <c>there</c> &amp; hi\n\n01:05.500 --> 01:07.000\nSecond line\n";
    expect(vttToLines(vtt)).toEqual([
      { time: "00:01", text: "Hello there & hi" },
      { time: "01:05", text: "Second line" },
    ]);
  });

  it("자동 자막에서 겹쳐 나오는 앞 줄은 한 번만 남긴다", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:01.000 --> 00:00:02.000 align:start position:0%",
      "we're scared",
      "",
      "00:00:02.000 --> 00:00:03.000 align:start position:0%",
      "we're scared",
      "<00:00:02.100><c> right</c><00:00:02.400><c> now</c>",
      "",
      "00:00:03.000 --> 00:00:04.000",
      "right now",
    ].join("\n");
    expect(vttToLines(vtt).map((l) => `${l.time} ${l.text}`)).toEqual(["00:01 we're scared", "00:02 right now"]);
  });

  it("1시간이 넘는 시간도 분으로 센다", () => {
    expect(vttToLines("WEBVTT\n\n01:02:03.000 --> 01:02:04.000\nlate")).toEqual([{ time: "62:03", text: "late" }]);
  });
});
