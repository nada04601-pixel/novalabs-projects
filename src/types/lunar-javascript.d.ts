// lunar-javascript(1.7.7)는 타입 선언을 함께 배포하지 않아 여기서 쓰는 함수만 적어 둡니다.
declare module "lunar-javascript" {
  export interface EightChar {
    // 1: 23시에 날이 바뀜(자시 기준), 2: 0시에 날이 바뀜(야자시)
    setSect(sect: 1 | 2): void;
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
  }
  export interface LunarDate {
    getEightChar(): EightChar;
    getSolar(): SolarDate;
  }
  export interface SolarDate {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getLunar(): LunarDate;
  }
  export const Solar: {
    fromYmdHms(y: number, m: number, d: number, h: number, mi: number, s: number): SolarDate;
  };
  export const Lunar: {
    // 윤달은 달을 음수로 넘깁니다(윤2월 → -2).
    fromYmd(y: number, m: number, d: number): LunarDate;
  };
}
