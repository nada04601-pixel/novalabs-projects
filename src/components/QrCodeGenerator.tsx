"use client";
import { useEffect, useRef, useState } from "react";
import InfoTip from "@/components/InfoTip";
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
        <label><span className="lab">담을 주소나 글
          <InfoTip title="담을 주소나 글">
            웹사이트 주소(URL)를 넣으면 QR코드를 찍었을 때 그 페이지가 열립니다. <b>novalabs.co.kr</b>처럼 앞부분을 빼고 넣어도 https://를 자동으로 붙여 줍니다. 주소가 아닌 글을 넣으면 찍었을 때 글이 그대로 화면에 표시됩니다.
          </InfoTip></span>
          <textarea rows={3} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="https://example.com 또는 전하고 싶은 글" />
        </label>
      )}
      {kind === "wifi" && (
        <div className="fields">
          <label><span className="lab">네트워크 이름 (SSID)
            <InfoTip title="SSID(네트워크 이름)란?">
              SSID는 와이파이 목록에 보이는 <b>와이파이 이름</b>입니다. 예: iptime, KT_GiGA_5G, U+Net1234
              <span className="tip-list">
                <span>휴대폰이 그 와이파이에 연결돼 있다면 <b>설정 → Wi-Fi</b>에서 연결된 이름을 그대로 적으세요.</span>
                <span>공유기 바닥이나 뒷면 스티커의 <b>SSID</b> 또는 <b>네트워크 이름</b> 항목에도 적혀 있습니다.</span>
                <span>대소문자, 띄어쓰기, 밑줄(_)까지 똑같이 적어야 합니다.</span>
                <span>이름 끝에 _5G가 붙은 것과 안 붙은 것이 따로 있다면 손님이 쓸 쪽 하나를 고르세요.</span>
              </span>
            </InfoTip></span>
            <input value={ssid} maxLength={32} onChange={(e) => setSsid(e.target.value)} />
          </label>
          <label><span className="lab">보안 방식
            <InfoTip title="보안 방식 고르기">
              와이파이 비밀번호를 지키는 암호화 방식입니다. 요즘 공유기는 거의 모두 <b>WPA/WPA2/WPA3</b>이니, 잘 모르겠다면 그대로 두세요.
              <span className="tip-list">
                <span><b>WEP</b>: 10년 이상 된 공유기에서만 쓰는 오래된 방식입니다.</span>
                <span><b>암호 없음</b>: 비밀번호 없이 누구나 접속하는 와이파이일 때 고릅니다.</span>
              </span>
            </InfoTip></span>
            <select value={sec} onChange={(e) => setSec(e.target.value as WifiSecurity)}>
              <option value="WPA">WPA/WPA2/WPA3</option>
              <option value="WEP">WEP</option>
              <option value="nopass">암호 없음</option>
            </select>
          </label>
          {sec !== "nopass" && (
            <label><span className="lab">비밀번호
              <InfoTip title="와이파이 비밀번호">
                와이파이에 접속할 때 넣는 비밀번호입니다. 공유기 스티커에 <b>비밀번호</b>, <b>Password</b>, <b>WPA Key</b>, <b>무선 키</b> 등으로 적혀 있습니다. 대소문자를 구분하니 정확히 적어 주세요. QR코드를 찍은 사람은 비밀번호를 볼 수 있으니, 가능하면 손님용 와이파이를 따로 만들어 쓰세요.
              </InfoTip></span>
              <input value={wpass} maxLength={63} onChange={(e) => setWpass(e.target.value)} />
            </label>
          )}
          <label className="inline">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
            숨겨진 네트워크
            <InfoTip title="숨겨진 네트워크란?">
              공유기 설정에서 이름을 숨겨 와이파이 목록에 나타나지 않는 네트워크입니다. 휴대폰 와이파이 목록에 이름이 보인다면 <b>체크하지 마세요</b>. 목록에 없는데 이름을 직접 입력해서 접속하는 경우에만 체크합니다.
            </InfoTip>
          </label>
        </div>
      )}
      {(kind === "tel" || kind === "sms") && (
        <div className="fields">
          <label><span className="lab">전화번호
            <InfoTip title="전화·문자 QR코드">
              {kind === "tel" ? "QR코드를 찍으면 이 번호로 전화 걸기 화면이 열립니다. 바로 전화가 걸리지는 않고, 찍은 사람이 통화 버튼을 눌러야 걸립니다." : "QR코드를 찍으면 받는 사람 번호와 미리 적은 내용이 채워진 문자 화면이 열립니다. 찍은 사람이 전송을 눌러야 보내집니다."}{" "}
              하이픈(-)이나 띄어쓰기는 넣어도 자동으로 빠집니다.
            </InfoTip></span>
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
        <label><span className="lab">오류 복원 수준
          <InfoTip title="오류 복원 수준이란?">
            QR코드 일부가 가려지거나 더러워져도 읽힐 수 있게 넣는 여유분입니다. 높을수록 튼튼하지만 점이 촘촘해집니다.
            <span className="tip-list">
              <span><b>보통</b>: 화면, 실내 인쇄물에 알맞습니다(기본값).</span>
              <span><b>높음</b> 이상: 야외 게시물, 스티커처럼 긁히거나 젖을 수 있는 곳에 권합니다.</span>
              <span><b>낮음</b>: 내용이 길어 QR코드가 너무 촘촘할 때 씁니다.</span>
            </span>
          </InfoTip></span>
          <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
            {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
          </select>
        </label>
        <label><span className="lab">크기 (PNG)
          <InfoTip title="이미지 크기">
            PNG 이미지의 가로·세로 픽셀 수입니다. 화면이나 메신저에 올릴 때는 512px, 포스터처럼 크게 인쇄할 때는 1024px을 고르세요. 아주 크게 인쇄하거나 디자인 프로그램에서 쓸 때는 크기와 상관없이 선명한 <b>SVG 내려받기</b>를 권합니다.
          </InfoTip></span>
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
