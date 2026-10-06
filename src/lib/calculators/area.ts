// 1평 = 400/121㎡ ≒ 3.3058㎡ (사방 6자 기준)
export const SQM_PER_PYEONG = 400 / 121;

export const pyeongToSqm = (p: number) => p * SQM_PER_PYEONG;
export const sqmToPyeong = (m: number) => m / SQM_PER_PYEONG;
