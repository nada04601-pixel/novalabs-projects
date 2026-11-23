import { calcLoan, type RepaymentMethod } from "@/lib/calculators/loan";
import type { GuideExtra, ToolExtra } from "../types";
import { SRC, krw, n, pc, rt, won } from "./fmt";

// 대출 상환 방식 가이드(loan-repayment-methods)와 대출이자 계산기(loan-interest) 보강.

const loan = (principal: number, rate: number, months: number, method: RepaymentMethod) => calcLoan(principal, rate, months, method);

// 1) 3억 원·30년, 금리별 비교
const BIG = 300_000_000;
const BIG_M = 360;
const RATES_EX = [0.03, 0.04, 0.05, 0.06];
const bigRows = RATES_EX.map((r) => ({
  r,
  a: loan(BIG, r, BIG_M, "annuity"),
  e: loan(BIG, r, BIG_M, "equalPrincipal"),
  b: loan(BIG, r, BIG_M, "bullet"),
}));
const big4 = bigRows[1];
// 원금균등 월 납입액이 원리금균등보다 적어지는 첫 회차(연 4%)
const crossMonth = big4.e.schedule.findIndex((row) => row.payment < big4.a.firstPayment) + 1;
const step34 = bigRows[1].a.firstPayment - bigRows[0].a.firstPayment;
const step45 = bigRows[2].a.firstPayment - bigRows[1].a.firstPayment;
const step56 = bigRows[3].a.firstPayment - bigRows[2].a.firstPayment;

// 2) 1억 원·연 4%, 기간별
const MID = 100_000_000;
const MID_R = 0.04;
const termRows = [10, 20, 30].map((y) => ({
  y,
  a: loan(MID, MID_R, y * 12, "annuity"),
  e: loan(MID, MID_R, y * 12, "equalPrincipal"),
}));
const t10 = termRows[0];
const t30 = termRows[2];

// 3) 2억 원·연 4%·30년 상환표
const EX = 200_000_000;
const EX_R = 0.04;
const exA = loan(EX, EX_R, 360, "annuity");
const exE = loan(EX, EX_R, 360, "equalPrincipal");
const paidInterest = (m: number) => exA.schedule.slice(0, m).reduce((s, row) => s + row.interest, 0);
const balanceRows = [5, 10, 15, 20, 25].map((y) => ({ y, a: exA.schedule[y * 12 - 1].balance, e: exE.schedule[y * 12 - 1].balance, paid: paidInterest(y * 12) }));
const halfMonth = exA.schedule.findIndex((row) => row.balance <= EX / 2) + 1;
const bal10 = exA.schedule[119].balance;

// 4) 변동금리: 3억 원·연 4%·30년 원리금균등, 5년 뒤 연 5%로 오름
const RISE_FROM = 0.04;
const RISE_TO = 0.05;
const riseBase = loan(BIG, RISE_FROM, BIG_M, "annuity");
const riseBal = riseBase.schedule[59].balance;
const riseNew = loan(riseBal, RISE_TO, BIG_M - 60, "annuity").firstPayment;
const riseFull = loan(BIG, RISE_TO, BIG_M, "annuity").firstPayment;

// 5년 예시(원래 글의 1억 원·4.5%) 차이: 원래 글이 "수십만 원"이라고 한 값
const orig = { a: loan(MID, 0.045, 60, "annuity"), e: loan(MID, 0.045, 60, "equalPrincipal") };

export const loanGuide: GuideExtra = {
  updated: "2026-11-23",
  mode: "append",
  sections: [
    {
      heading: "3억 원을 30년 동안 갚으면: 금리별 월 상환액",
      body: [
        `위의 ${krw(MID)}·5년 예시보다 금액과 기간을 키워, 주택담보대출을 떠올리고 고른 ${krw(BIG)}·30년(${BIG_M}개월) 조건으로 세 방식을 다시 계산했습니다. 연 ${rt(RATES_EX[0])}~${rt(RATES_EX[RATES_EX.length - 1])}는 비교를 위해 고른 예시 금리이며 실제 시장 금리를 뜻하지 않습니다.`,
        `원금균등은 첫 달 부담이 원리금균등보다 크지만 마지막 달에는 ${won(big4.e.lastPayment)} 안팎으로 줄어듭니다. 금리가 달라도 마지막 달 금액이 거의 같은 것은 그때 남은 원금이 한 달 치(${won(BIG / BIG_M)})뿐이라 이자가 아주 작기 때문입니다.`,
      ],
      table: {
        caption: `대출 ${krw(BIG)}, 30년 상환 시 매달 내는 돈`,
        head: ["연 금리(예시)", "원리금균등 매달", "원금균등 첫 달", "원금균등 마지막 달", "만기일시 매달(이자만)"],
        rows: bigRows.map(({ r, a, e, b }) => [`연 ${rt(r)}`, won(a.firstPayment), won(e.firstPayment), won(e.lastPayment), won(b.firstPayment)]),
        note: "이 사이트의 대출이자 계산기와 같은 방식(월 이율 = 연 금리 ÷ 12)으로 계산하고 원 단위에서 반올림했습니다. 거치 기간, 보증료, 중도상환은 넣지 않았습니다.",
      },
      after: [
        `금리가 1%포인트 오를 때 원리금균등 월 상환액은 ${rt(RATES_EX[0])}→${rt(RATES_EX[1])}에서 ${won(step34)}, ${rt(RATES_EX[1])}→${rt(RATES_EX[2])}에서 ${won(step45)}, ${rt(RATES_EX[2])}→${rt(RATES_EX[3])}에서 ${won(step56)} 늘어납니다. 같은 1%포인트라도 금리가 높은 구간일수록 늘어나는 폭이 조금씩 커집니다.`,
      ],
    },
    {
      heading: "30년 총이자로 보면 방식 선택의 무게가 달라집니다",
      body: [
        "월 상환액만 보면 원리금균등이 편해 보이지만, 30년 동안 낸 이자를 모두 더하면 방식에 따라 수천만 원이 차이 납니다. 같은 조건의 총이자를 나란히 놓았습니다.",
      ],
      table: {
        caption: `대출 ${krw(BIG)}, 30년 상환 시 총이자`,
        head: ["연 금리(예시)", "원리금균등", "원금균등", "만기일시", "원리금균등 − 원금균등"],
        rows: bigRows.map(({ r, a, e, b }) => [`연 ${rt(r)}`, krw(a.totalInterest), krw(e.totalInterest), krw(b.totalInterest), krw(a.totalInterest - e.totalInterest)]),
        note: "총이자는 360회 동안 낸 이자를 모두 더한 값이며 만 원 단위에서 반올림했습니다. 만기일시는 30년 동안 원금을 한 번도 갚지 않는다고 가정한 값으로, 실제 주택담보대출에서는 거의 쓰지 않는 방식입니다.",
      },
      after: [
        `연 ${rt(big4.r)}에서 원리금균등은 원금균등보다 이자를 ${krw(big4.a.totalInterest - big4.e.totalInterest)} 더 냅니다. 위의 5년 예시에서는 이 차이가 ${krw(orig.a.totalInterest - orig.e.totalInterest)} 수준이었는데, 금액이 커지고 기간이 길어지면 차이도 그만큼 크게 벌어집니다.`,
        `원금균등을 고르면 첫 달에 원리금균등보다 ${won(big4.e.firstPayment - big4.a.firstPayment)}을 더 내야 합니다. 그 대신 원금이 빨리 줄어 뒤로 갈수록 이자가 작아지고, ${crossMonth}회차(약 ${Math.ceil(crossMonth / 12)}년차)부터는 원금균등의 월 납입액이 원리금균등보다 적어집니다.`,
      ],
    },
    {
      heading: "상환 기간을 늘리면 월 부담은 줄고 이자는 늘어납니다",
      body: [
        `같은 ${krw(MID)}을 연 ${rt(MID_R)}(예시)로 빌려도 상환 기간을 10년, 20년, 30년 가운데 무엇으로 정하느냐에 따라 매달 내는 돈과 총이자가 크게 달라집니다.`,
      ],
      table: {
        caption: `대출 ${krw(MID)}, 연 ${rt(MID_R)}(예시) 상환 기간별 비교`,
        head: ["상환 기간", "원리금균등 매달", "원리금균등 총이자", "원금균등 첫 달", "원금균등 총이자"],
        rows: termRows.map(({ y, a, e }) => [`${y}년`, won(a.firstPayment), krw(a.totalInterest), won(e.firstPayment), krw(e.totalInterest)]),
        note: "월 금액은 원 단위, 총이자는 만 원 단위에서 반올림했습니다.",
      },
      after: [
        `10년을 30년으로 늘리면 원리금균등 월 상환액은 ${won(t10.a.firstPayment - t30.a.firstPayment)} 줄지만 총이자는 ${krw(t30.a.totalInterest - t10.a.totalInterest)} 늘어납니다. 기간을 길게 잡으면 매달 숨통은 트이지만 그 대가가 이자로 돌아온다는 뜻입니다.`,
        "그래서 이자만 놓고 보면 감당할 수 있는 범위에서 기간을 짧게 잡고, 여유가 생길 때 일부 상환하는 쪽이 유리합니다. 다만 기간을 줄여 월 부담이 커지면 비상금이 줄어드는 만큼, 소득이 줄어드는 상황도 함께 생각해 정해야 합니다.",
      ],
    },
    {
      heading: "2억 원 대출, 첫 3개월 상환표 따라가 보기",
      body: [
        `${krw(EX)}을 연 ${rt(EX_R)}, 30년 조건으로 빌린다고 해 보겠습니다(금리는 예시입니다). 첫 3개월의 계산은 다음 순서로 이어집니다.`,
        `① 월 이율을 구합니다. 연 ${rt(EX_R)} ÷ 12 = 약 ${pc(EX_R / 12, 4)}입니다.`,
        `② 첫 달 이자는 남은 원금에 월 이율을 곱한 값입니다. ${krw(EX)} × ${pc(EX_R / 12, 4)} = ${won(exA.schedule[0].interest)}이고, 첫 달에는 두 방식의 이자가 같습니다.`,
        `③ 원리금균등은 매달 내는 돈이 ${won(exA.firstPayment)}으로 정해져 있어, 여기서 이자를 뺀 ${won(exA.schedule[0].principal)}만 원금을 갚습니다. 원금균등은 원금 ${krw(EX)}을 360으로 나눈 ${won(EX / 360)}을 매달 갚고 이자를 더해 첫 달에 ${won(exE.firstPayment)}을 냅니다.`,
        `④ 둘째 달 이자는 줄어든 잔액으로 다시 계산합니다. 원리금균등은 잔액 ${won(exA.schedule[0].balance)}에 대한 이자 ${won(exA.schedule[1].interest)}, 원금균등은 잔액 ${won(exE.schedule[0].balance)}에 대한 이자 ${won(exE.schedule[1].interest)}을 냅니다.`,
      ],
      table: {
        caption: `대출 ${krw(EX)}, 연 ${rt(EX_R)}(예시), 30년: 첫 3개월`,
        head: ["회차", "원리금균등 이자", "원리금균등 원금", "원리금균등 잔액", "원금균등 납입액", "원금균등 잔액"],
        rows: [0, 1, 2].map((i) => [
          `${i + 1}회차`,
          won(exA.schedule[i].interest),
          won(exA.schedule[i].principal),
          won(exA.schedule[i].balance),
          won(exE.schedule[i].payment),
          won(exE.schedule[i].balance),
        ]),
        note: "원 단위에서 반올림했습니다. 실제 대출은 이자를 날짜 수로 계산하는 경우가 많아 금액이 조금 다를 수 있습니다.",
      },
      after: [
        `원리금균등의 첫 달 납입액 ${won(exA.firstPayment)} 가운데 ${pc(exA.schedule[0].interest / exA.firstPayment, 1)}가 이자입니다. 매달 같은 돈을 내도 처음 몇 년은 대부분이 이자로 나가고, 원금은 아주 천천히 줄어듭니다.`,
      ],
    },
    {
      heading: "10년을 갚아도 원금은 얼마나 남아 있을까",
      body: [
        `위의 ${krw(EX)} 대출을 계속 갚아 나갈 때 몇 년 뒤에 잔액이 얼마인지 보면 원리금균등의 초반 원금 감소가 얼마나 더딘지 알 수 있습니다. 집을 팔거나 대출을 갈아탈 때 한 번에 갚아야 하는 돈이 바로 이 잔액입니다.`,
      ],
      table: {
        caption: `대출 ${krw(EX)}, 연 ${rt(EX_R)}(예시), 30년: 경과 기간별 남은 원금`,
        head: ["경과 기간", "원리금균등 잔액", "원금균등 잔액", "원리금균등으로 그때까지 낸 이자"],
        rows: balanceRows.map(({ y, a, e, paid }) => [`${y}년(${y * 12}회)`, krw(a), krw(e), krw(paid)]),
        note: "해당 연차의 마지막 회차를 낸 직후 잔액이며 만 원 단위에서 반올림했습니다.",
      },
      after: [
        `원리금균등으로 10년(120회)을 갚으면 이자로 ${krw(paidInterest(120))}을 냈지만 원금은 ${krw(EX - bal10)}만 줄어 ${krw(bal10)}이 남습니다. 잔액이 처음 원금의 절반 아래로 내려가는 것은 ${halfMonth}회차, 약 ${Math.ceil(halfMonth / 12)}년차입니다.`,
        "몇 년 안에 이사나 갈아타기를 계획한다면 월 상환액이 아니라 그 시점의 잔액을 기준으로 자금 계획을 세워야 합니다. 대출이자 계산기의 상환표에서 원하는 회차의 잔액을 바로 확인할 수 있습니다.",
      ],
    },
    {
      heading: "변동금리 대출에서 금리가 오르면",
      body: [
        `변동금리 대출은 정해진 주기마다 금리가 바뀌고, 그때 남은 원금과 남은 기간으로 월 상환액을 다시 계산하는 경우가 많습니다. ${krw(BIG)}을 연 ${rt(RISE_FROM)}, 30년 원리금균등으로 빌렸다가 5년 뒤 금리가 연 ${rt(RISE_TO)}로 오르는 경우를 계산해 보겠습니다(금리는 예시입니다).`,
        `처음 월 상환액은 ${won(riseBase.firstPayment)}이고, 60회를 갚은 뒤 남은 원금은 ${krw(riseBal)}입니다. 이 잔액을 남은 25년(300회) 동안 연 ${rt(RISE_TO)}로 다시 나누면 월 상환액은 ${won(riseNew)}으로 ${won(riseNew - riseBase.firstPayment)} 늘어납니다.`,
      ],
      after: [
        `처음부터 연 ${rt(RISE_TO)}였을 때의 월 상환액(${won(riseFull)})보다는 적지만, 금리가 1%포인트 오른 것만으로 매달 부담이 ${pc((riseNew - riseBase.firstPayment) / riseBase.firstPayment, 1)} 커집니다. 금리 변경 주기, 금리 상한이 있는지, 상환액을 다시 계산하는 방식은 상품마다 다르므로 계약서의 금리 변경 조건을 확인하고, 금리가 1~2%포인트 오른 경우의 월 상환액을 미리 계산해 두세요.`,
      ],
    },
    {
      heading: "상환 방식을 고를 때 자주 하는 실수",
      body: [
        "첫째, 첫 달 금액만 보고 판단하는 경우입니다. 원금균등의 첫 달 금액은 가장 무거운 달의 금액이고 이후 매달 줄어듭니다. 원리금균등은 마지막 달까지 같은 금액이므로, 두 방식은 첫 달 금액이 아니라 총이자와 내 현금 흐름으로 비교해야 합니다.",
        "둘째, 만기일시 신용대출을 연장만 반복하는 경우입니다. 연장할 때마다 원금은 그대로이고 이자만 계속 나갑니다. 연장 시점마다 일부라도 원금을 줄이는 계획을 세워 두지 않으면 몇 년이 지나도 빚의 크기가 변하지 않습니다.",
        "셋째, 중도상환수수료를 확인하지 않는 경우입니다. 금융소비자보호법은 대출계약이 성립한 날부터 3년 이내에 갚는 경우 등에만 중도상환수수료를 받을 수 있게 하고 있고, 은행 등에서 2025년 1월 13일 이후 새로 맺은 대출부터는 수수료를 실제로 드는 비용 범위에서만 받도록 바뀌었습니다. 일부 상환을 계획한다면 계약 전에 수수료율과 면제 시점을 확인하세요.",
        "넷째, 금융회사가 안내하는 방식을 그대로 받아들이는 경우입니다. 금융소비자보호법은 금융회사가 자기나 제3자의 이익을 위해 특정 상환 방식을 강요하는 것을 불공정영업행위로 금지합니다. 방식별 월 상환액, 총이자, 한도를 함께 보여 달라고 요청해 비교한 뒤 고르세요.",
      ],
    },
  ],
  sources: [SRC.consumerLaw, SRC.fscPrepay, SRC.finlife],
};

// ===== 대출이자 계산기 =====
const T_P = 50_000_000;
const T_R = 0.055;
const T_Y = 5;
const tRows = (["annuity", "equalPrincipal", "bullet"] as const).map((m) => ({ m, r: loan(T_P, T_R, T_Y * 12, m) }));
const tA = tRows[0].r;
const tE = tRows[1].r;
const tB = tRows[2].r;
const LABEL: Record<RepaymentMethod, string> = { annuity: "원리금균등", equalPrincipal: "원금균등", bullet: "만기일시" };

const S_P = 200_000_000;
const S_Y = 20;
const S_RATES = [0.035, 0.04, 0.045, 0.05, 0.055];
const sRows = S_RATES.map((r) => ({ r, a: loan(S_P, r, S_Y * 12, "annuity") }));
const sBase = sRows[0].a;
const sStep = sRows[1].a.totalInterest - sRows[0].a.totalInterest;

export const loanTool: ToolExtra = {
  updated: "2026-11-23",
  sections: [
    {
      heading: `계산 예시: ${krw(T_P)}, 연 ${rt(T_R)}, ${T_Y}년`,
      body: [
        `대출 금액 칸에 ${n(T_P / 10_000)}(만원), 연 이자율 ${rt(T_R).replace("%", "")}, 상환 기간 ${T_Y}를 넣으면 세 방식은 아래처럼 나옵니다. 신용대출을 떠올리고 고른 예시 값입니다. 대출 금액 칸은 만 원 단위라서 2억 원이라면 20000을 넣습니다.`,
      ],
      table: {
        caption: `대출 ${krw(T_P)}, 연 ${rt(T_R)}(예시), ${T_Y}년(${T_Y * 12}개월)`,
        head: ["상환 방식", "첫 달", "마지막 달", "총이자", "총 상환액"],
        rows: tRows.map(({ m, r }) => [LABEL[m], won(r.firstPayment), won(r.lastPayment), won(r.totalInterest), won(r.totalPayment)]),
        note: "원 단위에서 반올림했습니다. 만기일시의 마지막 달 금액에는 원금 전체가 들어 있습니다.",
      },
      after: [
        `원금균등은 원리금균등보다 총이자가 ${won(tA.totalInterest - tE.totalInterest)} 적고, 만기일시는 원리금균등보다 ${won(tB.totalInterest - tA.totalInterest)} 많습니다. 만기일시는 매달 ${won(tB.firstPayment)}만 내면 되지만 마지막 달에 ${won(tB.lastPayment)}을 한 번에 마련해야 한다는 점을 함께 보세요.`,
      ],
    },
    {
      heading: "금리 0.5%포인트 차이를 금액으로 바꿔 보기",
      body: [
        `주택담보대출처럼 금액이 크고 기간이 길면 금리 0.5%포인트 차이도 큰 돈이 됩니다. ${krw(S_P)}을 ${S_Y}년 원리금균등으로 빌릴 때 금리별 결과입니다(금리는 예시).`,
      ],
      table: {
        caption: `대출 ${krw(S_P)}, ${S_Y}년, 원리금균등`,
        head: ["연 금리(예시)", "월 상환액", "총이자", `연 ${rt(S_RATES[0])} 대비 더 내는 이자`],
        rows: sRows.map(({ r, a }) => [`연 ${rt(r)}`, won(a.firstPayment), krw(a.totalInterest), r === S_RATES[0] ? "-" : krw(a.totalInterest - sBase.totalInterest)]),
        note: "월 상환액은 원 단위, 총이자는 만 원 단위에서 반올림했습니다.",
      },
      after: [
        `연 ${rt(S_RATES[0])}에서 ${rt(S_RATES[1])}로 0.5%포인트만 올라도 ${S_Y}년 동안 이자가 ${krw(sStep)} 늘어납니다. 금융회사를 비교할 때 금리 차이가 작아 보여도, 이 계산기에 두 금리를 각각 넣어 총이자 차이를 확인하면 중도상환수수료나 부대비용을 감수할 만한지 판단하기 쉬워집니다.`,
      ],
    },
    {
      heading: "상환표를 활용하는 방법",
      body: [
        "계산 결과 아래의 상환표에는 회차마다 갚는 원금, 이자, 남은 잔액이 나옵니다. 잔액 칸은 대출을 중간에 모두 갚거나 다른 대출로 갈아탈 때 필요한 금액을 가늠하는 데 씁니다. 예를 들어 3년 뒤 갈아타기를 생각한다면 36회차의 잔액이 새로 빌려야 할 금액의 출발점입니다.",
        "원금 칸은 내 돈이 실제로 빚을 줄이는 데 얼마나 쓰이는지 보여 줍니다. 원리금균등은 초반 회차의 원금 비중이 작으므로, 같은 금액을 일부 상환할 때 남은 기간이 길수록 줄어드는 이자도 커집니다. 일부 상환 뒤의 효과를 보려면 대출 금액 칸에 줄어든 잔액을, 기간 칸에 남은 기간을 넣어 다시 계산하면 됩니다.",
      ],
    },
  ],
  sources: [SRC.consumerLaw, SRC.fscPrepay, SRC.finlife],
};
