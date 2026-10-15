"use client";
import { useRef } from "react";
import { useT } from "@/lib/useT";

type DayChange = "23" | "00";

// 사주·궁합 계산기의 '날이 바뀌는 시각' 선택 칸. 옆의 안내 아이콘을 누르면 설명 팝업이 뜹니다.
export default function DayChangeField({ value, onChange }: { value: DayChange; onChange: (v: DayChange) => void }) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="field">
      <span className="field-head">
        <label htmlFor="day-change">{t("날이 바뀌는 시각", "When the day changes")}</label>
        <button type="button" className="info-btn" aria-label={t("날이 바뀌는 시각 설명 보기", "What does this mean?")} onClick={() => dialog.current?.showModal()}>?</button>
      </span>
      <select id="day-change" value={value} onChange={(e) => onChange(e.target.value as DayChange)}>
        <option value="23">{t("23시 (자시부터 다음 날)", "11 PM (next day from Ja hour)")}</option>
        <option value="00">{t("0시 (야자시 적용)", "Midnight (late Ja hour)")}</option>
      </select>
      <dialog ref={dialog} className="info-dialog" aria-labelledby="day-change-title" onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}>
        <h3 id="day-change-title">{t("날이 바뀌는 시각이란?", "When does the day change?")}</h3>
        <p>{t("자시(밤 11시~새벽 1시)가 자정에 걸쳐 있어서, 밤 11시~자정에 태어난 사람의 날짜를 보는 방식이 둘로 나뉩니다.", "The Ja hour (11 PM to 1 AM) straddles midnight, so there are two ways to date someone born between 11 PM and midnight.")}</p>
        <ul>
          <li><b>{t("23시", "11 PM")}</b>: {t("밤 11시부터 다음 날로 봅니다. 일주도 다음 날 것으로 잡습니다.", "The day changes at 11 PM, so the Day pillar is taken from the next day.")}</li>
          <li><b>{t("0시 (야자시)", "Midnight (late Ja hour)")}</b>: {t("자정까지는 태어난 날로 두고, 시주만 자시로 잡습니다.", "Until midnight it stays your birth date; only the Hour pillar is set to the Ja hour.")}</li>
        </ul>
        <p>{t("이 시간대에 태어나지 않았다면 어느 쪽을 골라도 결과가 같습니다. 태어난 곳을 고르면 경도 보정한 시각으로 판단해서, 서울은 시계로 밤 11시 30분쯤~새벽 0시 30분쯤이 해당됩니다.", "If you weren't born in this window, both options give the same result. With a place of birth chosen, the longitude-corrected time is used, so in Seoul it applies to clock times from about 11:30 PM to 12:30 AM.")}</p>
        <form method="dialog"><button className="btn">{t("닫기", "Close")}</button></form>
      </dialog>
    </div>
  );
}
