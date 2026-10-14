// 로또 6/45 당첨 결과를 받아 src/data/lotto/draws.json에 이어 붙입니다.
// 사용: node scripts/update-lotto.mjs        (빠진 회차만 받아 추가)
//       node scripts/update-lotto.mjs --all  (전체를 다시 받아 덮어쓰기)
// 자료: 동행복권 발표 결과를 회차별 JSON으로 공개하는 저장소(github.com/smok95/lotto)
import { readFile, writeFile } from "node:fs/promises";

const BASE = "https://raw.githubusercontent.com/smok95/lotto/main/results";
const FILE = new URL("../src/data/lotto/draws.json", import.meta.url);

async function getJson(url) {
  const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

// 원본 형식을 사이트에서 쓰는 형식으로 바꾸고, 이상한 값이 섞이면 멈춥니다.
function convert(r) {
  const nums = [...r.numbers].sort((a, b) => a - b);
  const all = [...nums, r.bonus_no];
  const ok =
    Number.isInteger(r.draw_no) &&
    nums.length === 6 &&
    all.every((n) => Number.isInteger(n) && n >= 1 && n <= 45) &&
    new Set(all).size === 7 &&
    /^\d{4}-\d{2}-\d{2}/.test(r.date) &&
    Array.isArray(r.divisions) &&
    r.divisions.length === 5;
  if (!ok) throw new Error(`잘못된 회차 자료: ${JSON.stringify(r)}`);
  const c = r.winners_combination ?? {};
  return {
    no: r.draw_no,
    date: r.date.slice(0, 10),
    nums,
    bonus: r.bonus_no,
    // 등위별 [1게임당 당첨금, 당첨 게임 수]. 당첨자가 없던 등위는 [0, 0]
    prizes: r.divisions.map((d) => [d.prize ?? 0, d.winners ?? 0]),
    sales: r.total_sales_amount ?? 0,
    firstBy: { auto: c.auto ?? 0, manual: c.manual ?? 0, semi: c.semi_auto ?? 0 },
  };
}

function serialize(draws) {
  // 회차당 한 줄로 저장해 변경 내역을 보기 쉽게 합니다.
  return "[\n" + draws.map((d) => JSON.stringify(d)).join(",\n") + "\n]\n";
}

async function main() {
  let draws = [];
  if (!process.argv.includes("--all")) {
    try {
      draws = JSON.parse(await readFile(FILE, "utf8"));
    } catch {
      draws = [];
    }
  }

  if (draws.length === 0) {
    draws = (await getJson(`${BASE}/all.json`)).map(convert);
  } else {
    const latest = (await getJson(`${BASE}/latest.json`)).draw_no;
    for (let no = draws.at(-1).no + 1; no <= latest; no++) draws.push(convert(await getJson(`${BASE}/${no}.json`)));
  }

  draws.sort((a, b) => a.no - b.no);
  draws.forEach((d, i) => {
    if (d.no !== i + 1) throw new Error(`회차가 비어 있습니다: ${i + 1}회`);
  });

  const before = await readFile(FILE, "utf8").catch(() => "");
  const after = serialize(draws);
  if (before === after) {
    console.log(`변경 없음 (최신 ${draws.at(-1).no}회)`);
    return;
  }
  await writeFile(FILE, after);
  console.log(`저장 완료: 1~${draws.at(-1).no}회 (${draws.at(-1).date})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
