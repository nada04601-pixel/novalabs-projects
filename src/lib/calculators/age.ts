import { daysBetween } from "./date";

export type AgeResult = {
  international: number; // 만 나이
  yearAge: number; // 연 나이(기준연도 − 출생연도)
  koreanAge: number; // 세는 나이
  livedDays: number; // 태어난 날부터 지난 날수
  isBirthday: boolean; // 기준일이 생일인지
  nextBirthday: Date;
  daysToNextBirthday: number;
};

// 2월 29일생은 평년에는 3월 1일에 나이가 듭니다(민법의 기간 계산).
const birthdayIn = (birth: Date, year: number) => {
  const d = new Date(Date.UTC(year, birth.getUTCMonth(), birth.getUTCDate()));
  return d.getUTCMonth() === birth.getUTCMonth() ? d : new Date(Date.UTC(year, 2, 1));
};

export function calcAge(birth: Date, ref: Date): AgeResult {
  const y = ref.getUTCFullYear();
  const thisYear = birthdayIn(birth, y);
  const passed = thisYear <= ref;
  const international = Math.max(0, y - birth.getUTCFullYear() - (passed ? 0 : 1));
  const nextBirthday = birthdayIn(birth, passed ? y + 1 : y);
  return {
    international,
    yearAge: Math.max(0, y - birth.getUTCFullYear()),
    koreanAge: Math.max(1, y - birth.getUTCFullYear() + 1),
    livedDays: Math.max(0, daysBetween(birth, ref)),
    isBirthday: thisYear.getTime() === ref.getTime(),
    nextBirthday,
    daysToNextBirthday: daysBetween(ref, nextBirthday),
  };
}
