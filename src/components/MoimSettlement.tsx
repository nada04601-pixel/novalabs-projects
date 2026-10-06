"use client";
import { useEffect, useMemo, useState } from "react";
import { ceil100, settle } from "@/lib/calculators/settlement";
import {
  decodeState,
  emptyRound,
  encodeState,
  MOIM_LIMITS,
  removeMember,
  sampleState,
  type MoimRound,
  type MoimState,
} from "@/lib/moimState";
import { num, won } from "@/lib/format";

const sentKey = (from: string, to: string) => `${from}→${to}`;

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("아래 내용을 복사하세요", text);
    return false;
  }
}

export default function MoimSettlement() {
  const [s, setS] = useState<MoimState>(sampleState);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [notice, setNotice] = useState("");

  // 링크(#d=...)에 담긴 정산이 있으면 불러옵니다.
  useEffect(() => {
    const fromLink = decodeState(window.location.hash);
    if (fromLink) setS(fromLink);
    setLoaded(true);
  }, []);

  // 입력이 바뀔 때마다 주소에 반영해, 지금 주소가 곧 공유 링크가 되게 합니다.
  useEffect(() => {
    if (!loaded) return;
    window.history.replaceState(null, "", `#d=${encodeState(s)}`);
  }, [s, loaded]);

  const r = useMemo(() => settle(s.members.length, s.rounds), [s.members.length, s.rounds]);
  const name = (i: number) => s.members[i] || `참여자 ${i + 1}`;
  const shown = (v: number) => (s.round100 ? ceil100(v) : v);
  const unpaid = r.transfers.filter((t) => !s.sent.includes(sentKey(name(t.from), name(t.to))));

  const update = (patch: Partial<MoimState>) => setS((prev) => ({ ...prev, ...patch }));
  const updateRound = (k: number, patch: Partial<MoimRound>) =>
    setS((prev) => ({ ...prev, rounds: prev.rounds.map((x, i) => (i === k ? { ...x, ...patch } : x)) }));
  const toggle = (list: number[], i: number) => (list.includes(i) ? list.filter((x) => x !== i) : [...list, i].sort((a, b) => a - b));

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 2000);
  };

  const addMember = () => {
    const v = newName.trim().slice(0, 20);
    if (!v || s.members.includes(v) || s.members.length >= MOIM_LIMITS.members) return;
    const idx = s.members.length;
    setS((prev) => ({
      ...prev,
      members: [...prev.members, v],
      rounds: prev.rounds.map((x) => ({ ...x, attendees: [...x.attendees, idx], payer: x.payer < 0 ? idx : x.payer })),
    }));
    setNewName("");
  };

  const summaryText = () => {
    const lines = [`[${s.title || "모임"}] 정산 안내`, ""];
    s.rounds.forEach((x, i) => lines.push(`${i + 1}차 ${x.place || ""} ${won(x.amount)} (결제: ${x.payer >= 0 ? name(x.payer) : "-"})`));
    lines.push("", "보낼 돈");
    r.transfers.forEach((t) => lines.push(`· ${name(t.from)} → ${name(t.to)} ${won(shown(t.amount))}`));
    if (s.bank) lines.push("", `받는 곳: ${s.bank}`);
    lines.push("", `정산 내역: ${window.location.href}`);
    return lines.join("\n");
  };

  const reminderText = () => {
    const lines = [`[${s.title || "모임"}] 아직 정산이 안 된 분들께 알려드려요 🙏`, ""];
    unpaid.forEach((t) => lines.push(`· ${name(t.from)} → ${name(t.to)} ${won(shown(t.amount))}`));
    if (s.bank) lines.push("", `받는 곳: ${s.bank}`);
    lines.push("", `보낸 뒤 링크에서 '보냈어요'를 눌러 주세요: ${window.location.href}`);
    return lines.join("\n");
  };

  return (
    <div className="calc moim">
      <div className="actions top">
        <button
          type="button"
          className="link"
          onClick={() => setS({ title: "", bank: "", members: [], rounds: [emptyRound(0)], sent: [], round100: false })}
        >
          예시 지우고 새로 시작
        </button>
      </div>
      <h3>1. 모임 정보</h3>
      <div className="fields">
        <label>모임 이름
          <input value={s.title} maxLength={40} onChange={(e) => update({ title: e.target.value })} />
        </label>
        <label>받을 계좌 또는 송금 링크 (선택)
          <input value={s.bank} maxLength={80} placeholder="예: 토스뱅크 1000-0000-0000 홍길동" onChange={(e) => update({ bank: e.target.value })} />
        </label>
      </div>

      <h3>2. 참여자</h3>
      <div className="chips">
        {s.members.map((m, i) => (
          <span key={`${m}-${i}`} className="chip">
            {m}
            <button type="button" aria-label={`${m} 삭제`} onClick={() => setS((prev) => removeMember(prev, i))}>×</button>
          </span>
        ))}
      </div>
      <div className="row">
        <input
          value={newName}
          maxLength={20}
          placeholder="이름 또는 닉네임"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addMember()}
        />
        <button type="button" className="btn sm" onClick={addMember}>추가</button>
      </div>

      <h3>3. 차수별 결제</h3>
      {s.rounds.map((x, k) => (
        <fieldset key={k} className="round">
          <legend>{k + 1}차</legend>
          <div className="fields">
            <label>장소
              <input value={x.place} maxLength={30} onChange={(e) => updateRound(k, { place: e.target.value })} />
            </label>
            <label>결제 금액 (원)
              <input inputMode="numeric" value={x.amount ? x.amount.toLocaleString("ko-KR") : ""} onChange={(e) => updateRound(k, { amount: Math.min(num(e.target.value), 100_000_000) })} />
            </label>
            <label>그중 술값 (선택)
              <input inputMode="numeric" value={x.alcohol ? x.alcohol.toLocaleString("ko-KR") : ""} onChange={(e) => updateRound(k, { alcohol: Math.min(num(e.target.value), x.amount) })} />
            </label>
            <label>결제한 사람
              <select value={x.payer} onChange={(e) => updateRound(k, { payer: Number(e.target.value) })}>
                {x.payer < 0 && <option value={-1}>선택하세요</option>}
                {s.members.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </label>
          </div>
          <table className="attend">
            <thead><tr><th>참여자</th><td>참석</td><td>술</td></tr></thead>
            <tbody>
              {s.members.map((m, i) => (
                <tr key={i}>
                  <th>{m}</th>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${m} ${k + 1}차 참석`}
                      checked={x.attendees.includes(i)}
                      onChange={() => {
                        const attendees = toggle(x.attendees, i);
                        updateRound(k, { attendees, drinkers: x.drinkers.filter((d) => attendees.includes(d)) });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${m} ${k + 1}차 음주`}
                      disabled={!x.attendees.includes(i)}
                      checked={x.drinkers.includes(i)}
                      onChange={() => updateRound(k, { drinkers: toggle(x.drinkers, i) })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {x.alcohol > 0 && x.drinkers.length === 0 && <p className="warn">술 마신 사람을 체크하지 않으면 술값도 참석자 전원이 나눕니다.</p>}
          {x.payer < 0 && <p className="warn">결제한 사람을 골라 주세요. 고르기 전에는 이 차수가 정산에서 빠집니다.</p>}
          <button
            type="button"
            className="link"
            onClick={() => setS((prev) => ({ ...prev, rounds: prev.rounds.filter((_, i) => i !== k) }))}
          >
            {k + 1}차 삭제
          </button>
        </fieldset>
      ))}
      {s.rounds.length < MOIM_LIMITS.rounds && (
        <button type="button" className="btn sm" onClick={() => update({ rounds: [...s.rounds, emptyRound(s.members.length)] })}>
          + {s.rounds.length + 1}차 추가
        </button>
      )}

      <h3>4. 정산 결과</h3>
      <div className="result" aria-live="polite">
        <div className="big">
          <span>총 결제 금액</span>
          <strong>{won(r.total)}</strong>
          <small>송금 {r.transfers.length}건 · 남은 송금 {unpaid.length}건</small>
        </div>
        <div className="scroll">
          <table>
            <thead><tr><th>참여자</th><td>부담액</td><td>결제액</td><td>받을/낼 돈</td></tr></thead>
            <tbody>
              {s.members.map((m, i) => (
                <tr key={i}>
                  <th>{m}</th>
                  <td>{won(r.share[i])}</td>
                  <td>{won(r.paid[i])}</td>
                  <td>{r.balance[i] > 0 ? `+${won(r.balance[i])}` : r.balance[i] < 0 ? `−${won(-r.balance[i])}` : "0원"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>보낼 돈</h3>
        {r.transfers.length === 0 ? (
          <p className="note">보낼 돈이 없습니다. 차수와 결제 금액을 입력해 주세요.</p>
        ) : (
          <ul className="transfers">
            {r.transfers.map((t) => {
              const key = sentKey(name(t.from), name(t.to));
              const done = s.sent.includes(key);
              return (
                <li key={key} className={done ? "done" : ""}>
                  <span>{name(t.from)} → {name(t.to)}</span>
                  <strong>{won(shown(t.amount))}</strong>
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => update({ sent: done ? s.sent.filter((x) => x !== key) : [...s.sent, key] })}
                    />
                    보냈어요
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <label className="inline">
          <input type="checkbox" checked={s.round100} onChange={(e) => update({ round100: e.target.checked })} />
          송금액을 100원 단위로 올려 표시
        </label>

        <div className="actions">
          <button type="button" className="btn sm" onClick={async () => (await copy(window.location.href)) && flash("링크를 복사했어요")}>
            정산 링크 복사
          </button>
          <button type="button" className="btn sm" onClick={async () => (await copy(summaryText())) && flash("정산 안내를 복사했어요")}>
            정산 안내 복사
          </button>
          <button
            type="button"
            className="btn sm"
            disabled={unpaid.length === 0}
            onClick={async () => (await copy(reminderText())) && flash("재촉 메시지를 복사했어요")}
          >
            미입금 재촉 메시지 복사
          </button>
        </div>
        {notice && <p className="note" role="status">{notice}</p>}
        <p className="note">
          입력한 내용은 서버에 저장되지 않고 이 링크 안에만 담깁니다. &apos;보냈어요&apos; 표시도 링크를 연 기기에서만 바뀌므로, 표시한 뒤 정산 링크를 다시 복사해 단톡방에 올려 주세요.
        </p>
      </div>
    </div>
  );
}
