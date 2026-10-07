"use client";
import { useEffect, useRef, useState } from "react";
import { contrastRatio, isInverted, normalizeUrlOrText, smsPayload, telPayload, wifiPayload, type WifiSecurity } from "@/lib/tools/qr";

type Kind = "text" | "wifi" | "tel" | "sms";
const KINDS: { v: Kind; label: string }[] = [
  { v: "text", label: "주소·글" },
  { v: "wifi", label: "와이파이" },
  { v: "tel", label: "전화" },
  { v: "sms", label: "문자" },
];
const LEVELS = [
  { v: "L", label: "낮음 (7%)" },
  { v: "M", label: "보통 (15%)" },
  { v: "Q", label: "높음 (25%)" },
  { v: "H", label: "매우 높음 (30%)" },
] as const;

// QR 라이브러리는 이 도구를 열었을 때만 내려받습니다(다른 계산기 페이지를 가볍게 유지).
const lib = () => import("qrcode").then((m) => m.default);

function download(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

export default function QrCodeGenerator() {
  const [kind, setKind] = useState<Kind>("text");
  const [text, setText] = useState("https://novalabs.co.kr");
  const [ssid, setSsid] = useState("");
  const [wpass, setWpass] = useState("");
  const [sec, setSec] = useState<WifiSecurity>("WPA");
  const [hidden, setHidden] = useState(false);
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]["v"]>("M");
  const [size, setSize] = useState(512);
  const [fg, setFg] = useState("#111827");
  const [bg, setBg] = useState("#ffffff");
  const [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);

  const payload =
    kind === "text" ? normalizeUrlOrText(text)
    : kind === "wifi" ? (ssid ? wifiPayload(ssid, wpass, sec, hidden) : "")
    : kind === "tel" ? (phone.replace(/[^0-9+]/g, "") ? telPayload(phone) : "")
    : phone.replace(/[^0-9+]/g, "") ? smsPayload(phone, msg) : "";

  const opts = { errorCorrectionLevel: level, margin: 2, width: size, color: { dark: fg, light: bg } };

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    if (!payload) {
      c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
      setError("");
      return;
    }
    lib()
      .then((QRCode) => QRCode.toCanvas(c, payload, opts))
      .then(() => setError(""))
      .catch(() => setError("내용이 너무 길어 QR코드에 담을 수 없습니다. 글을 줄이거나 오류 복원 수준을 낮춰 보세요."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, level, size, fg, bg]);

  const ratio = contrastRatio(fg, bg);
  const ready = payload && !error;
  const base = kind === "wifi" ? "wifi-qr" : "qrcode";

  return (
    <div className="calc">
      <div className="seg" role="group" aria-label="QR코드 종류">
        {KINDS.map((k) => (
          <button key={k.v} type="button" aria-pressed={kind === k.v} onClick={() => setKind(k.v)}>{k.label}</button>
        ))}
      </div>

      {kind === "text" && (
        <label>담을 주소나 글
          <textarea rows={3} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="https://example.com 또는 전하고 싶은 글" />
        </label>
      )}
      {kind === "wifi" && (
        <div className="fields">
          <label>네트워크 이름 (SSID)
            <input value={ssid} maxLength={32} onChange={(e) => setSsid(e.target.value)} />
          </label>
          <label>보안 방식
            <select value={sec} onChange={(e) => setSec(e.target.value as WifiSecurity)}>
              <option value="WPA">WPA/WPA2/WPA3</option>
              <option value="WEP">WEP</option>
              <option value="nopass">암호 없음</option>
            </select>
          </label>
          {sec !== "nopass" && (
            <label>비밀번호
              <input value={wpass} maxLength={63} onChange={(e) => setWpass(e.target.value)} />
            </label>
          )}
          <label className="inline">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
            숨겨진 네트워크
          </label>
        </div>
      )}
      {(kind === "tel" || kind === "sms") && (
        <div className="fields">
          <label>전화번호
            <input inputMode="tel" value={phone} maxLength={20} placeholder="010-1234-5678" onChange={(e) => setPhone(e.target.value)} />
          </label>
          {kind === "sms" && (
            <label>미리 적어 둘 문자 (선택)
              <input value={msg} maxLength={160} onChange={(e) => setMsg(e.target.value)} />
            </label>
          )}
        </div>
      )}

      <h3 className="sub">모양</h3>
      <div className="fields">
        <label>오류 복원 수준
          <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
            {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
          </select>
        </label>
        <label>크기 (PNG)
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[256, 512, 1024].map((n) => <option key={n} value={n}>{n} × {n}px</option>)}
          </select>
        </label>
        <label>점 색
          <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} />
        </label>
        <label>배경 색
          <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
        </label>
      </div>

      <div className="result" aria-live="polite">
        {error && <p className="warn">{error}</p>}
        {!payload && <p className="note">내용을 입력하면 QR코드가 바로 만들어집니다.</p>}
        {payload && (isInverted(fg, bg) || ratio < 4) && (
          <p className="warn">점 색이 배경보다 밝거나 대비가 약하면 일부 카메라가 읽지 못합니다. 어두운 점 색과 밝은 배경을 권장합니다.</p>
        )}
        <div className="qrbox" hidden={!ready}>
          <canvas ref={canvas} role="img" aria-label="만든 QR코드" />
        </div>
        {ready && (
          <div className="actions">
            <button type="button" className="btn sm" onClick={() => canvas.current && download(canvas.current.toDataURL("image/png"), `${base}.png`)}>
              PNG 내려받기
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={async () => {
                const svg = await (await lib()).toString(payload, { ...opts, type: "svg" });
                const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
                download(url, `${base}.svg`);
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              SVG 내려받기
            </button>
          </div>
        )}
        <p className="note">QR코드는 이 브라우저 안에서 만들어지며, 입력한 주소나 와이파이 비밀번호는 서버로 보내지 않습니다. 인쇄하기 전에 휴대폰 카메라로 한 번 찍어 확인하세요.</p>
      </div>
    </div>
  );
}
