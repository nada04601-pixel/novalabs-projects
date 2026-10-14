// 로또 6/45 회차별 1등 배출점(당첨 판매점)을 동행복권에서 받아 src/data/lotto/stores.json에 저장합니다.
// 사용: node scripts/update-lotto-stores.mjs               (아직 없는 회차만, 최대 20분)
//       node scripts/update-lotto-stores.mjs --minutes 100 (처음 채울 때처럼 오래 돌릴 때)
// 동행복권 서버는 해외에서 접속하면 연결이 자주 끊겨서, 요청마다 여러 번 다시 시도하고
// 시간이 다 되면 받은 데까지 저장합니다. 다음 실행 때 빠진 회차부터 이어서 받습니다.
import { readFile, writeFile } from "node:fs/promises";

const BASE = "https://www.dhlottery.co.kr";
const DRAWS = new URL("../src/data/lotto/draws.json", import.meta.url);
const FILE = new URL("../src/data/lotto/stores.json", import.meta.url);
// 동행복권은 262회부터 1등 배출점을 공개합니다(그 전 회차는 조회해도 빈 목록). src/lib/lotto.ts의 STORES_FROM과 같은 값
const FIRST = 262;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const deadline = Date.now() + arg("--minutes", 20) * 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let cookie = "";

async function request(path, params) {
  const url = `${BASE}${path}${params ? `?${new URLSearchParams(params)}` : ""}`;
  for (let i = 1; i <= 6; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
        headers: {
          "user-agent": UA,
          accept: "application/json, text/html",
          ajax: "true",
          requestmenuuri: "/wnprchsplcsrch/home",
          "x-requested-with": "XMLHttpRequest",
          referer: `${BASE}/wnprchsplcsrch/home`,
          ...(cookie ? { cookie } : {}),
        },
      });
      const set = res.headers.getSetCookie?.() ?? [];
      if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return params ? JSON.parse(await res.text()) : await res.text();
    } catch (e) {
      if (i === 6 || Date.now() > deadline) throw e;
      await sleep(2000 * i);
    }
  }
}

// 동행복권 응답의 한 줄을 [상호, 구분, 주소, 당첨 당시 주소, 폐점 여부]로 줄입니다.
function convert(item) {
  const clean = (s) => (s ?? "").replace(/^\(당첨 당시 주소\)\s*/, "").replace(/\s+/g, " ").trim();
  const name = clean(item.shpNm);
  if (!name) throw new Error(`상호가 없는 판매점: ${JSON.stringify(item)}`);
  const addr = clean(item.shpAddr);
  const old = clean(item.befAddr);
  return [name, clean(item.atmtPsvYnTxt), addr || old, old && old !== addr ? old : "", item.status === "폐점" ? 1 : 0];
}

async function fetchDraw(no) {
  const json = await request("/wnprchsplcsrch/selectLtWnShp.do", { srchWnShpRnk: "1", srchLtEpsd: String(no), srchShpLctn: "" });
  const list = json?.data?.list;
  if (!Array.isArray(list)) throw new Error(`${no}회: 예상과 다른 응답 ${JSON.stringify(json).slice(0, 200)}`);
  return list.filter((x) => x.wnShpRnk === 1 && x.draw === no).map(convert);
}

function serialize(stores) {
  const keys = Object.keys(stores).map(Number).sort((a, b) => a - b);
  return "{\n" + keys.map((k) => `"${k}":${JSON.stringify(stores[k])}`).join(",\n") + "\n}\n";
}

async function main() {
  const draws = JSON.parse(await readFile(DRAWS, "utf8"));
  const latest = draws.at(-1).no;
  const stores = JSON.parse(await readFile(FILE, "utf8").catch(() => "{}"));
  // 1등이 나온 회차 가운데 아직 받지 못한 회차를 최신부터 받습니다(최신 회차가 가장 먼저 필요하므로).
  const todo = draws.filter((d) => d.no >= FIRST && d.prizes[0][1] > 0 && !stores[d.no]).map((d) => d.no).reverse();
  console.log(`받을 회차 ${todo.length}개`);
  if (todo.length === 0) return;

  await request("/wnprchsplcsrch/home").catch(() => {}); // 세션 쿠키 받기 (실패해도 계속)

  let done = 0;
  let failed = 0;
  const save = () => writeFile(FILE, serialize(stores));
  for (const no of todo) {
    if (Date.now() > deadline) break;
    try {
      const list = await fetchDraw(no);
      // 1등이 있었는데 판매점이 비어 있으면, 최근 두 회차는 아직 공개 전일 수 있으니 다음에 다시 받고
      // 그보다 오래된 회차는 동행복권에 자료가 없는 것으로 보고 빈 목록으로 저장합니다.
      if (list.length === 0 && no > latest - 2) {
        console.log(`${no}회: 판매점 정보 아직 없음 (다음에 다시 시도)`);
      } else {
        stores[no] = list;
        done++;
      }
    } catch (e) {
      failed++;
      console.log(`${no}회 실패: ${e.message}`);
    }
    if (done > 0 && done % 25 === 0) await save();
    await sleep(300);
  }
  await save();
  const left = draws.filter((d) => d.no >= FIRST && d.prizes[0][1] > 0 && !stores[d.no]).length;
  console.log(`저장 ${done}개 · 실패 ${failed}개 · 남은 회차 ${left}개`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
