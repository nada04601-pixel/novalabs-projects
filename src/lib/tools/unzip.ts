// ZIP 파일을 풉니다(HWPX·DOCX처럼 ZIP 안에 XML이 든 문서용). 압축 해제는 브라우저 내장 DecompressionStream을 씁니다.
// 저장(0)·deflate(8) 방식만 지원하고, 암호가 걸린 항목은 건너뜁니다.

export class ZipError extends Error {}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unzip(buf: ArrayBuffer | Uint8Array): Promise<Map<string, Uint8Array>> {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  // 끝에서부터 중앙 디렉터리 끝 표시(EOCD)를 찾습니다. 뒤에 주석이 붙을 수 있어 최대 64KiB 앞까지 봅니다.
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new ZipError("ZIP 파일이 아닙니다");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) throw new ZipError("ZIP 목록이 손상됐습니다");
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/") || flags & 1) continue;
    if (dv.getUint32(local, true) !== 0x04034b50) throw new ZipError("ZIP 항목이 손상됐습니다");
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const raw = u8.subarray(start, start + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, await inflateRaw(raw));
  }
  return out;
}
