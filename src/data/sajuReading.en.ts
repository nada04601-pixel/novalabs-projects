import type { Element, RelationKind, ShinsalName, TenGod, TenGodGroup } from "@/lib/calculators/saju";
import type { SajuText } from "./sajuReading";

// 영어 페이지(/en/tools/saju)용 사주 이름과 풀이. 내용은 sajuReading.ts의 한국어 풀이와 같습니다.
// 천간·지지 읽는 소리는 한국 사주이므로 한국어 로마자 표기(갑 Gap, 자 Ja…)를 씁니다.

const HANJA = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥";
const ROMAN = ["Gap", "Eul", "Byeong", "Jeong", "Mu", "Gi", "Gyeong", "Sin", "Im", "Gye", "Ja", "Chuk", "In", "Myo", "Jin", "Sa", "O", "Mi", "Sin", "Yu", "Sul", "Hae"];
const read = (h: string) => ROMAN[HANJA.indexOf(h)] ?? h;

const ELEMENT: Record<Element, string> = { 목: "Wood", 화: "Fire", 토: "Earth", 금: "Metal", 수: "Water" };

const TEN_GOD: Record<TenGod, string> = {
  비견: "Friend", 겁재: "Rob Wealth", 식신: "Eating God", 상관: "Hurting Officer", 편재: "Indirect Wealth",
  정재: "Direct Wealth", 편관: "Seven Killings", 정관: "Direct Officer", 편인: "Indirect Resource", 정인: "Direct Resource",
};
const GROUP: Record<TenGodGroup, string> = { 비겁: "Companion", 식상: "Output", 재성: "Wealth", 관성: "Power", 인성: "Resource" };

const ANIMAL: Record<string, string> = {
  쥐: "Rat", 소: "Ox", 호랑이: "Tiger", 토끼: "Rabbit", 용: "Dragon", 뱀: "Snake",
  말: "Horse", 양: "Goat", 원숭이: "Monkey", 닭: "Rooster", 개: "Dog", 돼지: "Pig",
};

const CITY: Record<string, string> = {
  서울: "Seoul", 인천: "Incheon", 수원: "Suwon", 춘천: "Chuncheon", 강릉: "Gangneung", 대전: "Daejeon", 청주: "Cheongju",
  전주: "Jeonju", 광주: "Gwangju", 대구: "Daegu", 울산: "Ulsan", 부산: "Busan", 창원: "Changwon", 제주: "Jeju",
};

const PILLAR: Record<string, string> = { 연: "Year", 월: "Month", 일: "Day", 시: "Hour", 대운: "Decade luck", 세운: "Annual luck" };

// "연지"·"월간"·"일주"·"대운 지지"·"세운 천간"·"대운" 같은 자리 이름
function place(p: string): string {
  const m = p.match(/^(대운|세운) ?(천간|지지)?$/) ?? p.match(/^([연월일시])([간지주])$/);
  if (!m) return p;
  const part = m[2] === "간" || m[2] === "천간" ? " stem" : m[2] === "지" || m[2] === "지지" ? " branch" : m[2] === "주" ? " pillar" : "";
  return PILLAR[m[1]] + part;
}

const RELATION: Record<RelationKind, string> = {
  천간합: "stem combination", 천간충: "stem clash", 육합: "six harmony", 삼합: "three harmony", 반합: "half harmony",
  방합: "seasonal combination", 지지충: "branch clash", 삼형: "triple punishment", 형: "punishment", 자형: "self-punishment",
  파: "destruction", 해: "harm",
};

const PUNISH: Record<string, string> = { 무은지형: "ungrateful punishment", 지세지형: "bullying punishment", 무례지형: "rude punishment" };

const SHINSAL: Record<ShinsalName, string> = {
  천을귀인: "Heavenly Noble", 문창귀인: "Literary Star", 도화살: "Peach Blossom", 역마살: "Traveling Horse", 화개살: "Canopy Star",
  홍염살: "Red Flame", 괴강살: "Kuigang Star", 공망: "Void", 양인살: "Yang Blade", 백호살: "White Tiger", 원진살: "Resentment Star",
};

// calcSaju가 돌려주는 안내·오류 문구
function message(m: string): string {
  let x: RegExpMatchArray | null;
  if ((x = m.match(/^(\d+)년부터 (\d+)년 사이의 날짜를 넣어 주세요\.$/))) return `Please enter a date between ${x[1]} and ${x[2]}.`;
  if (m.startsWith("그해에는 해당 윤달이")) return "That year has no such leap month, or the date doesn't exist.";
  if (m.startsWith("음력에 없는 날짜")) return "This date doesn't exist in the lunar calendar. Check whether the month has 29 or 30 days.";
  if (m === "없는 날짜입니다.") return "This date doesn't exist.";
  if (m === "태어난 시각을 확인해 주세요.") return "Please check the time of birth.";
  if (m.startsWith("서머타임 기간")) return "Daylight saving time was in effect, so 1 hour was subtracted.";
  if (m.startsWith("당시 표준시가 UTC+8:30")) return "Korea used UTC+8:30 at the time, so the time was adjusted to that standard.";
  if ((x = m.match(/^동경 ([\d.]+)도 기준 경도 보정으로 (\d+)분을 (뺐습니다|더했습니다)\.$/)))
    return `Longitude correction for ${x[1]}°E: ${x[3] === "뺐습니다" ? "subtracted" : "added"} ${x[2]} minutes.`;
  if (m.startsWith("이날은 절기가 바뀌는 날"))
    return `A solar term begins on this day, so the month pillar${m.includes("와 연주가") ? " and year pillar" : ""} depend on the time of birth. The result below uses noon; enter the time if you know it.`;
  return m;
}

const DAY_MASTER: SajuText["DAY_MASTER"] = {
  甲: {
    symbol: "a tall, straight tree",
    summary: "Like a tree growing straight upward, you push ahead once you set a goal. You suit roles where you start things and lead people, and you have clear pride and principles.",
    strengths: ["Drive", "Leadership", "Desire to grow", "Honesty"],
    caution: "You rarely change course once decided, which can look stubborn. Learning to bend rather than break will help you grow even taller.",
  },
  乙: {
    symbol: "vines, flowers and grass",
    summary: "Like grass that sways in the wind yet keeps its roots, you are flexible and tenacious. Your strengths are finding a way that fits your surroundings and gently connecting people.",
    strengths: ["Flexibility", "Adaptability", "Persistence", "Friendliness"],
    caution: "Paying close attention to others can make you postpone decisions or lean on people. Try saying what you want first.",
  },
  丙: {
    symbol: "the sun in the sky",
    summary: "Like the sun, you brighten any room. Honest, passionate and expressive, you stand out easily and find joy in sharing openly.",
    strengths: ["Passion", "Honesty", "Expressiveness", "Optimism"],
    caution: "Like a fire that blazes and dies down quickly, you may start hot and finish weak. Pace yourself and you'll shine longer.",
  },
  丁: {
    symbol: "a candle or lantern",
    summary: "Like a candle lighting one spot in the dark, you are delicate and warm. You focus deeply on what interests you and look after those close to you with care.",
    strengths: ["Sensitivity", "Focus", "Consideration", "Insight"],
    caution: "You look calm but tend to hold feelings inside for a long time. Talk about hurt feelings as they come rather than letting them pile up.",
  },
  戊: {
    symbol: "a great mountain and wide land",
    summary: "Like an unshakable mountain, you are steady and trustworthy. You embrace many people and opinions, so you often become the mediator or the one others lean on.",
    strengths: ["Trustworthiness", "Tolerance", "Stability", "Responsibility"],
    caution: "Preferring stability to change, you may move slowly when opportunity knocks. Sometimes try moving first.",
  },
  己: {
    symbol: "fields that grow crops",
    summary: "Like a field that takes seeds and raises them, you are practical and meticulous. You have a good sense of reality, manage well, and find meaning in nurturing others.",
    strengths: ["Meticulousness", "Practicality", "Care", "Resourcefulness"],
    caution: "You can worry ahead of time or neglect your own share while caring for others. Set aside something for yourself too.",
  },
  庚: {
    symbol: "solid rock and raw iron",
    summary: "Like unrefined iron, you are strong and decisive. You see right and wrong clearly, value loyalty, and gain strength in the face of hardship.",
    strengths: ["Decisiveness", "Loyalty", "Sense of justice", "Execution"],
    caution: "Your direct words and actions can hurt others without meaning to. Polishing your words once before speaking makes them even more powerful.",
  },
  辛: {
    symbol: "a shining jewel",
    summary: "Like a finely cut jewel, you are delicate and neat. With high standards for beauty and quality, you never miss details and keep your own dignity.",
    strengths: ["Perfectionism", "Aesthetic sense", "Sharpness", "Self-respect"],
    caution: "High standards make it easy to be strict with yourself and others. Allowing things to be a little less than perfect will help.",
  },
  壬: {
    symbol: "the wide sea and great rivers",
    summary: "Like water flowing far, you think big and wisely. You welcome new ideas and people and love a free life without ties.",
    strengths: ["Wisdom", "Tolerance", "Freedom", "Planning"],
    caution: "With wide-ranging interests, it can be hard to see one thing through. Channel your flow into one stream and it becomes a great force.",
  },
  癸: {
    symbol: "rain and dew",
    summary: "Like rain quietly soaking everything, you are calm and bright. With strong intuition and empathy, you read people's hearts well and support them behind the scenes.",
    strengths: ["Intuition", "Empathy", "Intelligence", "Calmness"],
    caution: "Deep thinking can bring deep worries and make you feel small. Trust your instincts a little more.",
  },
};

const ELEMENT_TEXT: SajuText["ELEMENT_TEXT"] = {
  목: {
    trait: "growth, beginnings, kindness",
    many: "Strong Wood gives you a big drive to start and grow new things. You may spread yourself thin, finish late or become stubborn, so make a habit of setting priorities.",
    none: "With no Wood, you may hesitate before new beginnings. Build experience by starting small, and keep learning to restore balance.",
  },
  화: {
    trait: "passion, expression, courtesy",
    many: "Strong Fire makes you passionate and expressive. Emotions heat up quickly and you can be impatient, so take a breath before deciding.",
    none: "With no Fire, you may seem reserved and show little emotion. Say what you like out loud and make time to be around people.",
  },
  토: {
    trait: "stability, trust, mediation",
    many: "Strong Earth makes you dependable and focused on stability. You may resist change or act slowly from overthinking, so practice deciding within a set deadline.",
    none: "With no Earth, it may be hard to stay centered and plans may change often. Habits that build a base, like a regular routine and steady saving, restore balance.",
  },
  금: {
    trait: "decisiveness, principles, order",
    many: "Strong Metal makes you quick to judge with clear principles. Sharp words or strictness can cause friction, so think about softer ways to say things.",
    none: "With no Metal, cutting ties or saying no may be hard. Set deadlines and standards in advance, and make a habit of tidying up.",
  },
  수: {
    trait: "wisdom, flexibility, thought",
    many: "Strong Water gives you deep thoughts and many ideas. You may think without acting or worry too much, so clear your head with physical activity.",
    none: "With no Water, it may be hard to change your ways or to remember to rest. Enough rest, reading and quiet time alone restore balance.",
  },
};

const TEN_GOD_MEANING: SajuText["TEN_GOD_MEANING"] = {
  비견: "the same energy as you · independence, peers",
  겁재: "a rival like you · competitiveness, drive",
  식신: "what you create · talent, ease, good fortune with food",
  상관: "what you show · expressiveness, creativity, rebellious streak",
  편재: "wealth that moves in big ways · business sense, activity",
  정재: "wealth you save steadily · diligence, management",
  편관: "the force that tests you · charisma, handling crises",
  정관: "the force that keeps you upright · honor, responsibility, organizations",
  편인: "unusual learning · intuition, special skills",
  정인: "learning that supports you · study, mother, care",
};

const TEN_GOD_GROUP_TEXT: SajuText["TEN_GOD_GROUP_TEXT"] = {
  비겁: {
    label: "Companion (Friend, Rob Wealth)",
    meaning: "yourself, siblings, friends, peers",
    many: "You have strong independence and opinions and don't back down easily in competition. You like solving things alone, so make terms clear for money deals or partnerships.",
    none: "You tend to accommodate rather than compete, which keeps things smooth, but you may be weak at claiming your share. Trusted peers by your side are a strength.",
  },
  식상: {
    label: "Output (Eating God, Hurting Officer)",
    meaning: "talent, expression, words and results",
    many: "Rich in expressiveness and creativity, you show your talent through words, writing or craft. You may find it hard to hold back, so filter what you say with superiors.",
    none: "You quietly get things done rather than revealing your thoughts. Practice sharing your results and ideas in words so your effort is properly recognized.",
  },
  재성: {
    label: "Wealth (Indirect Wealth, Direct Wealth)",
    meaning: "money, sense of reality, results",
    many: "You have a good sense of reality and read the flow of money and opportunity well. Greed can make you take on too much, so weigh your energy and what you can handle.",
    none: "You value meaning and people more than money itself. Money management can get loose, so set up automatic saving that builds up without effort.",
  },
  관성: {
    label: "Power (Seven Killings, Direct Officer)",
    meaning: "work, rules, honor, responsibility",
    many: "You are responsible and earn recognition within organizations and rules. You may push yourself too hard or be sensitive to others' opinions, so make sure to rest.",
    none: "You dislike being boxed in and suit working freely. Setting your own deadlines and goals turns that freedom into results.",
  },
  인성: {
    label: "Resource (Indirect Resource, Direct Resource)",
    meaning: "learning, thinking, receiving help",
    many: "You have a strong capacity to learn and think, and receive help readily. Overthinking can delay action, so find places to use what you learn right away.",
    none: "You learn by doing rather than relying on others. Don't carry everything alone; borrowing wisdom from mentors or books makes things much easier.",
  },
};

const LUCK_TEXT: SajuText["LUCK_TEXT"] = {
  비견: "A time to push ahead on your own strength. You may think of independence or a fresh start and find like-minded peers, but stubbornness and spending can rise too.",
  겁재: "A time of competition. Bold challenges can change the game, but money deals and partnerships easily lead to conflict, so put agreements in writing.",
  식신: "A time to use your talents and enjoy life. Good for doing what you love and producing results, with good food and fun along the way. Just don't get too relaxed.",
  상관: "A time of expression and change. Your ideas and words shine and can open new paths, but you may clash with superiors or rules, so filter what you say.",
  편재: "A time of big money moves and activity. Business, investment and travel opportunities arise, but greed can lead to big losses, so set limits on what you can handle.",
  정재: "A time to save and build steadily. Diligence is rewarded and your finances stabilize. Playing it too safe may mean missing opportunities.",
  편관: "A time of growth under pressure. Heavy responsibilities and challenges come, but overcoming them brings big growth and promotion. Manage stress and health.",
  정관: "A time of recognition and position. Jobs, promotions and honors come more easily and life stabilizes, though rules and appearances may feel confining.",
  편인: "A time of unusual study and transition. You're drawn to certifications, special skills or new fields, and your intuition sharpens. Don't let overthinking delay action.",
  정인: "A time to learn and receive help. Luck with exams, documents and contracts is good, and mentors or benefactors help you. Relying on them too much can weaken your own footing.",
};

const PLACE_MEANING: SajuText["PLACE_MEANING"] = Object.fromEntries(
  Object.entries({
    연간: "ancestors, childhood", 연지: "ancestors, childhood", 월간: "parents, siblings, work", 월지: "parents, siblings, work",
    일간: "yourself", 일지: "spouse, home", 시간: "children, later life", 시지: "children, later life",
    연주: "ancestors, childhood", 월주: "parents, siblings, work", 일주: "you and your spouse", 시주: "children, later life",
  }),
);

const PUNISH_TEXT: Record<string, string> = {
  무은지형: "This is the 'ungrateful punishment': you may fall out with someone you helped or feel betrayed in a relationship you trusted.",
  지세지형: "This is the 'bullying punishment': relying on your own strength and pushing hard can tangle things in contests of stubbornness and pride.",
  무례지형: "This is the 'rude punishment': slips of the tongue or overstepping lines can cause conflict between close people.",
};

const RELATION_TEXT: SajuText["RELATION_TEXT"] = {
  천간합: (el) => `They attract each other and combine into ${ELEMENT[el!]}. The two positions grow close and cooperate easily, but each may lose some of its own strength.`,
  천간충: () => "Thoughts and directions collide head-on. Disagreements or sudden changes come easily, but it can also break what has hardened and open a new path.",
  육합: (el) => `A close, attracting harmony with ${ELEMENT[el!]} energy. Bonds, cooperation and affection deepen, while being tied together may slow decisions.`,
  삼합: (el) => `Three branches gather into a strong ${ELEMENT[el!]} current. That element grows much stronger and your tendencies and interests become distinct.`,
  반합: (el) => `Two branches of a three harmony lean toward ${ELEMENT[el!]}. Weaker than a full three harmony, but that element gains strength.`,
  방합: (el) => `Three branches of the same season gather and ${ELEMENT[el!]} clumps together strongly. Like-minded forces join hands.`,
  지지충: () => "A head-on clash. Changes like moving or changing jobs, or quarrels and partings, come easily, but it also keeps you moving instead of stagnating.",
  삼형: (_, name) => `All three branches are present, so the punishment acts strongly. ${PUNISH_TEXT[name!]} It can show up as big trials like lawsuits, surgery or accidents, but becomes a great strength in fields that deal with punishment, such as law, medicine, the military or police.`,
  형: (_, name) => `A punishment where the two sides turn their edges on each other. ${PUNISH_TEXT[name!]} Following rules and procedures and resolving hurt feelings right away reduce the damage.`,
  자형: () => "The same branch overlaps in a self-punishment that torments itself. You may blame yourself or repeat the same mistakes, so habits that calm the mind and enough rest help.",
  파: () => "A destruction that breaks each other. Ongoing work or promises may fall through or relationships may crack, though the effect is weaker than a clash.",
  해: () => "A harm that slowly wears each other down. Misunderstandings and hurt feelings pile up with close people, so talk about even small complaints. The effect is weaker than a clash.",
};

const SHINSAL_TEXT: SajuText["SHINSAL_TEXT"] = {
  천을귀인: { tone: "길", text: "Considered the best of the lucky stars. Helpers appear in hard times, and you have the strength to get through crises smoothly." },
  문창귀인: { tone: "길", text: "The star of writing and learning. You are bright and learn fast, good for showing your skill in exams, research and writing." },
  도화살: { tone: "양면", text: "The star of charm and popularity. A big asset in work dealing with people, like broadcasting, sales or service, but be careful about romantic trouble and gossip." },
  역마살: { tone: "양면", text: "The star of movement and change. Business trips, travel, living abroad and moving come often, suiting trade, sales or transport, though settling in one place may be hard." },
  화개살: { tone: "양면", text: "The star of art, religion and scholarship. Deep sensitivity and the power to dig into one field, but much time alone can bring loneliness." },
  홍염살: { tone: "양면", text: "The star of subtle charm and emotion. Affectionate and popular, but don't let feelings sweep you into complicated relationships." },
  괴강살: { tone: "양면", text: "The star of strong energy and charisma. Bright with excellent leadership to run large organizations, but stubborn and prone to extremes." },
  공망: { tone: "양면", text: "Means 'empty'. The bonds or matters of that position may not fill up as hoped, but it can prompt you to let go of greed and turn to inner values." },
  양인살: { tone: "흉", text: "A sharp, strong energy like a blade. Excellent decisiveness and drive shine in the military, police, medicine or sports, but watch out for fights and injuries." },
  백호살: { tone: "흉", text: "A fierce energy like a tiger, traditionally linked to accidents and surgery. Paying attention to health checkups and safety turns it into strong drive." },
  원진살: { tone: "흉", text: "A relationship of resentment without reason. Hurt feelings pile up easily between close people, so don't let emotions linger; resolve them as they come." },
};

export const SAJU_EN: SajuText = {
  DAY_MASTER,
  ELEMENT_TEXT,
  TEN_GOD_MEANING,
  TEN_GOD_GROUP_TEXT,
  LUCK_TEXT,
  PLACE_MEANING,
  RELATION_TEXT,
  SHINSAL_TEXT,
  ROOT_TEXT: {
    rooted: "An element matching your Day Master sits inside the branches (hidden stems), so your Day Master has roots. Like a tree rooted in the ground, you aren't easily shaken and can hold up on your own in hard times.",
    none: "No element matching your Day Master sits inside the branches, so its roots are weak. You are easily influenced by surroundings and people, so trusted people and a stable base by your side give you strength.",
  },
  REVEAL_TEXT: {
    some: "These hidden energies inside the branches also appear in the stems. Your inner self and outward appearance match, so that energy works powerfully in real life.",
    none: "None of the hidden energies inside the branches appear in the stems. You tend to keep thoughts and talents inside, so practicing showing them lets you use that hidden strength better.",
  },
  SPOUSE_CLASH: "Your spouse position (Day branch) is clashed, so changes in your home or relationship come easily. Share your schedules and thoughts often.",
  HIDDEN_ONLY: "Still, this energy is hidden inside the branches, so you have the potential to draw on it when needed.",
  el: (e) => ELEMENT[e],
  read,
  pair: (s, b) => `${read(s)}-${read(b).toLowerCase()}`,
  god: (g) => TEN_GOD[g],
  group: (g) => GROUP[g],
  animal: (a) => ANIMAL[a] ?? a,
  city: (n) => CITY[n] ?? n,
  pillar: (l) => PILLAR[l[0]] ?? l,
  place,
  relation: (k) => RELATION[k],
  punish: (n) => PUNISH[n] ?? n,
  shinsal: (n) => SHINSAL[n],
  tone: (t) => (t === "양면" ? "mixed" : t === "길" ? "lucky" : "unlucky"),
  message,
};
