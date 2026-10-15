"use client";
import { useRef } from "react";

type DayChange = "23" | "00";

// 사주·궁합 계산기의 '날이 바뀌는 시각' 선택 칸. 옆의 안내 아이콘을 누르면 설명 팝업이 뜹니다.
export default function DayChangeField({ value, onChange }: { value: DayChange; onChange: (v: DayChange) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="field">
      <span className="field-head">
        <label htmlFor="day-change">날이 바뀌는 시각</label>
        <button type="button" className="info-btn" aria-label="날이 바뀌는 시각 설명 보기" onClick={() => dialog.current?.showModal()}>?</button>
      </span>
      <select id="day-change" value={value} onChange={(e) => onChange(e.target.value as DayChange)}>
        <option value="23">23시 (자시부터 다음 날)</option>
        <option value="00">0시 (야자시 적용)</option>
      </select>
      <dialog ref={dialog} className="info-dialog" aria-labelledby="day-change-title" onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}>
        <h3 id="day-change-title">날이 바뀌는 시각이란?</h3>
        <p>자시(밤 11시~새벽 1시)가 자정에 걸쳐 있어서, 밤 11시~자정에 태어난 사람의 날짜를 보는 방식이 둘로 나뉩니다.</p>
        <ul>
          <li><b>23시</b>: 밤 11시부터 다음 날로 봅니다. 일주도 다음 날 것으로 잡습니다.</li>
          <li><b>0시 (야자시)</b>: 자정까지는 태어난 날로 두고, 시주만 자시로 잡습니다.</li>
        </ul>
        <p>이 시간대에 태어나지 않았다면 어느 쪽을 골라도 결과가 같습니다. 태어난 곳을 고르면 경도 보정한 시각으로 판단해서, 서울은 시계로 밤 11시 30분쯤~새벽 0시 30분쯤이 해당됩니다.</p>
        <form method="dialog"><button className="btn">닫기</button></form>
      </dialog>
    </div>
  );
}
