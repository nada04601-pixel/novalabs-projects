// QR코드에 담을 문자열 만들기와 색 대비 확인

// Wi-Fi QR 형식에서 특수문자(\ ; , : ")는 앞에 \를 붙여야 합니다.
const esc = (s: string) => s.replace(/([\;,:"])/g, "\\$1");

export type WifiSecurity = "WPA" | "WEP" | "nopass";

export function wifiPayload(ssid: string, password: string, security: WifiSecurity, hidden: boolean): string {
  const parts = [`T:${security}`, `S:${esc(ssid)}`];
  if (security !== "nopass") parts.push(`P:${esc(password)}`);
  if (hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

export const telPayload = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, "")}`;

export function smsPayload(phone: string, body: string): string {
  const p = phone.replace(/[^0-9+]/g, "");
  return body ? `SMSTO:${p}:${body}` : `SMSTO:${p}`;
}

// 주소처럼 보이는데 http(s)://가 없으면 붙여 줍니다. 그 밖의 글은 그대로 둡니다.
export function normalizeUrlOrText(v: string): string {
  const s = v.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return `https://${s}`;
  return s;
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

// WCAG 대비율(1~21). QR은 점이 배경보다 어둡고 대비가 클수록 잘 읽힙니다.
export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export const isInverted = (fg: string, bg: string) => luminance(fg) > luminance(bg);
