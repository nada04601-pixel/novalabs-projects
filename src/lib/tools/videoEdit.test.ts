import { describe, expect, it } from "vitest";
import { editedName, estimateBytes, fitShortSide, formatTime, parseTime, trimError, videoBitrate } from "./videoEdit";

describe("시간 입력", () => {
  it("초, 분:초, 시:분:초를 읽는다", () => {
    expect(parseTime("83.5")).toBe(83.5);
    expect(parseTime("1:23.5")).toBe(83.5);
    expect(parseTime(" 1:02:03 ")).toBe(3723);
    expect(parseTime("90:00")).toBe(5400);
  });
  it("틀린 형식은 null", () => {
    for (const t of ["", "abc", "1:60", "1:75:00", "-3", "1::2", "1:2:3:4"]) expect(parseTime(t)).toBeNull();
  });
  it("표시 형식으로 바꾸고 다시 읽으면 같은 값이다", () => {
    expect(formatTime(0)).toBe("0:00.0");
    expect(formatTime(83.56)).toBe("1:23.5");
    expect(formatTime(3723.4)).toBe("1:02:03.4");
    expect(formatTime(59.95)).toBe("0:59.9");
    for (const s of [0.3, 59.9, 61.2, 3599.9, 7322.1]) expect(parseTime(formatTime(s))).toBeCloseTo(s, 5);
  });
});

describe("자를 구간 확인", () => {
  it("올바른 구간은 통과", () => {
    expect(trimError(0, 10, 10)).toBeNull();
    expect(trimError(3, 5.5, 10)).toBeNull();
  });
  it("문제를 알려준다", () => {
    expect(trimError(null, 5, 10)).toMatch("시작");
    expect(trimError(1, null, 10)).toMatch("끝");
    expect(trimError(10, 12, 10)).toMatch("영상 길이");
    expect(trimError(1, 11, 10)).toMatch("넘을 수 없습니다");
    expect(trimError(5, 5, 10)).toMatch("뒤여야");
  });
});

describe("압축 계산", () => {
  it("짧은 변 기준으로 줄이고 짝수로 맞춘다", () => {
    expect(fitShortSide(1920, 1080, 720)).toEqual({ w: 1280, h: 720 });
    expect(fitShortSide(1080, 1920, 480)).toEqual({ w: 480, h: 854 });
    expect(fitShortSide(640, 360, 720)).toEqual({ w: 640, h: 360 });
    expect(fitShortSide(641, 361, 1080)).toEqual({ w: 642, h: 362 });
  });
  it("비트레이트는 원본의 70%를 넘지 않고 하한이 있다", () => {
    expect(videoBitrate(1280, 720, 30, 0.08)).toBe(2_211_840);
    expect(videoBitrate(1280, 720, 30, 0.08, 2_000_000)).toBe(1_400_000);
    expect(videoBitrate(160, 90, 30, 0.05, 100_000)).toBe(150_000);
    expect(videoBitrate(1280, 720, 0, 0.08)).toBe(2_211_840); // 프레임 수를 모르면 30으로 봅니다.
  });
  it("예상 크기", () => {
    expect(estimateBytes(1_000_000, 0, 8)).toBe(1_020_000);
  });
  it("결과 파일 이름", () => {
    expect(editedName("여행.영상.mov", "자름", "mp4")).toBe("여행.영상-자름.mp4");
    expect(editedName(".mp4", "압축", "webm")).toBe("동영상-압축.webm");
  });
});
