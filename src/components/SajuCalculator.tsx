"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ShareLinkButtons from "@/components/ShareLinkButtons";
import { todayKST } from "@/lib/calculators/date";
import { decodeSajuLink, encodeSajuLink, type SajuLinkState } from "@/lib/sajuLink";
import { CITIES, ELEMENTS, ELEMENT_HANJA, MAX_YEAR, MIN_YEAR, TEN_GOD_GROUPS, calcLuck, calcSaju, findRelations, findShinsal, natalSlots, formatUsedTime, groupOf, type Element, type LuckPillar, type Relation, type SajuResult, type Shinsal, type TenGod } from "@/lib/calculators/saju";
import { MANY, SAJU_KO, type SajuText } from "@/data/sajuReading";
import { SAJU_EN } from "@/data/sajuReading.en";
import { useT } from "@/lib/useT";
import DayChangeNote from "@/components/DayChangeNote";

const EL_CLASS: Record<Element, string> = { 목: "el-wood", 화: "el-fire", 토: "el-earth", 금: "el-metal", 수: "el-water" };
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 화면 문구(t)와 사주 이름·풀이(L)를 언어에 맞게 고릅니다.
function useSaju() {
  const t = useT();
  return { t, en: t.lang === "en", L: t.lang === "en" ? SAJU_EN : SAJU_KO };
}

export default function SajuCalculator() {
  const { t, en, L } = useSaju();
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [year, setYear] = useState("1995");
  const [month, setMonth] = useState(5);
  const [day, setDay] = useState(15);
  const [leap, setLeap] = useState(false);
  const [time, setTime] = useState("09:30");
  const [noTime, setNoTime] = useState(false);
  const [city, setCity] = useState<string>("서울");
  const [dayChange, setDayChange] = useState<"23" | "00">("23");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [withHidden, setWithHidden] = useState(false);
  const [today, setToday] = useState<{ year: number; month: number; day: number } | null>(null);
  const [fromLink, setFromLink] = useState(false);

  // 정적 HTML에 빌드 날짜가 박히지 않도록 마운트 후 오늘 날짜를 채웁니다.
  useEffect(() => {
    const [y, mo, d] = todayKST().split("-").map(Number);
    setToday({ year: y, month: mo, day: d });
  }, []);

  // 공유 링크(#y=…&m=…&d=…)로 들어오면 그 입력값으로 채웁니다.
  useEffect(() => {
    const load = () => {
      const s = decodeSajuLink(window.location.hash);
      if (!s) return;
      setCalendar(s.calendar);
      setYear(String(s.year));
      setMonth(s.month);
      setDay(s.day);
      setLeap(s.leap);
      setNoTime(!s.time);
      if (s.time) setTime(s.time);
      setCity(s.city);
      setDayChange(s.dayChange);
      setGender(s.gender);
      setFromLink(true);
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  const linkState: SajuLinkState = {
    calendar,
    year: Number(year),
    month,
    day,
    leap,
    time: noTime || !time ? null : time,
    city,
    dayChange,
    gender,
  };

  const [h, m] = time.split(":").map(Number);
  const r = calcSaju({
    calendar,
    year: Number(year),
    month,
    day,
    leapMonth: calendar === "lunar" && leap,
    time: noTime || !time ? null : { hour: h, minute: m },
    longitude: CITIES.find((c) => c.name === city)?.lon ?? null,
    dayChange,
  });

  return (
    <div className="calc">
      {fromLink && <p className="warn">{t("공유받은 링크의 생년월일로 계산한 결과입니다. 값을 바꾸면 그 값으로 다시 계산합니다.", "This result uses the birth date from a shared link. Change any value to recalculate.")}</p>}
      <div className="seg" role="group" aria-label={t("달력", "Calendar")}>
        <button type="button" aria-pressed={calendar === "solar"} onClick={() => setCalendar("solar")}>{t("양력", "Solar")}</button>
        <button type="button" aria-pressed={calendar === "lunar"} onClick={() => setCalendar("lunar")}>{t("음력", "Lunar")}</button>
      </div>
      <div className="fields">
        <label>{t("태어난 해", "Year of birth")}
          <input type="number" inputMode="numeric" min={MIN_YEAR} max={MAX_YEAR} value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
        <label>{t("월", "Month")}
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {range(1, 12).map((v) => <option key={v} value={v}>{t(`${v}월`, MONTHS_EN[v - 1])}</option>)}
          </select>
        </label>
        <label>{t("일", "Day")}
          <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {range(1, calendar === "lunar" ? 30 : 31).map((v) => <option key={v} value={v}>{t(`${v}일`, String(v))}</option>)}
          </select>
        </label>
        <label>{t("태어난 시각", "Time of birth")}
          <input type="time" value={time} disabled={noTime} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label>{t("태어난 곳 (경도 보정)", "Place of birth (longitude correction)")}
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES.map((c) => <option key={c.name} value={c.name}>{L.city(c.name)}</option>)}
            <option value="">{t("보정 안 함 (한국 표준시)", "No correction (Korea Standard Time)")}</option>
          </select>
        </label>
        <label>{t("성별 (대운 방향)", "Sex (direction of decade luck)")}
          <select value={gender} onChange={(e) => setGender(e.target.value as "male" | "female")}>
            <option value="female">{t("여성", "Female")}</option>
            <option value="male">{t("남성", "Male")}</option>
          </select>
        </label>
        <label>{t("날이 바뀌는 시각", "When the day changes")}
          <select value={dayChange} onChange={(e) => setDayChange(e.target.value as "23" | "00")}>
            <option value="23">{t("23시 (자시부터 다음 날)", "11 PM (next day from Ja hour)")}</option>
            <option value="00">{t("0시 (야자시 적용)", "Midnight (late Ja hour)")}</option>
          </select>
        </label>
      </div>
      <div className="checks">
        {calendar === "lunar" && (
          <label className="inline">
            <input type="checkbox" checked={leap} onChange={(e) => setLeap(e.target.checked)} />
            {t("윤달", "Leap month")}
          </label>
        )}
        <label className="inline">
          <input type="checkbox" checked={noTime} onChange={(e) => setNoTime(e.target.checked)} />
          {t("태어난 시간을 모름", "I don't know my time of birth")}
        </label>
      </div>
      {en && <p className="note-sm">{EN_TIME_NOTE}</p>}
      <DayChangeNote />

      <div className="result" aria-live="polite">
        {"error" in r ? (
          <p className="warn">{L.message(r.error)}</p>
        ) : (
          <>
            <div className="saju-pillars">
              {[...r.pillars].reverse().map((p) => (
                <div key={p.label} className="saju-pillar">
                  <span className="saju-label">{L.pillar(p.label)}</span>
                  <span className={`saju-char ${EL_CLASS[p.stemElement]}`}>
                    <b>{p.stem}</b><small>{L.read(p.stem)} · {L.el(p.stemElement)}</small>
                    <em className="saju-god">{p.stemTenGod ? L.god(p.stemTenGod) : t("일간(나)", "Day Master (you)")}</em>
                  </span>
                  <span className={`saju-char ${EL_CLASS[p.branchElement]}`}>
                    <b>{p.branch}</b><small>{L.read(p.branch)} · {L.el(p.branchElement)}</small>
                    <em className="saju-god">{L.god(p.branchTenGod)}</em>
                  </span>
                  <span className="saju-hidden" title={t("지장간(지지 속에 숨은 천간)", "Hidden stems inside the branch")}>
                    {p.hidden.map((h) => (
                      <span key={h.stem} className={EL_CLASS[h.element]}><b>{h.stem}</b> {L.god(h.tenGod)}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
            <p className="saju-muted">{t("맨 아래 작은 글자는 지지 속에 숨은 천간(지장간)과 그 십신입니다. 위에서부터 여기·중기·정기 순이며, 마지막 정기가 그 지지의 본래 기운입니다.", "The small characters at the bottom are the hidden stems inside each branch and their Ten Gods. From top to bottom they are the residual, middle and main qi; the last (main qi) is the branch's own energy.")}</p>

            {r.warnings.map((w) => <p key={w} className="warn">{L.message(w)}</p>)}

            <table>
              <tbody>
                <tr>
                  <th>{t("일간 (나를 나타내는 글자)", "Day Master (the character that represents you)")}</th>
                  <td>{en ? `${L.read(r.dayMaster.stem)} ${L.el(r.dayMaster.element)} (${r.dayMaster.stem}${ELEMENT_HANJA[r.dayMaster.element]}, ${r.dayMaster.yang ? "Yang" : "Yin"})` : `${r.dayMaster.stemKo}${r.dayMaster.element} (${r.dayMaster.stem}${ELEMENT_HANJA[r.dayMaster.element]}, ${r.dayMaster.yang ? "양" : "음"})`}</td>
                </tr>
                <tr><th>{t("띠", "Zodiac animal")}</th><td>{L.animal(r.animal)}</td></tr>
                {calendar === "lunar" && <tr><th>{t("양력 생일", "Solar birthday")}</th><td>{t(`${r.solar.year}년 ${r.solar.month}월 ${r.solar.day}일`, `${MONTHS_EN[r.solar.month - 1]} ${r.solar.day}, ${r.solar.year}`)}</td></tr>}
                {r.usedTime && <tr><th>{t("계산에 쓴 시각", "Time used for calculation")}</th><td>{formatUsedTime(r.usedTime)}</td></tr>}
              </tbody>
            </table>
            {r.adjustments.length > 0 && (
              <ul className="saju-notes">
                {r.adjustments.map((a) => <li key={a}>{L.message(a)}</li>)}
              </ul>
            )}
            <ShareLinkButtons
              hash={() => encodeSajuLink(linkState)}
              title={t("내 사주 결과", "My Saju reading")}
              note={t("링크에는 생년월일·시각이 담기니 믿을 수 있는 사람에게만 보내세요.", "The link contains your birth date and time, so only send it to people you trust.")}
            />

            <h3>{t("오행 분포", "Five Elements")}</h3>
            <div className="seg" role="group" aria-label={t("오행 세는 방식", "How elements are counted")}>
              <button type="button" aria-pressed={!withHidden} onClick={() => setWithHidden(false)}>{t("글자 수", "Character count")}</button>
              <button type="button" aria-pressed={withHidden} onClick={() => setWithHidden(true)}>{t("지장간 반영", "With hidden stems")}</button>
            </div>
            <div className="saju-elements">
              {ELEMENTS.map((e) => {
                const n = withHidden ? r.elementPower[e] : r.elementCount[e];
                const total = r.pillars.length * 2;
                return (
                  <div key={e} className="saju-el-row">
                    <span>{L.el(e)}({ELEMENT_HANJA[e]})</span>
                    <span className="saju-bar"><i className={EL_CLASS[e]} style={{ width: `${(n / total) * 100}%` }} /></span>
                    <strong>{n}</strong>
                  </div>
                );
              })}
            </div>
            <p className="saju-summary">
              {withHidden
                ? t("지지 하나를 1로 보고 지장간이 맡은 일수(30일 중) 비율로 나눠 더한 값입니다. 겉으로 보이는 글자 수보다 실제 기운의 세기에 가깝습니다.", "Each branch counts as 1, split among its hidden stems by the days (out of 30) each one governs. This is closer to the real strength of each element than the visible character count.")
                : summary(r.elementCount, L, en)}
            </p>

            <Reading r={r} />
            {today && <Luck key={`${r.birthUtc}-${gender}`} r={r} gender={gender} today={today} />}
          </>
        )}
      </div>
    </div>
  );
}

// 영어 페이지 안내: 입력 시각은 한국 시간으로 계산합니다.
const EN_TIME_NOTE =
  "Times are treated as Korean local time (with Korea's historical daylight saving and time zones applied). If you were born outside Korea, convert your birth time to Korean time first and choose 'No correction', or pick the city closest in longitude.";

function summary(count: Record<Element, number>, L: SajuText, en: boolean) {
  const max = Math.max(...ELEMENTS.map((e) => count[e]));
  const most = ELEMENTS.filter((e) => count[e] === max).map(L.el);
  const missing = ELEMENTS.filter((e) => count[e] === 0).map(L.el);
  if (en) {
    return `Your strongest element is ${most.join(" and ")} (${max}). ${missing.length ? `${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} missing from your chart.` : "All five elements are present."}`;
  }
  const parts = [`가장 많은 기운은 ${most.join("·")}(${max}개)입니다.`];
  parts.push(missing.length ? `${missing.join("·")} 기운은 팔자에 없습니다.` : "다섯 기운이 모두 있습니다.");
  return parts.join(" ");
}

function Reading({ r }: { r: SajuResult }) {
  const { t, en, L } = useSaju();
  const dm = L.DAY_MASTER[r.dayMaster.stem];
  const manyEl = ELEMENTS.filter((e) => r.elementCount[e] >= MANY);
  const noneEl = ELEMENTS.filter((e) => r.elementCount[e] === 0);
  const total = Object.values(r.tenGodCount).reduce((a, b) => a + b, 0);
  const natalRel = findRelations(natalSlots(r));
  const natalShinsal = findShinsal(natalSlots(r));
  const gods = [...new Set(r.pillars.flatMap((p) => [p.stemTenGod, p.branchTenGod]).filter((g): g is TenGod => !!g))];
  const dmName = en
    ? `${L.read(r.dayMaster.stem)} ${L.el(r.dayMaster.element)} (${r.dayMaster.stem}${ELEMENT_HANJA[r.dayMaster.element]}) Day Master · ${dm.symbol}`
    : `${r.dayMaster.stemKo}${r.dayMaster.element}(${r.dayMaster.stem}${ELEMENT_HANJA[r.dayMaster.element]}) 일간 · ${dm.symbol}`;

  return (
    <div className="saju-reading">
      <h3>{t("사주 풀이", "Your reading")}</h3>

      <section className="saju-card">
        <h4>{dmName}</h4>
        <p>{dm.summary}</p>
        <p className="saju-tags">{dm.strengths.map((s) => <span key={s}>{s}</span>)}</p>
        <p><b>{t("이런 점은 조심하세요.", "Watch out for this.")}</b> {dm.caution}</p>
      </section>

      <section className="saju-card">
        <h4>{t("오행의 균형", "Balance of the Five Elements")}</h4>
        {manyEl.length === 0 && noneEl.length === 0 && (
          <p>
            {t(
              "다섯 기운이 고르게 섞여 있어 어느 한쪽으로 크게 치우치지 않습니다. 상황에 맞춰 여러 모습을 꺼내 쓸 수 있는 균형 잡힌 구성입니다.",
              "The five elements are evenly mixed, without leaning heavily to one side. It's a balanced chart that lets you draw on different sides of yourself as the situation demands.",
            )}
          </p>
        )}
        {manyEl.map((e) => (
          <p key={e}>
            <b>{t(`${e}(${L.ELEMENT_TEXT[e].trait}) 기운이 많음 · ${r.elementCount[e]}개`, `Strong ${L.el(e)} (${L.ELEMENT_TEXT[e].trait}) · ${r.elementCount[e]}`)}</b><br />
            {L.ELEMENT_TEXT[e].many}
          </p>
        ))}
        {noneEl.map((e) => (
          <p key={e}>
            <b>{t(`${e}(${L.ELEMENT_TEXT[e].trait}) 기운이 없음`, `No ${L.el(e)} (${L.ELEMENT_TEXT[e].trait})`)}</b><br />
            {L.ELEMENT_TEXT[e].none}{r.elementPower[e] > 0 && ` ${L.HIDDEN_ONLY}`}
          </p>
        ))}
      </section>

      <section className="saju-card">
        <h4>{t("지장간으로 본 뿌리와 드러난 기운", "Roots and revealed energy (hidden stems)")}</h4>
        <p>
          <b>{r.roots.length ? `${t("통근", "Rooted in")} · ${r.roots.map(L.place).join(", ")}` : t("통근 없음", "No roots")}</b><br />
          {r.roots.length ? L.ROOT_TEXT.rooted : L.ROOT_TEXT.none}
        </p>
        <p>
          <b>
            {r.revealed.length
              ? `${t("투출", "Revealed")} · ${r.revealed.map((x) => `${x.stem}(${x.places.map(L.place).join(en ? ", " : "·")})`).join(", ")}`
              : t("투출 없음", "Nothing revealed")}
          </b><br />
          {r.revealed.length ? L.REVEAL_TEXT.some : L.REVEAL_TEXT.none}
        </p>
      </section>

      <section className="saju-card">
        <h4>{t("십신으로 본 성향", "Personality by the Ten Gods")}</h4>
        <p className="saju-muted">
          {t(`일간을 기준으로 나머지 ${total}글자가 나와 어떤 관계인지 나눈 것입니다.`, `How the other ${total} characters relate to your Day Master.`)}
        </p>
        <div className="saju-elements">
          {TEN_GOD_GROUPS.map((g) => (
            <div key={g} className="saju-el-row wide">
              <span>{L.group(g)}</span>
              <span className="saju-bar"><i style={{ width: `${(r.tenGodCount[g] / total) * 100}%` }} /></span>
              <strong>{r.tenGodCount[g]}</strong>
            </div>
          ))}
        </div>
        {TEN_GOD_GROUPS.filter((g) => r.tenGodCount[g] >= MANY || r.tenGodCount[g] === 0).map((g) => {
          const x = L.TEN_GOD_GROUP_TEXT[g];
          const many = r.tenGodCount[g] >= MANY;
          return (
            <p key={g}>
              <b>{x.label} {many ? t(`많음 · ${r.tenGodCount[g]}개`, `strong · ${r.tenGodCount[g]}`) : t("없음", "missing")}</b>{" "}
              <span className="saju-muted">({x.meaning})</span><br />
              {many ? x.many : x.none}
            </p>
          );
        })}
        <details>
          <summary>{t("내 사주에 있는 십신 뜻", "Meaning of the Ten Gods in your chart")}</summary>
          <ul className="saju-notes">
            {gods.sort((a, b) => TEN_GOD_GROUPS.indexOf(groupOf(a)) - TEN_GOD_GROUPS.indexOf(groupOf(b))).map((g) => (
              <li key={g}><b>{L.god(g)}</b>: {L.TEN_GOD_MEANING[g]}</li>
            ))}
          </ul>
        </details>
      </section>

      <section className="saju-card">
        <h4>{t("합·충·형·파·해", "Combinations and clashes")}</h4>
        {natalRel.length ? (
          <Relations list={natalRel} />
        ) : (
          <p>
            {t(
              "팔자 안에 서로 묶이거나(합) 부딪히는(충·형·파·해) 글자가 없습니다. 크게 흔들림이 없는 비교적 안정된 구성입니다.",
              "No characters in your chart combine with or clash against each other (combinations, clashes, punishments, destructions or harms). It's a relatively stable chart without major upheavals.",
            )}
          </p>
        )}
      </section>

      <section className="saju-card">
        <h4>{t("신살", "Symbolic stars (Sinsal)")}</h4>
        {natalShinsal.length ? (
          <ShinsalList list={natalShinsal} />
        ) : (
          <p>{t("흔히 보는 신살 가운데 팔자에 걸린 것이 없습니다.", "None of the commonly read symbolic stars appear in your chart.")}</p>
        )}
      </section>

      {en ? (
        <p className="saju-muted">
          This reading explains the general meanings of the Day Master, Five Elements, Ten Gods, combinations and clashes, and symbolic stars. Rules for symbolic stars vary slightly between schools, so results may differ from other calculators. Please treat it as entertainment and reference.
        </p>
      ) : (
        <p className="saju-muted">풀이는 일간·오행·십신, 합·충·형·파·해, 신살의 일반적인 의미를 풀어 쓴 것입니다. 신살은 학파마다 기준이 조금씩 달라 다른 만세력과 결과가 다를 수 있습니다. 재미와 참고용으로 봐 주세요. 두 사람의 궁합은 <Link href="/tools/saju-match">우리 궁합 보기</Link>에서 볼 수 있습니다.</p>
      )}
    </div>
  );
}

// 운에 들어온 기운이 팔자에 없거나 이미 많은 오행이면 한 줄로 알려 줍니다.
function elementNotes(r: SajuResult, p: LuckPillar, L: SajuText, en: boolean) {
  return [...new Set([p.stemElement, p.branchElement])].flatMap((e) => {
    const n = r.elementCount[e];
    if (n === 0)
      return [en ? `${L.el(e)} (${L.ELEMENT_TEXT[e].trait}), missing from your chart, comes in and fills the gap.` : `팔자에 없던 ${e}(${L.ELEMENT_TEXT[e].trait}) 기운이 들어와 부족한 부분을 채워 줍니다.`];
    if (n >= MANY) return [en ? `More ${L.el(e)} adds to an already strong element, so that tendency may become excessive.` : `이미 많은 ${e} 기운이 더해져 그 성향이 지나치게 강해질 수 있습니다.`];
    return [];
  });
}

function LuckRow({ items, selected, onSelect, caption }: { items: LuckPillar[]; selected: number; onSelect: (i: number) => void; caption: (p: LuckPillar) => string }) {
  const { t, L } = useSaju();
  return (
    <div className="saju-luck-row" role="group">
      {items.map((p, i) => (
        <button key={i} type="button" className="saju-luck" aria-pressed={i === selected} onClick={() => onSelect(i)}>
          <small>{caption(p)}</small>
          <b className={EL_CLASS[p.stemElement]}>{p.stem}</b>
          <b className={EL_CLASS[p.branchElement]}>{p.branch}</b>
          <small>{L.pair(p.stem, p.branch)}{p.current ? t(" · 지금", " · now") : ""}</small>
        </button>
      ))}
    </div>
  );
}

function LuckDetail({ r, p, title, name }: { r: SajuResult; p: LuckPillar; title: string; name: "대운" | "세운" }) {
  const { en, L } = useSaju();
  const slots = [...natalSlots(r), { name, stem: p.stem, branch: p.branch }];
  const rel = findRelations(slots, name);
  const shinsal = findShinsal(slots, name);
  const head = (c: string, e: Element, g: TenGod) => (en ? `${c} (${L.read(c)} ${L.el(e)}) · ${L.god(g)}` : `${c}(${L.read(c)}${e}) · ${g}`);
  return (
    <div className="saju-luck-detail">
      <h4>{title}</h4>
      <p><b>{head(p.stem, p.stemElement, p.stemTenGod!)}</b><br />{L.LUCK_TEXT[p.stemTenGod!]}</p>
      <p><b>{head(p.branch, p.branchElement, p.branchTenGod)}</b><br />{L.LUCK_TEXT[p.branchTenGod]}</p>
      {elementNotes(r, p, L, en).map((n) => <p key={n}>{n}</p>)}
      {rel.length > 0 && <Relations list={rel} />}
      {shinsal.length > 0 && <ShinsalList list={shinsal} />}
    </div>
  );
}

function Luck({ r, gender, today }: { r: SajuResult; gender: "male" | "female"; today: { year: number; month: number; day: number } }) {
  const { t, L } = useSaju();
  const l = calcLuck(r, gender, today);
  const curDaeun = l.daeun.findIndex((d) => d.current);
  const curSeun = l.seun.findIndex((s) => s.current);
  const [dSel, setDSel] = useState<number | null>(null);
  const [sSel, setSSel] = useState<number | null>(null);
  const di = dSel ?? Math.max(curDaeun, 0);
  const si = sSel ?? Math.max(curSeun, 0);
  const d = l.daeun[di];
  const s = l.seun[si];

  return (
    <div className="saju-reading">
      <h3>{t("대운 (10년마다 바뀌는 큰 흐름)", "Decade luck (the big flow that changes every 10 years)")}</h3>
      <p className="saju-muted">
        {t(
          `${l.forward ? "순행" : "역행"} · 태어나고 ${l.start.years}년 ${l.start.months}개월 뒤부터 10년씩 바뀝니다.`,
          `${l.forward ? "Forward" : "Backward"} · Changes every 10 years, starting ${l.start.years} years ${l.start.months} months after birth.`,
        )}
        {curDaeun < 0 && t(" 아직 첫 대운이 시작되기 전입니다.", " Your first decade luck hasn't started yet.")}
        {!r.usedTime && t(" 태어난 시각을 모르면 시작 시점이 몇 달 어긋날 수 있습니다.", " Without a time of birth, the start may be off by a few months.")}
      </p>
      <LuckRow items={l.daeun} selected={di} onSelect={setDSel} caption={(p) => t(`만 ${p.age}세`, `Age ${p.age}`)} />
      <LuckDetail
        r={r}
        p={d}
        name="대운"
        title={t(`${d.year}년 ${d.month}월부터 10년 (만 ${d.age}~${d.age + 9}세)`, `10 years from ${MONTHS_EN[(d.month ?? 1) - 1]} ${d.year} (age ${d.age}–${d.age + 9})`)}
      />

      <h3>{t("세운 (해마다 바뀌는 흐름)", "Annual luck (the flow that changes every year)")}</h3>
      <LuckRow items={l.seun} selected={si} onSelect={setSSel} caption={(p) => `${p.year}`} />
      <LuckDetail
        r={r}
        p={s}
        name="세운"
        title={t(
          `${s.year}년 ${s.stemKo}${s.branchKo}년${s.age >= 0 ? ` (생일 지나면 만 ${s.age}세)` : ""}`,
          `${s.year}, the year of ${L.pair(s.stem, s.branch)}${s.age >= 0 ? ` (age ${s.age} after your birthday)` : ""}`,
        )}
      />
      <p className="saju-muted">
        {t(
          "대운의 천간은 앞 5년, 지지는 뒤 5년에 더 크게 작용한다고 봅니다. 세운은 입춘(2월 4일 무렵)에 바뀝니다. 합·충 같은 글자 사이의 작용은 반영하지 않은 간단한 풀이입니다.",
          "The stem of a decade luck is said to act more in the first 5 years and the branch in the last 5. Annual luck changes at Ipchun, the start of spring (around February 4). This is a simple reading that doesn't weigh interactions between characters.",
        )}
      </p>
    </div>
  );
}

// 자리 이름과 그 자리가 상징하는 것: 일지(배우자·가정) / Day branch (spouse, home)
const placeText = (p: string, L: SajuText, en: boolean) => (L.PLACE_MEANING[p] ? `${L.place(p)}${en ? " " : ""}(${L.PLACE_MEANING[p]})` : L.place(p));

function Relations({ list }: { list: Relation[] }) {
  const { en, L } = useSaju();

  return (
    <ul className="saju-rel">
      {list.map((x) => (
        <li key={x.kind + x.places.join()}>
          <b>
            {x.chars} {L.relation(x.kind)}
            {x.element ? `${en ? " " : ""}(${L.el(x.element)})` : ""}
            {x.name ? ` · ${L.punish(x.name)}` : ""}
          </b>
          <span className="saju-muted"> · {x.places.map((p) => placeText(p, L, en)).join(" – ")}</span>
          <br />
          {L.RELATION_TEXT[x.kind](x.element, x.name)}
          {x.kind === "지지충" && x.places.includes("일지") && ` ${L.SPOUSE_CLASH}`}
        </li>
      ))}
    </ul>
  );
}

const TONE_CLASS = { 길: "good", 흉: "bad", 양면: "mixed" } as const;

function ShinsalList({ list }: { list: Shinsal[] }) {
  const { en, L } = useSaju();
  return (
    <ul className="saju-rel">
      {list.map((x) => {
        const s = L.SHINSAL_TEXT[x.name];
        return (
          <li key={x.name}>
            <b>{L.shinsal(x.name)}</b> <span className={`saju-tone ${TONE_CLASS[s.tone]}`}>{L.tone(s.tone)}</span>
            <span className="saju-muted"> · {x.places.map((p) => placeText(p, L, en)).join(", ")}</span>
            <br />
            {s.text}
          </li>
        );
      })}
    </ul>
  );
}
