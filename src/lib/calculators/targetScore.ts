// 평가 항목별 반영 비율과 받은 점수로, 아직 남은 평가에서 받아야 할 점수를 구합니다.
export type Item = { name: string; weight: number; score: number | null }; // weight: %, score: 100점 만점, null이면 아직 안 봄

export function calcTargetScore(items: Item[], target: number) {
  const valid = items.filter((i) => i.weight > 0);
  const totalWeight = valid.reduce((a, i) => a + i.weight, 0);
  const done = valid.filter((i) => i.score !== null);
  const doneWeight = done.reduce((a, i) => a + i.weight, 0);
  const remainingWeight = totalWeight - doneWeight;
  const earned = done.reduce((a, i) => a + ((i.score as number) * i.weight) / 100, 0); // 지금까지 확보한 점수(100점 만점 기준)
  const maxPossible = earned + remainingWeight; // 남은 평가를 모두 만점 받을 때
  const required = remainingWeight > 0 ? ((target - earned) / remainingWeight) * 100 : NaN;
  return { totalWeight, doneWeight, remainingWeight, earned, maxPossible, required };
}
