// A의 B%
export const percentOf = (a: number, b: number) => (a * b) / 100;
// A는 B의 몇 %
export const ratioPercent = (a: number, b: number) => (b !== 0 ? (a / b) * 100 : NaN);
// A에서 B로 바뀔 때 증감률(%)
export const changePercent = (from: number, to: number) => (from !== 0 ? ((to - from) / from) * 100 : NaN);
