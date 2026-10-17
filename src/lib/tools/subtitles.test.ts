import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { extractSubtitles, extractErrorMessage } from "./subtitleExtract";
import { assTime, assToText, finishCues, render, srtTime, subtitleName, toAss, toSrt, toTxt, toVtt, type SubtitleTrack } from "./subtitles";

const track = (over: Partial<SubtitleTrack>): SubtitleTrack => ({
  number: 1, codec: "S_TEXT/UTF8", source: "srt", language: "kor", name: "", isDefault: true, forced: false, cues: [], ...over,
});

describe("자막 형식", () => {
  it("시간 표기", () => {
    expect(srtTime(3723.4567)).toBe("01:02:03,457");
    expect(assTime(62.355)).toBe("0:01:02.36");
  });
  it("길이가 없는 자막은 다음 자막까지, 최대 5초", () => {
    const cues = finishCues([{ start: 10, end: NaN, text: "b" }, { start: 1, end: NaN, text: "a" }]);
    expect(cues.map((c) => [c.start, c.end])).toEqual([[1, 6], [10, 15]]);
    expect(finishCues([{ start: 1, end: NaN, text: "a" }, { start: 3, end: 4, text: "b" }])[0].end).toBe(3);
  });
  it("ASS 꾸밈 코드를 지우고 기울임은 태그로", () => {
    expect(assToText("{\\an8\\i1}안녕{\\i0}\\N둘째\\h줄")).toBe("<i>안녕</i>\n둘째 줄");
  });
  it("SRT·VTT·TXT로 바꾼다", () => {
    const t = track({ cues: [{ start: 1, end: 2.5, text: "<font color=\"red\">a & b</font>\n\n둘째" }, { start: 3, end: 3, text: "빈 길이" }] });
    expect(toSrt(t)).toBe("1\n00:00:01,000 --> 00:00:02,500\n<font color=\"red\">a & b</font>\n둘째\n");
    expect(toVtt(t)).toBe("WEBVTT\n\n00:00:01.000 --> 00:00:02.500\na &amp; b\n둘째\n");
    expect(toTxt(t)).toBe("a & b 둘째\n");
  });
  it("WebVTT 태그는 SRT에서 i·b·u만 남긴다", () => {
    const t = track({ source: "vtt", cues: [{ start: 0, end: 1, text: "<v 철수><c.yellow>안녕</c> <i>하세요</i></v> &lt;3" }] });
    expect(render(t, "srt")).toContain("\n안녕 <i>하세요</i> <3\n");
  });
  it("ASS 원래 형식은 읽은 순서대로", () => {
    const t = track({
      source: "ass",
      assHeader: "[Script Info]\nScriptType: v4.00+",
      cues: [
        { start: 5, end: 6, text: "둘", ass: { fields: ["0", "Default", "", "0", "0", "0", ""], order: 1 } },
        { start: 1, end: 2, text: "{\\b1}하나", ass: { fields: ["0", "Default", "", "0", "0", "0", ""], order: 0 } },
      ],
    });
    expect(toAss(t)).toBe(
      "[Script Info]\nScriptType: v4.00+\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n" +
        "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\b1}하나\nDialogue: 0,0:00:05.00,0:00:06.00,Default,,0,0,0,,둘\n",
    );
  });
  it("파일 이름에 언어를 붙이고, 같은 언어가 여럿이면 트랙 번호도", () => {
    const a = track({ number: 3 });
    const b = track({ number: 4, language: "eng" });
    const c = track({ number: 5 });
    expect(subtitleName("영화.mkv", b, [a, b], "srt")).toBe("영화.eng.srt");
    expect(subtitleName("영화.mkv", a, [a, b, c], "vtt")).toBe("영화.kor.3.vtt");
    expect(subtitleName("", track({ language: "und" }), [], "txt", "en")).toBe("video.txt");
  });
});

/* 시험용 MKV·MP4를 바이트로 만듭니다. */
const enc = new TextEncoder();
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) (out.set(p, o), (o += p.length));
  return out;
};
const idBytes = (id: number) => { const b: number[] = []; for (let v = id; v; v = Math.floor(v / 256)) b.unshift(v & 255); return new Uint8Array(b); };
// 크기는 늘 4바이트 가변 길이 정수로 적습니다.
const sizeBytes = (n: number) => new Uint8Array([0x10 | ((n >> 24) & 0x0f), (n >> 16) & 255, (n >> 8) & 255, n & 255]);
const el = (id: number, ...body: (Uint8Array | string | number)[]) => {
  const data = cat(...body.map((x) => (typeof x === "string" ? enc.encode(x) : typeof x === "number" ? new Uint8Array([x]) : x)));
  return cat(idBytes(id), sizeBytes(data.length), data);
};
const block = (track: number, rel: number, payload: Uint8Array | string) =>
  cat(new Uint8Array([0x80 | track, (rel >> 8) & 255, rel & 255, 0]), typeof payload === "string" ? enc.encode(payload) : payload);

function mkv() {
  const zlibEncoding = el(0x6d80, el(0x6240, el(0x5034, el(0x4254, 0))));
  const tracks = el(0x1654ae6b,
    el(0xae, el(0xd7, 1), el(0x83, 1), el(0x86, "V_VP8")),
    el(0xae, el(0xd7, 2), el(0x83, 0x11), el(0x86, "S_TEXT/UTF8"), el(0x22b59c, "kor"), zlibEncoding),
    el(0xae, el(0xd7, 3), el(0x83, 0x11), el(0x86, "S_TEXT/ASS"), el(0x536e, "Styled"), el(0x63a2, "[Script Info]\n")),
    el(0xae, el(0xd7, 4), el(0x83, 0x11), el(0x86, "S_HDMV/PGS")),
  );
  const cluster = el(0x1f43b675,
    el(0xe7, 0x03, 0xe8), // 1000ms
    el(0xa3, block(1, 0, new Uint8Array(50))),
    el(0xa0, el(0xa1, block(2, 500, new Uint8Array(deflateSync(enc.encode("안녕하세요"))))), el(0x9b, 0x07, 0xd0)),
    el(0xa0, el(0xa1, block(3, 0, "0,0,Default,,0,0,0,,{\\i1}Hi, there")), el(0x9b, 0x03, 0xe8)),
    el(0xa3, block(2, 4000, new Uint8Array(deflateSync(enc.encode("마지막"))))),
    el(0xa3, block(4, 0, new Uint8Array(10))),
  );
  return cat(el(0x1a45dfa3, el(0x4282, "matroska")), el(0x18538067, el(0x1549a966, el(0x2ad7b1, 0x0f, 0x42, 0x40)), tracks, cluster));
}

const u32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u16 = (n: number) => new Uint8Array([(n >> 8) & 255, n & 255]);
const box = (type: string, ...body: Uint8Array[]) => { const data = cat(...body); return cat(u32(data.length + 8), enc.encode(type), data); };
const tx3g = (s: string) => { const b = enc.encode(s); return cat(u16(b.length), b); };

function mp4() {
  const samples = [tx3g("첫째"), tx3g(""), tx3g("둘째")];
  const ftyp = box("ftyp", enc.encode("isom"), u32(0));
  const mdat = box("mdat", ...samples);
  const dataStart = ftyp.length + 8;
  const lang = ((11 << 10) | (15 << 5) | 18); // "kor"
  const stbl = box("stbl",
    box("stsd", u32(0), u32(1), box("tx3g", new Uint8Array(30))),
    box("stts", u32(0), u32(3), u32(1), u32(1500), u32(1), u32(500), u32(1), u32(2000)),
    box("stsc", u32(0), u32(1), u32(1), u32(3), u32(1)),
    box("stsz", u32(0), u32(0), u32(3), ...samples.map((s) => u32(s.length))),
    box("stco", u32(0), u32(1), u32(dataStart)),
  );
  const trak = box("trak",
    box("tkhd", u32(1), u32(0), u32(0), u32(7), new Uint8Array(60)),
    box("mdia",
      box("mdhd", u32(0), u32(0), u32(0), u32(1000), u32(4000), u16(lang), u16(0)),
      box("hdlr", u32(0), u32(0), enc.encode("sbtl"), new Uint8Array(13)),
      box("minf", stbl),
    ),
  );
  return cat(ftyp, mdat, box("moov", trak));
}

describe("자막 트랙 꺼내기", () => {
  it("MKV: zlib 압축·ASS·그림 자막", async () => {
    const tracks = await extractSubtitles(new Blob([mkv()]));
    expect(tracks.map((t) => [t.number, t.source, t.language, t.name])).toEqual([
      [2, "srt", "kor", ""],
      [3, "ass", "eng", "Styled"],
      [4, null, "eng", ""],
    ]);
    expect(tracks[0].cues).toEqual([
      { start: 1.5, end: 3.5, text: "안녕하세요" },
      { start: 5, end: 10, text: "마지막" },
    ]);
    expect(tracks[1].assHeader).toBe("[Script Info]\n");
    expect(tracks[1].cues[0]).toMatchObject({ start: 1, end: 2, text: "{\\i1}Hi, there" });
    expect(render(tracks[1], "srt")).toContain("<i>Hi, there");
  });
  it("MP4: tx3g, 빈 샘플은 자막 사이 빈 구간", async () => {
    const [t] = await extractSubtitles(new Blob([mp4()]));
    expect(t).toMatchObject({ number: 7, codec: "tx3g", language: "kor" });
    expect(t.cues).toEqual([
      { start: 0, end: 1.5, text: "첫째" },
      { start: 2, end: 4, text: "둘째" },
    ]);
  });
  it("모르는 형식은 안내", async () => {
    await expect(extractSubtitles(new Blob([new Uint8Array(64)]))).rejects.toThrow("unsupported-format");
    expect(extractErrorMessage(new Error("unsupported-format"), "en")).toMatch(/^Only MKV/);
  });
});
