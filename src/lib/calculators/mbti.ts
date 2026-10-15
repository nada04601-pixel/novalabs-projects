// 16가지 성격 유형(MBTI 이론) 간이 테스트. 공식 MBTI® 검사가 아니라 네 가지 선호 지표를 문항으로 가늠합니다.
// 지표마다 8문항씩, 절반은 앞 글자(E·S·T·J) 쪽, 절반은 뒷 글자 쪽 문장이라 "그렇다"만 골라도 한쪽으로 쏠리지 않습니다.

export type Letter = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";
export type Axis = "EI" | "SN" | "TF" | "JP";
export const AXES: Axis[] = ["EI", "SN", "TF", "JP"];

// 그렇다고 답하면 pole 쪽 점수가 오릅니다.
export type Question = { text: string; en: string; axis: Axis; pole: Letter };

// 지표가 고루 섞이도록 E·S·T·J 순서로 돌아가며 둡니다.
export const QUESTIONS: Question[] = [
  { axis: "EI", pole: "E", text: "처음 보는 사람과도 금방 이야기를 나누는 편이다.", en: "I can easily start a conversation with someone I've just met." },
  { axis: "SN", pole: "S", text: "설명을 들을 때 큰 그림보다 구체적인 예시와 사실이 더 와닿는다.", en: "When something is explained to me, concrete examples and facts land better than the big picture." },
  { axis: "TF", pole: "T", text: "결정을 내릴 때 사람들의 기분보다 논리와 원칙을 먼저 따진다.", en: "When making a decision, I weigh logic and principles before people's feelings." },
  { axis: "JP", pole: "J", text: "여행을 가면 일정과 동선을 미리 정해 두어야 마음이 편하다.", en: "When I travel, I feel at ease only once the schedule and route are planned in advance." },
  { axis: "EI", pole: "I", text: "사람들과 오래 어울리고 나면 혼자 쉬면서 기운을 채워야 한다.", en: "After spending a long time with people, I need time alone to recharge." },
  { axis: "SN", pole: "N", text: "멍하니 있을 때 '만약 ~라면?' 같은 상상을 자주 한다.", en: "When my mind wanders, I often imagine \"What if...?\" scenarios." },
  { axis: "TF", pole: "F", text: "친구가 고민을 털어놓으면 해결책보다 먼저 마음을 알아 주고 싶다.", en: "When a friend shares a problem, I want to acknowledge their feelings before offering solutions." },
  { axis: "JP", pole: "P", text: "계획이 갑자기 바뀌어도 크게 불편하지 않고 오히려 재미있다.", en: "Sudden changes of plan don't bother me much; they can even be fun." },
  { axis: "EI", pole: "E", text: "생각을 정리할 때 혼자 고민하기보다 누군가와 말하면서 정리한다.", en: "I sort out my thoughts by talking them through with someone rather than thinking alone." },
  { axis: "SN", pole: "S", text: "새로운 방법보다 검증된 익숙한 방법이 믿음직하다.", en: "Familiar, proven methods feel more reliable to me than new ones." },
  { axis: "TF", pole: "T", text: "잘못된 점이 보이면 상대가 서운해하더라도 솔직하게 말하는 편이다.", en: "If I see something wrong, I say so honestly even if it might upset the other person." },
  { axis: "JP", pole: "J", text: "해야 할 일은 마감보다 한참 전에 끝내 두는 편이다.", en: "I usually finish tasks well before the deadline." },
  { axis: "EI", pole: "I", text: "여럿이 모인 자리에서는 말하기보다 주로 듣는 쪽이다.", en: "In a group, I mostly listen rather than talk." },
  { axis: "SN", pole: "N", text: "일을 할 때 지금 방식보다 더 새로운 방식이 없을지 자꾸 궁리하게 된다.", en: "At work, I keep wondering whether there's a newer, better way to do things." },
  { axis: "TF", pole: "F", text: "옳고 그름을 가릴 때도 그 사람의 사정과 마음을 함께 헤아린다.", en: "Even when judging right and wrong, I take a person's circumstances and feelings into account." },
  { axis: "JP", pole: "P", text: "할 일 목록을 만들어도 그날 기분에 따라 순서를 바꿔 하는 편이다.", en: "Even with a to-do list, I change the order depending on my mood that day." },
  { axis: "EI", pole: "E", text: "주말에 아무 약속이 없으면 심심해서 누군가에게 먼저 연락한다.", en: "If I have no plans for the weekend, I get bored and reach out to someone first." },
  { axis: "SN", pole: "S", text: "요리할 때 레시피의 계량을 정확히 지키는 편이다.", en: "When I cook, I follow the recipe's measurements exactly." },
  { axis: "TF", pole: "T", text: "칭찬을 들을 때 '착하다'보다 '똑똑하다'는 말이 더 기분 좋다.", en: "Being called \"smart\" pleases me more than being called \"kind\"." },
  { axis: "JP", pole: "J", text: "책상이나 방이 정돈되어 있지 않으면 일에 집중하기 어렵다.", en: "I find it hard to focus when my desk or room is messy." },
  { axis: "EI", pole: "I", text: "전화보다 메시지가 편하고, 모르는 번호의 전화는 받기 망설여진다.", en: "I prefer texting to calls, and I hesitate to answer calls from unknown numbers." },
  { axis: "SN", pole: "N", text: "영화나 책을 보고 나면 줄거리보다 숨은 의미와 상징을 곱씹게 된다.", en: "After a movie or book, I dwell on hidden meanings and symbols more than the plot." },
  { axis: "TF", pole: "F", text: "다른 사람이 다투는 모습을 보면 내 마음까지 불편해진다.", en: "Watching other people argue makes me uncomfortable too." },
  { axis: "JP", pole: "P", text: "선택지를 미리 좁히기보다 마지막까지 열어 두고 싶다.", en: "I'd rather keep my options open until the last minute than narrow them down early." },
  { axis: "EI", pole: "E", text: "모임에서 분위기가 처지면 내가 나서서 띄우는 편이다.", en: "When a gathering gets dull, I step up to liven up the mood." },
  { axis: "SN", pole: "S", text: "말할 때 비유보다 있는 그대로 정확하게 말하는 것이 좋다.", en: "I prefer saying things plainly and precisely rather than using metaphors." },
  { axis: "TF", pole: "T", text: "토론에서 지는 것이 싫어 끝까지 근거를 찾아 반박한다.", en: "I hate losing a debate, so I keep looking for evidence to argue back." },
  { axis: "JP", pole: "J", text: "약속 시간보다 늦는 것은 물론, 아슬아슬하게 도착하는 것도 싫다.", en: "I dislike not only being late but also arriving just in time." },
  { axis: "EI", pole: "I", text: "넓고 얕은 인간관계보다 좁고 깊은 관계가 편하다.", en: "I'm more comfortable with a few deep relationships than many casual ones." },
  { axis: "SN", pole: "N", text: "직감이 맞을 때가 많아서 이유를 설명하지 못해도 직감을 믿는다.", en: "My gut feelings are often right, so I trust them even when I can't explain why." },
  { axis: "TF", pole: "F", text: "결정을 내리고 나서도 그 결정으로 상처받을 사람이 있을지 오래 마음에 남는다.", en: "Even after making a decision, I keep wondering whether it hurt someone." },
  { axis: "JP", pole: "P", text: "벼락치기를 할 때 오히려 집중이 잘 된다.", en: "I actually focus better when cramming at the last minute." },
];

// 답: -2(전혀 아니다) ~ 2(매우 그렇다), 아직 안 골랐으면 null
export type Answer = -2 | -1 | 0 | 1 | 2 | null;
export const SCALE: { value: Exclude<Answer, null>; label: string; en: string }[] = [
  { value: -2, label: "전혀 아니다", en: "Strongly disagree" },
  { value: -1, label: "아니다", en: "Disagree" },
  { value: 0, label: "보통이다", en: "Neutral" },
  { value: 1, label: "그렇다", en: "Agree" },
  { value: 2, label: "매우 그렇다", en: "Strongly agree" },
];

export type AxisResult = { axis: Axis; first: Letter; second: Letter; firstPct: number; letter: Letter; pct: number };
export type MbtiResult = { type: string; axes: AxisResult[] };

const pair = (axis: Axis) => [axis[0], axis[1]] as [Letter, Letter];

// 지표별 앞 글자(E·S·T·J) 비율(0~100)로 유형을 정합니다. 정확히 50이면 앞 글자로 봅니다.
export function fromPercents(firstPcts: number[]): MbtiResult {
  const axes = AXES.map((axis, i) => {
    const [first, second] = pair(axis);
    const firstPct = firstPcts[i];
    const letter = firstPct >= 50 ? first : second;
    return { axis, first, second, firstPct, letter, pct: letter === first ? firstPct : 100 - firstPct };
  });
  return { type: axes.map((a) => a.letter).join(""), axes };
}

// 답하지 않은 문항은 "보통이다"로 셉니다.
export function calcMbti(answers: Answer[], questions = QUESTIONS): MbtiResult {
  const pcts = AXES.map((axis) => {
    const first = axis[0];
    let sum = 0;
    let max = 0;
    questions.forEach((q, i) => {
      if (q.axis !== axis) return;
      const v = answers[i] ?? 0;
      sum += q.pole === first ? v : -v;
      max += 2;
    });
    return max ? Math.round(50 + (sum / max) * 50) : 50;
  });
  return fromPercents(pcts);
}

// 결과 공유 링크(#r=INFP&p=38,22,30,41). p는 지표별 앞 글자(E·S·T·J) 비율입니다.
export function encodeMbtiLink(r: MbtiResult): string {
  const p = new URLSearchParams();
  p.set("r", r.type);
  p.set("p", r.axes.map((a) => a.firstPct).join(","));
  return p.toString();
}

// 비율이 잘못됐거나 유형과 맞지 않으면 null
export function decodeMbtiLink(hash: string): MbtiResult | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const pcts = (p.get("p") ?? "").split(",");
  if (pcts.length !== 4 || !pcts.every((v) => /^\d{1,3}$/.test(v) && Number(v) <= 100)) return null;
  const r = fromPercents(pcts.map(Number));
  return r.type === p.get("r")?.toUpperCase() ? r : null;
}
