"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ShareLinkButtons from "@/components/ShareLinkButtons";
import { todayKST } from "@/lib/calculators/date";
import { decodeSajuLink, encodeSajuLink, type SajuLinkState } from "@/lib/sajuLink";
import { CITIES, ELEMENTS, ELEMENT_HANJA, MAX_YEAR, MIN_YEAR, TEN_GOD_GROUPS, calcLuck, calcSaju, findRelations, findShinsal, natalSlots, formatUsedTime, groupOf, type Element, type LuckPillar, type Relation, type SajuResult, type Shinsal, type TenGod } from "@/lib/calculators/saju";
import { DAY_MASTER, ELEMENT_TEXT, HIDDEN_ONLY, REVEAL_TEXT, ROOT_TEXT, LUCK_TEXT, MANY, PLACE_MEANING, RELATION_TEXT, SHINSAL_TEXT, SPOUSE_CLASH, TEN_GOD_GROUP_TEXT, TEN_GOD_MEANING } from "@/data/sajuReading";

const EL_CLASS: Record<Element, string> = { 목: "el-wood", 화: "el-fire", 토: "el-earth", 금: "el-metal", 수: "el-water" };
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export default function SajuCalculator() {
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
      {fromLink && <p className="warn">공유받은 링크의 생년월일로 계산한 결과입니다. 값을 바꾸면 그 값으로 다시 계산합니다.</p>}
      <div className="seg" role="group" aria-label="달력">
        <button type="button" aria-pressed={calendar === "solar"} onClick={() => setCalendar("solar")}>양력</button>
        <button type="button" aria-pressed={calendar === "lunar"} onClick={() => setCalendar("lunar")}>음력</button>
      </div>
      <div className="fields">
        <label>태어난 해
          <input type="number" inputMode="numeric" min={MIN_YEAR} max={MAX_YEAR} value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
        <label>월
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {range(1, 12).map((v) => <option key={v} value={v}>{v}월</option>)}
          </select>
        </label>
        <label>일
          <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {range(1, calendar === "lunar" ? 30 : 31).map((v) => <option key={v} value={v}>{v}일</option>)}
          </select>
        </label>
        <label>태어난 시각
          <input type="time" value={time} disabled={noTime} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label>태어난 곳 (경도 보정)
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            <option value="">보정 안 함 (한국 표준시)</option>
          </select>
        </label>
        <label>성별 (대운 방향)
          <select value={gender} onChange={(e) => setGender(e.target.value as "male" | "female")}>
            <option value="female">여성</option>
            <option value="male">남성</option>
          </select>
        </label>
        <label>날이 바뀌는 시각
          <select value={dayChange} onChange={(e) => setDayChange(e.target.value as "23" | "00")}>
            <option value="23">23시 (자시부터 다음 날)</option>
            <option value="00">0시 (야자시 적용)</option>
          </select>
        </label>
      </div>
      <div className="checks">
        {calendar === "lunar" && (
          <label className="inline">
            <input type="checkbox" checked={leap} onChange={(e) => setLeap(e.target.checked)} />
            윤달
          </label>
        )}
        <label className="inline">
          <input type="checkbox" checked={noTime} onChange={(e) => setNoTime(e.target.checked)} />
          태어난 시간을 모름
        </label>
      </div>

      <div className="result" aria-live="polite">
        {"error" in r ? (
          <p className="warn">{r.error}</p>
        ) : (
          <>
            <div className="saju-pillars">
              {[...r.pillars].reverse().map((p) => (
                <div key={p.label} className="saju-pillar">
                  <span className="saju-label">{p.label}</span>
                  <span className={`saju-char ${EL_CLASS[p.stemElement]}`}>
                    <b>{p.stem}</b><small>{p.stemKo} · {p.stemElement}</small>
                    <em className="saju-god">{p.stemTenGod ?? "일간(나)"}</em>
                  </span>
                  <span className={`saju-char ${EL_CLASS[p.branchElement]}`}>
                    <b>{p.branch}</b><small>{p.branchKo} · {p.branchElement}</small>
                    <em className="saju-god">{p.branchTenGod}</em>
                  </span>
                  <span className="saju-hidden" title="지장간(지지 속에 숨은 천간)">
                    {p.hidden.map((h) => (
                      <span key={h.stem} className={EL_CLASS[h.element]}><b>{h.stem}</b> {h.tenGod}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
            <p className="saju-muted">맨 아래 작은 글자는 지지 속에 숨은 천간(지장간)과 그 십신입니다. 위에서부터 여기·중기·정기 순이며, 마지막 정기가 그 지지의 본래 기운입니다.</p>

            {r.warnings.map((w) => <p key={w} className="warn">{w}</p>)}

            <table>
              <tbody>
                <tr>
                  <th>일간 (나를 나타내는 글자)</th>
                  <td>{r.dayMaster.stemKo}{r.dayMaster.element} ({r.dayMaster.stem}{ELEMENT_HANJA[r.dayMaster.element]}, {r.dayMaster.yang ? "양" : "음"})</td>
                </tr>
                <tr><th>띠</th><td>{r.animal}띠</td></tr>
                {calendar === "lunar" && <tr><th>양력 생일</th><td>{r.solar.year}년 {r.solar.month}월 {r.solar.day}일</td></tr>}
                {r.usedTime && <tr><th>계산에 쓴 시각</th><td>{formatUsedTime(r.usedTime)}</td></tr>}
              </tbody>
            </table>
            {r.adjustments.length > 0 && (
              <ul className="saju-notes">
                {r.adjustments.map((a) => <li key={a}>{a}</li>)}
              </ul>
            )}
            <ShareLinkButtons hash={() => encodeSajuLink(linkState)} title="내 사주 결과" note="링크에는 생년월일·시각이 담기니 믿을 수 있는 사람에게만 보내세요." />

            <h3>오행 분포</h3>
            <div className="seg" role="group" aria-label="오행 세는 방식">
              <button type="button" aria-pressed={!withHidden} onClick={() => setWithHidden(false)}>글자 수</button>
              <button type="button" aria-pressed={withHidden} onClick={() => setWithHidden(true)}>지장간 반영</button>
            </div>
            <div className="saju-elements">
              {ELEMENTS.map((e) => {
                const n = withHidden ? r.elementPower[e] : r.elementCount[e];
                const total = r.pillars.length * 2;
                return (
                  <div key={e} className="saju-el-row">
                    <span>{e}({ELEMENT_HANJA[e]})</span>
                    <span className="saju-bar"><i className={EL_CLASS[e]} style={{ width: `${(n / total) * 100}%` }} /></span>
                    <strong>{n}</strong>
                  </div>
                );
              })}
            </div>
            <p className="saju-summary">
              {withHidden
                ? "지지 하나를 1로 보고 지장간이 맡은 일수(30일 중) 비율로 나눠 더한 값입니다. 겉으로 보이는 글자 수보다 실제 기운의 세기에 가깝습니다."
                : summary(r.elementCount)}
            </p>

            <Reading r={r} />
            {today && <Luck key={`${r.birthUtc}-${gender}`} r={r} gender={gender} today={today} />}
          </>
        )}
      </div>
    </div>
  );
}

function summary(count: Record<Element, number>) {
  const max = Math.max(...ELEMENTS.map((e) => count[e]));
  const most = ELEMENTS.filter((e) => count[e] === max);
  const missing = ELEMENTS.filter((e) => count[e] === 0);
  const parts = [`가장 많은 기운은 ${most.join("·")}(${max}개)입니다.`];
  parts.push(missing.length ? `${missing.join("·")} 기운은 팔자에 없습니다.` : "다섯 기운이 모두 있습니다.");
  return parts.join(" ");
}

function Reading({ r }: { r: SajuResult }) {
  const dm = DAY_MASTER[r.dayMaster.stem];
  const manyEl = ELEMENTS.filter((e) => r.elementCount[e] >= MANY);
  const noneEl = ELEMENTS.filter((e) => r.elementCount[e] === 0);
  const total = Object.values(r.tenGodCount).reduce((a, b) => a + b, 0);
  const natalRel = findRelations(natalSlots(r));
  const natalShinsal = findShinsal(natalSlots(r));
  const gods = [...new Set(r.pillars.flatMap((p) => [p.stemTenGod, p.branchTenGod]).filter((g): g is TenGod => !!g))];

  return (
    <div className="saju-reading">
      <h3>사주 풀이</h3>

      <section className="saju-card">
        <h4>{r.dayMaster.stemKo}{r.dayMaster.element}({r.dayMaster.stem}{ELEMENT_HANJA[r.dayMaster.element]}) 일간 · {dm.symbol}</h4>
        <p>{dm.summary}</p>
        <p className="saju-tags">{dm.strengths.map((s) => <span key={s}>{s}</span>)}</p>
        <p><b>이런 점은 조심하세요.</b> {dm.caution}</p>
      </section>

      <section className="saju-card">
        <h4>오행의 균형</h4>
        {manyEl.length === 0 && noneEl.length === 0 && (
          <p>다섯 기운이 고르게 섞여 있어 어느 한쪽으로 크게 치우치지 않습니다. 상황에 맞춰 여러 모습을 꺼내 쓸 수 있는 균형 잡힌 구성입니다.</p>
        )}
        {manyEl.map((e) => (
          <p key={e}><b>{e}({ELEMENT_TEXT[e].trait}) 기운이 많음 · {r.elementCount[e]}개</b><br />{ELEMENT_TEXT[e].many}</p>
        ))}
        {noneEl.map((e) => (
          <p key={e}><b>{e}({ELEMENT_TEXT[e].trait}) 기운이 없음</b><br />{ELEMENT_TEXT[e].none}{r.elementPower[e] > 0 && ` ${HIDDEN_ONLY}`}</p>
        ))}
      </section>

      <section className="saju-card">
        <h4>지장간으로 본 뿌리와 드러난 기운</h4>
        <p>
          <b>{r.roots.length ? `통근 · ${r.roots.join(", ")}` : "통근 없음"}</b><br />
          {r.roots.length ? ROOT_TEXT.rooted : ROOT_TEXT.none}
        </p>
        <p>
          <b>{r.revealed.length ? `투출 · ${r.revealed.map((x) => `${x.stem}(${x.places.join("·")})`).join(", ")}` : "투출 없음"}</b><br />
          {r.revealed.length ? REVEAL_TEXT.some : REVEAL_TEXT.none}
        </p>
      </section>

      <section className="saju-card">
        <h4>십신으로 본 성향</h4>
        <p className="saju-muted">일간을 기준으로 나머지 {total}글자가 나와 어떤 관계인지 나눈 것입니다.</p>
        <div className="saju-elements">
          {TEN_GOD_GROUPS.map((g) => (
            <div key={g} className="saju-el-row wide">
              <span>{g}</span>
              <span className="saju-bar"><i style={{ width: `${(r.tenGodCount[g] / total) * 100}%` }} /></span>
              <strong>{r.tenGodCount[g]}</strong>
            </div>
          ))}
        </div>
        {TEN_GOD_GROUPS.filter((g) => r.tenGodCount[g] >= MANY || r.tenGodCount[g] === 0).map((g) => {
          const t = TEN_GOD_GROUP_TEXT[g];
          const many = r.tenGodCount[g] >= MANY;
          return (
            <p key={g}><b>{t.label} {many ? `많음 · ${r.tenGodCount[g]}개` : "없음"}</b> <span className="saju-muted">({t.meaning})</span><br />{many ? t.many : t.none}</p>
          );
        })}
        <details>
          <summary>내 사주에 있는 십신 뜻</summary>
          <ul className="saju-notes">
            {gods.sort((a, b) => TEN_GOD_GROUPS.indexOf(groupOf(a)) - TEN_GOD_GROUPS.indexOf(groupOf(b))).map((g) => (
              <li key={g}><b>{g}</b>: {TEN_GOD_MEANING[g]}</li>
            ))}
          </ul>
        </details>
      </section>

      <section className="saju-card">
        <h4>합·충·형·파·해</h4>
        {natalRel.length ? (
          <Relations list={natalRel} />
        ) : (
          <p>팔자 안에 서로 묶이거나(합) 부딪히는(충·형·파·해) 글자가 없습니다. 크게 흔들림이 없는 비교적 안정된 구성입니다.</p>
        )}
      </section>

      <section className="saju-card">
        <h4>신살</h4>
        {natalShinsal.length ? (
          <ShinsalList list={natalShinsal} />
        ) : (
          <p>흔히 보는 신살 가운데 팔자에 걸린 것이 없습니다.</p>
        )}
      </section>

      <p className="saju-muted">풀이는 일간·오행·십신, 합·충·형·파·해, 신살의 일반적인 의미를 풀어 쓴 것입니다. 신살은 학파마다 기준이 조금씩 달라 다른 만세력과 결과가 다를 수 있습니다. 재미와 참고용으로 봐 주세요. 두 사람의 궁합은 <Link href="/tools/saju-match">우리 궁합 보기</Link>에서 볼 수 있습니다.</p>
    </div>
  );
}

// 운에 들어온 기운이 팔자에 없거나 이미 많은 오행이면 한 줄로 알려 줍니다.
function elementNotes(r: SajuResult, p: LuckPillar) {
  return [...new Set([p.stemElement, p.branchElement])].flatMap((e) => {
    const n = r.elementCount[e];
    if (n === 0) return [`팔자에 없던 ${e}(${ELEMENT_TEXT[e].trait}) 기운이 들어와 부족한 부분을 채워 줍니다.`];
    if (n >= MANY) return [`이미 많은 ${e} 기운이 더해져 그 성향이 지나치게 강해질 수 있습니다.`];
    return [];
  });
}

function LuckRow({ items, selected, onSelect, caption }: { items: LuckPillar[]; selected: number; onSelect: (i: number) => void; caption: (p: LuckPillar) => string }) {
  return (
    <div className="saju-luck-row" role="group">
      {items.map((p, i) => (
        <button key={i} type="button" className="saju-luck" aria-pressed={i === selected} onClick={() => onSelect(i)}>
          <small>{caption(p)}</small>
          <b className={EL_CLASS[p.stemElement]}>{p.stem}</b>
          <b className={EL_CLASS[p.branchElement]}>{p.branch}</b>
          <small>{p.stemKo}{p.branchKo}{p.current ? " · 지금" : ""}</small>
        </button>
      ))}
    </div>
  );
}

function LuckDetail({ r, p, title, name }: { r: SajuResult; p: LuckPillar; title: string; name: "대운" | "세운" }) {
  const slots = [...natalSlots(r), { name, stem: p.stem, branch: p.branch }];
  const rel = findRelations(slots, name);
  const shinsal = findShinsal(slots, name);
  return (
    <div className="saju-luck-detail">
      <h4>{title}</h4>
      <p><b>{p.stem}({p.stemKo}{p.stemElement}) · {p.stemTenGod}</b><br />{LUCK_TEXT[p.stemTenGod!]}</p>
      <p><b>{p.branch}({p.branchKo}{p.branchElement}) · {p.branchTenGod}</b><br />{LUCK_TEXT[p.branchTenGod]}</p>
      {elementNotes(r, p).map((n) => <p key={n}>{n}</p>)}
      {rel.length > 0 && <Relations list={rel} />}
      {shinsal.length > 0 && <ShinsalList list={shinsal} />}
    </div>
  );
}

function Luck({ r, gender, today }: { r: SajuResult; gender: "male" | "female"; today: { year: number; month: number; day: number } }) {
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
      <h3>대운 (10년마다 바뀌는 큰 흐름)</h3>
      <p className="saju-muted">
        {l.forward ? "순행" : "역행"} · 태어나고 {l.start.years}년 {l.start.months}개월 뒤부터 10년씩 바뀝니다.
        {curDaeun < 0 && " 아직 첫 대운이 시작되기 전입니다."}
        {!r.usedTime && " 태어난 시각을 모르면 시작 시점이 몇 달 어긋날 수 있습니다."}
      </p>
      <LuckRow items={l.daeun} selected={di} onSelect={setDSel} caption={(p) => `만 ${p.age}세`} />
      <LuckDetail r={r} p={d} name="대운" title={`${d.year}년 ${d.month}월부터 10년 (만 ${d.age}~${d.age + 9}세)`} />

      <h3>세운 (해마다 바뀌는 흐름)</h3>
      <LuckRow items={l.seun} selected={si} onSelect={setSSel} caption={(p) => `${p.year}`} />
      <LuckDetail r={r} p={s} name="세운" title={`${s.year}년 ${s.stemKo}${s.branchKo}년${s.age >= 0 ? ` (생일 지나면 만 ${s.age}세)` : ""}`} />
      <p className="saju-muted">대운의 천간은 앞 5년, 지지는 뒤 5년에 더 크게 작용한다고 봅니다. 세운은 입춘(2월 4일 무렵)에 바뀝니다. 합·충 같은 글자 사이의 작용은 반영하지 않은 간단한 풀이입니다.</p>
    </div>
  );
}

function Relations({ list }: { list: Relation[] }) {
  return (
    <ul className="saju-rel">
      {list.map((x) => (
        <li key={x.kind + x.places.join()}>
          <b>{x.chars} {x.kind}{x.element ? `(${x.element})` : ""}{x.name ? ` · ${x.name}` : ""}</b>
          <span className="saju-muted"> · {x.places.map((p) => (PLACE_MEANING[p] ? `${p}(${PLACE_MEANING[p]})` : p)).join(" – ")}</span>
          <br />
          {RELATION_TEXT[x.kind](x.element, x.name)}
          {x.kind === "지지충" && x.places.includes("일지") && ` ${SPOUSE_CLASH}`}
        </li>
      ))}
    </ul>
  );
}

const TONE_CLASS = { 길: "good", 흉: "bad", 양면: "mixed" } as const;

function ShinsalList({ list }: { list: Shinsal[] }) {
  return (
    <ul className="saju-rel">
      {list.map((x) => {
        const t = SHINSAL_TEXT[x.name];
        return (
          <li key={x.name}>
            <b>{x.name}</b> <span className={`saju-tone ${TONE_CLASS[t.tone]}`}>{t.tone === "양면" ? "양면" : t.tone === "길" ? "길신" : "흉신"}</span>
            <span className="saju-muted"> · {x.places.map((p) => (PLACE_MEANING[p] ? `${p}(${PLACE_MEANING[p]})` : p)).join(", ")}</span>
            <br />
            {t.text}
          </li>
        );
      })}
    </ul>
  );
}
