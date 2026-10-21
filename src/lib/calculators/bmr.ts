export type Sex = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "active" | "veryActive";

// 활동 계수(TDEE = 기초대사량 × 계수)
export const ACTIVITY: Record<Activity, { factor: number; label: string; desc: string }> = {
  sedentary: { factor: 1.2, label: "거의 운동 안 함", desc: "앉아서 일하고 따로 운동하지 않음" },
  light: { factor: 1.375, label: "가벼운 활동", desc: "주 1~3일 가벼운 운동" },
  moderate: { factor: 1.55, label: "보통 활동", desc: "주 3~5일 중간 강도 운동" },
  active: { factor: 1.725, label: "많은 활동", desc: "주 6~7일 강한 운동" },
  veryActive: { factor: 1.9, label: "매우 많은 활동", desc: "운동선수·육체노동, 하루 두 번 운동" },
};

export type BmrInput = { sex: Sex; age: number; heightCm: number; weightKg: number; bodyFatPct?: number };

// Mifflin-St Jeor(1990). 현재 가장 널리 권장되는 식
export const mifflin = ({ sex, age, heightCm, weightKg }: BmrInput) =>
  10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);

// 개정 Harris-Benedict(Roza·Shizgal, 1984)
export const harrisBenedict = ({ sex, age, heightCm, weightKg }: BmrInput) =>
  sex === "male"
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;

// Katch-McArdle. 체지방률을 알 때 제지방량으로 계산
export const katchMcArdle = (weightKg: number, bodyFatPct: number) => 370 + 21.6 * weightKg * (1 - bodyFatPct / 100);

export const validInput = ({ age, heightCm, weightKg, bodyFatPct }: BmrInput) =>
  age >= 15 && age <= 100 && heightCm >= 100 && heightCm <= 250 && weightKg >= 20 && weightKg <= 300 &&
  (bodyFatPct === undefined || (bodyFatPct > 0 && bodyFatPct < 70));

export function calcBmr(input: BmrInput, activity: Activity) {
  const bmr = mifflin(input);
  const tdee = bmr * ACTIVITY[activity].factor;
  return {
    bmr,
    harrisBenedict: harrisBenedict(input),
    katchMcArdle: input.bodyFatPct === undefined ? undefined : katchMcArdle(input.weightKg, input.bodyFatPct),
    tdee,
    // 하루 500kcal 차이는 일주일에 지방 약 0.5kg에 해당
    lose: tdee - 500,
    gain: tdee + 500,
    byActivity: (Object.keys(ACTIVITY) as Activity[]).map((a) => ({ activity: a, tdee: bmr * ACTIVITY[a].factor })),
  };
}
