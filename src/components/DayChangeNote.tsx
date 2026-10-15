"use client";
import { useLang } from "@/lib/useT";

// 사주·궁합 계산기의 '날이 바뀌는 시각' 선택지 설명입니다.
export default function DayChangeNote() {
  if (useLang() === "en") {
    return (
      <div className="note-sm">
        <p><b>What is &lsquo;when the day changes&rsquo;?</b> Saju divides the day into 12 two-hour periods. The first, the Ja hour (子時), runs from 11 PM to 1 AM, so it straddles midnight. Schools disagree on whether someone born between 11 PM and midnight belongs to their birth date or the next day, and neither is officially right.</p>
        <ul>
          <li><b>11 PM (next day from Ja hour)</b>: The day changes at 11 PM, so the Day pillar is taken from the next day.</li>
          <li><b>Midnight (late Ja hour)</b>: The Day pillar stays on the birth date until midnight, and only the Hour pillar is set to the Ja hour. 11 PM to midnight is called the &lsquo;late Ja hour&rsquo; (夜子時).</li>
        </ul>
        <p>For example, someone born at 11:30 PM on May 15, 1990 (without longitude correction) has the Day pillar Sin-sa (辛巳) with the 11 PM rule, or Gyeong-jin (庚辰) with the midnight rule. If you choose a place of birth, the corrected time is used, so in Seoul the difference appears for clock times from about 11:30 PM to 12:30 AM.</p>
        <p><b>If you weren&rsquo;t born in that window, both options give the same result</b>, so you don&rsquo;t need to worry about it.</p>
      </div>
    );
  }
  return (
    <div className="note-sm">
      <p><b>날이 바뀌는 시각이란?</b> 사주에서는 하루를 2시간씩 12개의 시(時)로 나누는데, 첫 번째인 자시(子時)가 밤 11시~새벽 1시라서 자정을 사이에 두고 이틀에 걸쳐 있습니다. 그래서 밤 11시~자정 사이에 태어난 사람을 태어난 날로 볼지 다음 날로 볼지 학파마다 의견이 갈리고, 어느 쪽이 정답이라고 정해져 있지 않습니다.</p>
      <ul>
        <li><b>23시 (자시부터 다음 날)</b>: 밤 11시가 되면 날이 바뀐 것으로 보고, 일주(태어난 날의 기둥)도 다음 날 것으로 잡습니다.</li>
        <li><b>0시 (야자시 적용)</b>: 자정까지는 태어난 날의 일주를 그대로 두고, 시주(태어난 시의 기둥)만 자시로 잡습니다. 밤 11시~자정을 &lsquo;야자시(夜子時)&rsquo;라고 부릅니다.</li>
      </ul>
      <p>예를 들어 1990년 5월 15일 밤 11시 30분생은 (경도 보정 없이) 23시 기준이면 일주가 신사(辛巳), 0시 기준이면 경진(庚辰)이 됩니다. 태어난 곳을 고르면 경도 보정한 시각으로 판단하므로, 서울이라면 시계 기준 밤 11시 30분쯤~새벽 0시 30분쯤 태어난 경우에 이 차이가 생깁니다.</p>
      <p><b>그 시간대에 태어나지 않았다면 어느 쪽을 골라도 결과가 똑같으니</b> 신경 쓰지 않아도 됩니다.</p>
    </div>
  );
}
