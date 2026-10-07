import { describe, expect, it } from "vitest";
import { AMBIGUOUS, CHARSETS, entropyBits, generatePassword, randomInt, strength } from "./password";
import { countStrokes, markChars, scoreTyping, strokes } from "./typing";
import { contrastRatio, isInverted, normalizeUrlOrText, smsPayload, telPayload, wifiPayload } from "./qr";
import { compressedName, formatBytes, reduction, renderScale } from "./fileSize";

// 테스트용 결정적 난수원(선형 합동 생성기)
const seeded = (seed = 1) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);

describe("비밀번호 생성기", () => {
  it("randomInt는 범위 안의 값만 돌려준다", () => {
    const r = seeded(7);
    for (let i = 0; i < 1000; i++) {
      const v = randomInt(10, r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });
  it("거절 샘플링 한계값 이상은 다시 뽑는다", () => {
    const vals = [0xffffffff, 5];
    expect(randomInt(3, () => vals.shift()!)).toBe(2);
  });
  it("길이를 지키고 고른 종류를 모두 포함한다", () => {
    const r = seeded(3);
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword({ length: 8, sets: ["lower", "upper", "digits", "symbols"], excludeAmbiguous: false }, r);
      expect(pw).toHaveLength(8);
      expect([...pw].some((c) => CHARSETS.lower.includes(c))).toBe(true);
      expect([...pw].some((c) => CHARSETS.upper.includes(c))).toBe(true);
      expect([...pw].some((c) => CHARSETS.digits.includes(c))).toBe(true);
      expect([...pw].some((c) => CHARSETS.symbols.includes(c))).toBe(true);
    }
  });
  it("헷갈리는 글자를 뺄 수 있다", () => {
    const pw = generatePassword({ length: 500, sets: ["lower", "upper", "digits"], excludeAmbiguous: true }, seeded(9));
    expect([...pw].some((c) => AMBIGUOUS.includes(c))).toBe(false);
  });
  it("아무 종류도 고르지 않으면 빈 문자열", () => {
    expect(generatePassword({ length: 12, sets: [], excludeAmbiguous: false })).toBe("");
  });
  it("엔트로피와 강도", () => {
    expect(entropyBits({ length: 10, sets: ["digits"], excludeAmbiguous: false })).toBeCloseTo(33.22, 1);
    expect(strength(33).label).toBe("약함");
    expect(strength(95).label).toBe("매우 강함");
  });
});

describe("타자 속도", () => {
  it("한글 타수를 자소 기준으로 센다", () => {
    expect(strokes("가")).toBe(2);
    expect(strokes("각")).toBe(3);
    expect(strokes("값")).toBe(4); // ㄱ ㅏ ㅂ ㅅ
    expect(strokes("와")).toBe(3); // ㅇ ㅗ ㅏ
    expect(strokes("꽉")).toBe(4); // ㄲ ㅗ ㅏ ㄱ
    expect(strokes("a")).toBe(1);
    expect(countStrokes("한글 a")).toBe(3 + 3 + 1 + 1);
  });
  it("정확도와 분당 타수", () => {
    const r = scoreTyping("가나다", "가나라", 60_000);
    expect(r.correctChars).toBe(2);
    expect(r.accuracy).toBeCloseTo(2 / 3);
    expect(r.cpm).toBe(4);
    const e = scoreTyping("hello world", "hello world", 6_000);
    expect(e.wpm).toBe(22);
    expect(e.cpm).toBe(110);
  });
  it("글자 상태 표시", () => {
    expect(markChars("abc", "ax").map((m) => m.state)).toEqual(["ok", "current", "todo"]);
    expect(markChars("abc", "xb").map((m) => m.state)).toEqual(["bad", "ok", "todo"]);
  });
});

describe("QR코드", () => {
  it("Wi-Fi 형식과 특수문자 처리", () => {
    expect(wifiPayload("집;와이파이", 'pa:ss"1', "WPA", false)).toBe(String.raw`WIFI:T:WPA;S:집\;와이파이;P:pa\:ss\"1;;`);
    expect(wifiPayload("cafe", "", "nopass", true)).toBe("WIFI:T:nopass;S:cafe;H:true;;");
  });
  it("전화·문자", () => {
    expect(telPayload("010-1234-5678")).toBe("tel:01012345678");
    expect(smsPayload("010 1234 5678", "안녕")).toBe("SMSTO:01012345678:안녕");
  });
  it("주소에 https 붙이기", () => {
    expect(normalizeUrlOrText("novalabs.co.kr/tools")).toBe("https://novalabs.co.kr/tools");
    expect(normalizeUrlOrText("http://a.com")).toBe("http://a.com");
    expect(normalizeUrlOrText("안녕하세요 반갑습니다")).toBe("안녕하세요 반갑습니다");
  });
  it("색 대비", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(isInverted("#ffffff", "#000000")).toBe(true);
  });
});

describe("파일 크기", () => {
  it("표시와 비율", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
    expect(reduction(1000, 400)).toBeCloseTo(0.6);
    expect(renderScale(144)).toBe(2);
    expect(compressedName("보고서.PDF")).toBe("보고서-압축.pdf");
  });
});

import { graphemes, legacyBytes, manuscriptPages, neisBytes, textStats, utf8Bytes } from "./textCount";

describe("글자수 세기", () => {
  it("공백 포함·제외와 단어·줄·문단", () => {
    const s = textStats("안녕 하세요\nHello world\n\n둘째 문단");
    expect(s.chars).toBe(6 + 11 + 5);
    expect(s.charsNoSpace).toBe(5 + 10 + 4);
    expect(s.words).toBe(6);
    expect(s.lines).toBe(4);
    expect(s.paragraphs).toBe(2);
    expect(s.hangul).toBe(9);
  });
  it("빈 글", () => {
    expect(textStats("")).toMatchObject({ chars: 0, words: 0, lines: 0, paragraphs: 0 });
    expect(textStats("   ").words).toBe(0);
  });
  it("이모지와 결합 문자는 한 글자", () => {
    expect(graphemes("👍🏻a").length).toBe(2);
    expect(textStats("👨‍👩‍👧").chars).toBe(1);
  });
  it("바이트 기준", () => {
    expect(neisBytes("가a 1")).toBe(3 + 1 + 1 + 1);
    expect(neisBytes("가\n나")).toBe(3 + 2 + 3);
    expect(neisBytes("가\r\n나")).toBe(8);
    expect(legacyBytes("가a\n")).toBe(2 + 1 + 2);
    expect(utf8Bytes("가a")).toBe(4);
  });
  it("원고지 매수", () => {
    expect(manuscriptPages(0)).toBe(0);
    expect(manuscriptPages(200)).toBe(1);
    expect(manuscriptPages(201)).toBe(2);
  });
});
