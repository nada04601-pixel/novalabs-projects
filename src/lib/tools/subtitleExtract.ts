// 동영상 파일 안에 따로 들어 있는 자막 트랙(MKV·WebM·MP4·MOV)을 읽습니다.
// mediabunny는 입력 파일의 자막 트랙을 읽지 못해 컨테이너 구조를 직접 해석합니다. 화면에 새겨진 자막은 꺼낼 수 없습니다.
import { pick, type Lang } from "../i18n";
import { finishCues, type SubtitleCue, type SubtitleSource, type SubtitleTrack } from "./subtitles";

type Progress = (p: number) => void;

// 파일 전체를 메모리에 올리지 않고, 필요한 부분만 조각으로 읽습니다.
class ByteReader {
  private buf = new Uint8Array(0);
  private start = 0;
  constructor(readonly blob: Blob, private chunk = 4 << 20) {}
  get size() {
    return this.blob.size;
  }
  // pos부터 len바이트. 파일 끝에 닿으면 더 짧을 수 있습니다.
  async bytes(pos: number, len: number): Promise<Uint8Array> {
    const end = Math.min(pos + len, this.size);
    if (pos >= this.start && end <= this.start + this.buf.length) return this.buf.subarray(pos - this.start, end - this.start);
    const readEnd = Math.min(this.size, pos + Math.max(len, this.chunk));
    this.buf = new Uint8Array(await this.blob.slice(pos, readEnd).arrayBuffer());
    this.start = pos;
    return this.buf.subarray(0, end - pos);
  }
  // 띄엄띄엄 놓인 작은 조각(MP4 자막 샘플)은 큰 조각을 읽지 않고 필요한 만큼만 읽습니다.
  async exact(pos: number, len: number): Promise<Uint8Array> {
    return new Uint8Array(await this.blob.slice(pos, Math.min(pos + len, this.size)).arrayBuffer());
  }
}

const utf8 = new TextDecoder("utf-8");
const decodeText = (b: Uint8Array) => utf8.decode(b).replace(/\0+$/, "");

function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

export async function extractSubtitles(file: Blob, onProgress: Progress = () => {}, signal?: AbortSignal): Promise<SubtitleTrack[]> {
  const r = new ByteReader(file);
  const head = await r.bytes(0, 12);
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return readMatroska(r, onProgress, signal);
  const box = String.fromCharCode(...head.subarray(4, 8));
  if (["ftyp", "moov", "mdat", "free", "wide", "skip"].includes(box)) return readMp4(r, onProgress, signal);
  throw new Error("unsupported-format");
}

export function extractErrorMessage(e: unknown, lang: Lang = "ko"): string {
  const t = (ko: string, en: string) => pick(lang, ko, en);
  const msg = e instanceof Error ? e.message : "";
  if (e instanceof DOMException && e.name === "AbortError") return t("자막 찾기를 멈췄습니다.", "Stopped looking for subtitles.");
  if (msg === "unsupported-format")
    return t("MKV·MP4·MOV·WebM 동영상만 읽을 수 있습니다. AVI 등 다른 형식은 자막 트랙을 담지 못하거나 지원하지 않습니다.", "Only MKV, MP4, MOV and WebM videos can be read. Other formats such as AVI can't hold subtitle tracks or aren't supported.");
  if (msg === "moov-too-large") return t("동영상 정보 부분이 너무 커서 읽을 수 없습니다.", "The video's index is too large to read.");
  return t("동영상을 읽지 못했습니다. 파일이 손상되었을 수 있습니다.", "Couldn't read the video. The file may be damaged.");
}

/* ───────────── Matroska(MKV·WebM) ───────────── */

const ID = {
  Segment: 0x18538067,
  Info: 0x1549a966,
  TimestampScale: 0x2ad7b1,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackNumber: 0xd7,
  TrackType: 0x83,
  CodecID: 0x86,
  CodecPrivate: 0x63a2,
  Language: 0x22b59c,
  LanguageBCP47: 0x22b59d,
  Name: 0x536e,
  FlagDefault: 0x88,
  FlagForced: 0x55aa,
  DefaultDuration: 0x23e383,
  ContentEncodings: 0x6d80,
  ContentEncoding: 0x6240,
  ContentEncodingScope: 0x5032,
  ContentEncodingType: 0x5033,
  ContentCompression: 0x5034,
  ContentCompAlgo: 0x4254,
  ContentCompSettings: 0x4255,
  Cluster: 0x1f43b675,
  Timestamp: 0xe7,
  SimpleBlock: 0xa3,
  BlockGroup: 0xa0,
  Block: 0xa1,
  BlockDuration: 0x9b,
} as const;

// 크기를 모르는 Cluster는 다음 최상위 요소가 나올 때 끝납니다.
const TOP_LEVEL = new Set([ID.Cluster, ID.Info, ID.Tracks, 0x1c53bb6b, 0x1254c367, 0x1043a770, 0x1941a469, 0x114d9b74]);

const MKV_SOURCES: Record<string, SubtitleSource> = {
  "S_TEXT/UTF8": "srt",
  "S_TEXT/ASCII": "srt",
  "S_TEXT/ASS": "ass",
  "S_TEXT/SSA": "ass",
  S_ASS: "ass",
  S_SSA: "ass",
  "S_TEXT/WEBVTT": "vtt",
  "D_WEBVTT/SUBTITLES": "vtt",
  "D_WEBVTT/CAPTIONS": "vtt",
  "D_WEBVTT/DESCRIPTIONS": "vtt",
};

type Header = { id: number; size: number; len: number }; // size가 -1이면 크기를 모름

// EBML 가변 길이 정수. 첫 바이트 앞쪽 0의 개수로 길이를 정합니다.
function vint(b: Uint8Array, at: number, keepMarker: boolean): { value: number; len: number; unknown: boolean } | null {
  const first = b[at];
  if (first === undefined || first === 0) return null;
  const len = Math.clz32(first) - 23;
  if (at + len > b.length) return null;
  let value = keepMarker ? first : first & (0xff >> len);
  let allOnes = value === (0xff >> len);
  for (let i = 1; i < len; i++) {
    value = value * 256 + b[at + i];
    if (b[at + i] !== 0xff) allOnes = false;
  }
  return { value, len, unknown: !keepMarker && allOnes };
}

function header(b: Uint8Array, at: number): Header | null {
  const id = vint(b, at, true);
  if (!id || id.len > 4) return null;
  const size = vint(b, at + id.len, false);
  if (!size) return null;
  return { id: id.value, size: size.unknown ? -1 : size.value, len: id.len + size.len };
}

// 메모리에 올린 요소 안의 자식 요소들
function* children(b: Uint8Array, start = 0, end = b.length): Generator<{ id: number; data: Uint8Array }> {
  let p = start;
  while (p < end) {
    const h = header(b, p);
    if (!h || h.size < 0) return;
    const dataStart = p + h.len;
    yield { id: h.id, data: b.subarray(dataStart, Math.min(end, dataStart + h.size)) };
    p = dataStart + h.size;
  }
}

const uint = (b: Uint8Array) => b.reduce((v, x) => v * 256 + x, 0);

type MkvTrack = {
  track: SubtitleTrack;
  defaultDuration?: number;
  decode: (b: Uint8Array) => Promise<Uint8Array>;
};

async function inflate(b: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([b as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// 압축(zlib)이나 머리 바이트 생략으로 저장된 블록을 원래대로 돌립니다.
function contentDecoder(encodings: Uint8Array | undefined): { frames: (b: Uint8Array) => Promise<Uint8Array>; priv: (b: Uint8Array) => Promise<Uint8Array>; ok: boolean } {
  const steps: { scope: number; fn: (b: Uint8Array) => Promise<Uint8Array> }[] = [];
  let ok = true;
  if (encodings) {
    for (const enc of children(encodings)) {
      if (enc.id !== ID.ContentEncoding) continue;
      let scope = 1;
      let type = 0;
      let algo = 0;
      let settings: Uint8Array = new Uint8Array(0);
      for (const c of children(enc.data)) {
        if (c.id === ID.ContentEncodingScope) scope = uint(c.data);
        if (c.id === ID.ContentEncodingType) type = uint(c.data);
        if (c.id === ID.ContentCompression)
          for (const cc of children(c.data)) {
            if (cc.id === ID.ContentCompAlgo) algo = uint(cc.data);
            if (cc.id === ID.ContentCompSettings) settings = cc.data;
          }
      }
      if (type !== 0 || (algo !== 0 && algo !== 3)) ok = false; // 암호화·다른 압축 방식은 풀 수 없음
      const prefix = settings;
      steps.push({ scope, fn: algo === 3 ? async (b) => concat(prefix, b) : inflate });
    }
  }
  // 실제 파일은 거의 한 겹(zlib 또는 머리 바이트 생략)이라 적힌 순서대로 풉니다.
  const run = (bit: number) => async (b: Uint8Array) => {
    for (const s of steps) if (s.scope & bit) b = await s.fn(b);
    return b;
  };
  return { frames: run(1), priv: run(2), ok };
}

function concat(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

async function parseTrackEntry(entry: Uint8Array): Promise<MkvTrack | null> {
  const f: Record<number, Uint8Array> = {};
  for (const c of children(entry)) f[c.id] = c.data;
  if (!f[ID.TrackType] || uint(f[ID.TrackType]) !== 0x11) return null;
  const codec = f[ID.CodecID] ? decodeText(f[ID.CodecID]) : "";
  const dec = contentDecoder(f[ID.ContentEncodings]);
  const source = dec.ok ? MKV_SOURCES[codec] ?? null : null;
  const track: SubtitleTrack = {
    number: f[ID.TrackNumber] ? uint(f[ID.TrackNumber]) : 0,
    codec,
    source,
    language: f[ID.LanguageBCP47] ? decodeText(f[ID.LanguageBCP47]) : f[ID.Language] ? decodeText(f[ID.Language]) : "eng",
    name: f[ID.Name] ? decodeText(f[ID.Name]) : "",
    isDefault: f[ID.FlagDefault] ? uint(f[ID.FlagDefault]) === 1 : true,
    forced: f[ID.FlagForced] ? uint(f[ID.FlagForced]) === 1 : false,
    cues: [],
  };
  if (source === "ass" && f[ID.CodecPrivate]) track.assHeader = decodeText(await dec.priv(f[ID.CodecPrivate]));
  const dd = f[ID.DefaultDuration] ? uint(f[ID.DefaultDuration]) / 1e9 : undefined;
  return { track, defaultDuration: dd, decode: dec.frames };
}

function mkvCue(source: SubtitleSource, text: string, start: number, end: number): SubtitleCue {
  if (source !== "ass") return { start, end, text };
  // ASS 블록: ReadOrder, Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text
  const parts = text.split(",");
  const fields = parts.slice(1, 8);
  return { start, end, text: parts.slice(8).join(","), ass: { fields, order: Number(parts[0]) || 0 } };
}

async function readMatroska(r: ByteReader, onProgress: Progress, signal?: AbortSignal): Promise<SubtitleTrack[]> {
  let pos = 0;
  let segEnd = r.size;
  // EBML 머리 다음의 Segment를 찾습니다.
  for (;;) {
    const h = header(await r.bytes(pos, 16), 0);
    if (!h) throw new Error("broken");
    if (h.id === ID.Segment) {
      if (h.size >= 0) segEnd = Math.min(r.size, pos + h.len + h.size);
      pos += h.len;
      break;
    }
    if (h.size < 0) throw new Error("broken");
    pos += h.len + h.size;
  }

  let scale = 1_000_000; // 기본 1ms
  let tracks: Map<number, MkvTrack> | null = null;

  const block = async (data: Uint8Array, clusterTs: number, duration: number | null) => {
    const tn = vint(data, 0, false);
    if (!tn || !tracks) return;
    const t = tracks.get(tn.value);
    if (!t || !t.track.source || data.length < tn.len + 3) return;
    const rel = (data[tn.len] << 24) >> 16 | data[tn.len + 1]; // 부호 있는 16비트
    const lacing = (data[tn.len + 2] >> 1) & 3;
    if (lacing) return; // 글 자막에는 쓰이지 않음
    const payload = await t.decode(data.subarray(tn.len + 3));
    const start = ((clusterTs + rel) * scale) / 1e9;
    const end = duration === null ? NaN : start + (duration * scale) / 1e9;
    t.track.cues.push(mkvCue(t.track.source, decodeText(payload), start, end));
  };

  // 트랙 번호만 먼저 보고, 자막 트랙의 블록만 통째로 읽습니다(영상·소리 블록은 건너뜀).
  const wanted = async (at: number) => {
    const tn = vint(await r.bytes(at, 8), 0, false);
    return !!tn && !!tracks?.get(tn.value)?.track.source;
  };

  while (pos < segEnd) {
    aborted(signal);
    const h = header(await r.bytes(pos, 16), 0);
    if (!h) break;
    const dataStart = pos + h.len;
    const dataEnd = h.size < 0 ? segEnd : Math.min(segEnd, dataStart + h.size);

    if (h.id === ID.Info) {
      for (const c of children(await r.bytes(dataStart, dataEnd - dataStart))) if (c.id === ID.TimestampScale) scale = uint(c.data) || scale;
    } else if (h.id === ID.Tracks) {
      tracks = new Map();
      for (const c of children(await r.bytes(dataStart, dataEnd - dataStart))) {
        if (c.id !== ID.TrackEntry) continue;
        const t = await parseTrackEntry(c.data);
        if (t) tracks.set(t.track.number, t);
      }
      // 꺼낼 수 있는 자막이 없으면 나머지(영상 데이터)를 읽을 필요가 없습니다.
      if (![...tracks.values()].some((t) => t.track.source)) break;
    } else if (h.id === ID.Cluster) {
      let clusterTs = 0;
      let p = dataStart;
      while (p < dataEnd) {
        const ch = header(await r.bytes(p, 16), 0);
        if (!ch || (h.size < 0 && TOP_LEVEL.has(ch.id as never))) break;
        const cStart = p + ch.len;
        const cEnd = ch.size < 0 ? dataEnd : cStart + ch.size;
        if (ch.id === ID.Timestamp) clusterTs = uint(await r.bytes(cStart, ch.size));
        else if (ch.id === ID.SimpleBlock) {
          if (await wanted(cStart)) await block(await r.bytes(cStart, ch.size), clusterTs, null);
        } else if (ch.id === ID.BlockGroup) {
          let blk: Uint8Array | null = null;
          let dur: number | null = null;
          let q = cStart;
          while (q < cEnd) {
            const gh = header(await r.bytes(q, 16), 0);
            if (!gh || gh.size < 0) break;
            const gStart = q + gh.len;
            if (gh.id === ID.Block) {
              if (!(await wanted(gStart))) break;
              blk = (await r.bytes(gStart, gh.size)).slice();
            } else if (gh.id === ID.BlockDuration) dur = uint(await r.bytes(gStart, gh.size));
            q = gStart + gh.size;
          }
          if (blk) await block(blk, clusterTs, dur);
        }
        p = cEnd;
      }
      pos = p;
      onProgress(pos / r.size);
      continue;
    } else if (h.size < 0) break;
    pos = dataEnd;
  }

  return [...(tracks?.values() ?? [])].map((t) => ({ ...t.track, cues: finishCues(t.track.cues, t.defaultDuration) }));
}

/* ───────────── MP4·MOV ───────────── */

type Box = { type: string; data: Uint8Array };

const be32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const be16 = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const be64 = (b: Uint8Array, at: number) => be32(b, at) * 2 ** 32 + be32(b, at + 4);
const fourcc = (b: Uint8Array, at: number) => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);

function* boxes(b: Uint8Array, start = 0, end = b.length): Generator<Box> {
  let p = start;
  while (p + 8 <= end) {
    let size = be32(b, p);
    const type = fourcc(b, p + 4);
    let hl = 8;
    if (size === 1) {
      size = be64(b, p + 8);
      hl = 16;
    } else if (size === 0) size = end - p;
    if (size < hl) return;
    yield { type, data: b.subarray(p + hl, Math.min(end, p + size)) };
    p += size;
  }
}

const child = (b: Uint8Array, type: string, skip = 0) => {
  for (const x of boxes(b, skip)) if (x.type === type) return x.data;
  return null;
};
const path = (b: Uint8Array | null, ...types: string[]) => types.reduce<Uint8Array | null>((cur, t) => (cur ? child(cur, t) : null), b);

// ISO 639-2 코드를 5비트 글자 세 개로 묶은 값(mdhd)
const packedLanguage = (v: number) =>
  v === 0 || v === 0x7fff ? "und" : String.fromCharCode(((v >> 10) & 31) + 0x60, ((v >> 5) & 31) + 0x60, (v & 31) + 0x60);

const MP4_SOURCES: Record<string, SubtitleSource> = { tx3g: "tx3g", text: "tx3g", wvtt: "vtt" };
const SUBTITLE_HANDLERS = new Set(["text", "sbtl", "subt", "clcp"]);
const MOOV_MAX = 256 << 20;

type Sample = { offset: number; size: number; start: number; end: number };

// 표(stts·stsc·stsz·stco)로 각 샘플의 위치와 시간을 계산합니다.
function sampleTable(stbl: Uint8Array, timescale: number): Sample[] {
  const stts = child(stbl, "stts");
  const stsc = child(stbl, "stsc");
  const stsz = child(stbl, "stsz");
  const stz2 = child(stbl, "stz2");
  const stco = child(stbl, "stco");
  const co64 = child(stbl, "co64");
  if (!stts || !stsc || (!stsz && !stz2) || (!stco && !co64)) return [];

  const sizes: number[] = [];
  if (stsz) {
    const fixed = be32(stsz, 4);
    const count = be32(stsz, 8);
    for (let i = 0; i < count; i++) sizes.push(fixed || be32(stsz, 12 + i * 4));
  } else if (stz2) {
    const bits = stz2[7];
    const count = be32(stz2, 8);
    for (let i = 0; i < count; i++)
      sizes.push(bits === 8 ? stz2[12 + i] : bits === 16 ? be16(stz2, 12 + i * 2) : (stz2[12 + (i >> 1)] >> (i & 1 ? 0 : 4)) & 15);
  }

  const chunks: number[] = [];
  if (stco) for (let i = 0, n = be32(stco, 4); i < n; i++) chunks.push(be32(stco, 8 + i * 4));
  else if (co64) for (let i = 0, n = be32(co64, 4); i < n; i++) chunks.push(be64(co64, 8 + i * 8));

  const samples: Sample[] = [];
  const runs = be32(stsc, 4);
  let s = 0;
  for (let i = 0; i < runs; i++) {
    const first = be32(stsc, 8 + i * 12) - 1;
    const perChunk = be32(stsc, 12 + i * 12);
    const last = i + 1 < runs ? be32(stsc, 8 + (i + 1) * 12) - 1 : chunks.length;
    for (let c = first; c < last && c < chunks.length; c++) {
      let off = chunks[c];
      for (let k = 0; k < perChunk && s < sizes.length; k++, s++) {
        samples.push({ offset: off, size: sizes[s], start: 0, end: 0 });
        off += sizes[s];
      }
    }
  }

  let t = 0;
  let idx = 0;
  for (let i = 0, n = be32(stts, 4); i < n; i++) {
    const count = be32(stts, 8 + i * 8);
    const delta = be32(stts, 12 + i * 8);
    for (let k = 0; k < count && idx < samples.length; k++, idx++) {
      samples[idx].start = t / timescale;
      t += delta;
      samples[idx].end = t / timescale;
    }
  }
  return samples.slice(0, idx);
}

// tx3g: 앞 2바이트가 글 길이, 그 뒤 글(UTF-8, BOM이 있으면 UTF-16), 나머지는 꾸밈 정보
function tx3gText(b: Uint8Array) {
  if (b.length < 2) return "";
  const text = b.subarray(2, 2 + be16(b, 0));
  if (text[0] === 0xfe && text[1] === 0xff) return new TextDecoder("utf-16be").decode(text.subarray(2));
  return decodeText(text);
}

// wvtt: vttc 상자 하나가 자막 하나(겹치는 자막은 여러 개), vtte는 빈 구간
function wvttTexts(b: Uint8Array) {
  const out: string[] = [];
  for (const x of boxes(b)) {
    if (x.type !== "vttc") continue;
    const payl = child(x.data, "payl");
    if (payl) out.push(decodeText(payl));
  }
  return out;
}

async function readMp4(r: ByteReader, onProgress: Progress, signal?: AbortSignal): Promise<SubtitleTrack[]> {
  // 최상위 상자의 머리만 읽으며 moov를 찾습니다(파일 끝에 있는 경우가 많음).
  let pos = 0;
  let moov: Uint8Array | null = null;
  while (pos + 8 <= r.size) {
    const h = await r.exact(pos, 16);
    let size = be32(h, 0);
    const type = fourcc(h, 4);
    let hl = 8;
    if (size === 1) {
      size = be64(h, 8);
      hl = 16;
    } else if (size === 0) size = r.size - pos;
    if (size < hl) throw new Error("broken");
    if (type === "moov") {
      if (size > MOOV_MAX) throw new Error("moov-too-large");
      moov = await r.exact(pos + hl, size - hl);
      break;
    }
    pos += size;
  }
  if (!moov) throw new Error("broken");

  const found: { track: SubtitleTrack; samples: Sample[] }[] = [];
  for (const trak of boxes(moov)) {
    if (trak.type !== "trak") continue;
    const mdia = child(trak.data, "mdia");
    const hdlr = path(mdia, "hdlr");
    const mdhd = path(mdia, "mdhd");
    const stbl = path(mdia, "minf", "stbl");
    if (!hdlr || !mdhd || !stbl || !SUBTITLE_HANDLERS.has(fourcc(hdlr, 8))) continue;
    const stsd = child(stbl, "stsd");
    const entry = stsd && stsd.length >= 16 ? fourcc(stsd, 12) : "";
    const tkhd = child(trak.data, "tkhd");
    const v1 = mdhd[0] === 1;
    const timescale = be32(mdhd, v1 ? 20 : 12) || 1000;
    const source = MP4_SOURCES[entry] ?? null;
    found.push({
      track: {
        number: tkhd ? be32(tkhd, tkhd[0] === 1 ? 20 : 12) : found.length + 1,
        codec: entry || fourcc(hdlr, 8),
        source,
        language: packedLanguage(be16(mdhd, v1 ? 32 : 20)),
        name: "",
        isDefault: tkhd ? (tkhd[3] & 1) === 1 : false,
        forced: false,
        cues: [],
      },
      samples: source ? sampleTable(stbl, timescale) : [],
    });
  }

  const total = found.reduce((n, f) => n + f.samples.length, 0);
  let done = 0;
  for (const { track, samples } of found) {
    for (const s of samples) {
      if (done++ % 50 === 0) {
        aborted(signal);
        onProgress(done / total);
      }
      if (!s.size) continue;
      const data = await r.exact(s.offset, s.size);
      const texts = track.source === "vtt" ? wvttTexts(data) : [tx3gText(data)];
      for (const text of texts) if (text) track.cues.push({ start: s.start, end: s.end, text });
    }
    track.cues = finishCues(track.cues);
  }
  return found.map((f) => f.track);
}
