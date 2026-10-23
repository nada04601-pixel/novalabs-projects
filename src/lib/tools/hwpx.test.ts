import { beforeAll, describe, expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { deflateRawSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { zipStore } from "./zip";
import { unzip } from "./unzip";
import { formatNumber, HwpxError, hwpxToHtml } from "./hwpx";
import { equationHtml } from "./hwpxEquation";

// 브라우저에서는 내장 DOMParser를 씁니다
beforeAll(() => {
  (globalThis as unknown as { DOMParser: unknown }).DOMParser = DOMParser;
});

const NS = `xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"`;

const HEADER = `<?xml version="1.0" encoding="UTF-8"?><hh:head ${NS}><hh:refList>
<hh:fontfaces><hh:fontface lang="HANGUL"><hh:font id="0" face="함초롬바탕"/><hh:font id="1" face="돋움"/></hh:fontface><hh:fontface lang="LATIN"><hh:font id="0" face="함초롬바탕"/><hh:font id="1" face="돋움"/></hh:fontface></hh:fontfaces>
<hh:borderFills>
<hh:borderFill id="1"><hh:slash type="NONE"/><hh:backSlash type="NONE"/><hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/><hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/><hh:topBorder type="NONE" width="0.1 mm" color="#000000"/><hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/></hh:borderFill>
<hh:borderFill id="2"><hh:slash type="SOLID"/><hh:backSlash type="SOLID"/><hh:leftBorder type="SOLID" width="0.12 mm" color="#000000"/><hh:rightBorder type="DOUBLE_SLIM" width="0.5 mm" color="#000000"/><hh:topBorder type="SOLID" width="0.12 mm" color="#000000"/><hh:bottomBorder type="DASH" width="0.12 mm" color="#FF0000"/><hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/><hc:fillBrush><hc:winBrush faceColor="#FFFF00" hatchColor="#999999" alpha="0"/></hc:fillBrush></hh:borderFill>
</hh:borderFills>
<hh:charProperties>
<hh:charPr id="0" height="1000" textColor="#000000" shadeColor="none"><hh:fontRef hangul="0" latin="0"/><hh:relSz hangul="100"/><hh:underline type="NONE"/><hh:strikeout shape="NONE"/></hh:charPr>
<hh:charPr id="1" height="1800" textColor="#FFFFFF" shadeColor="#FF0000"><hh:fontRef hangul="1" latin="1"/><hh:bold/><hh:italic/><hh:underline type="BOTTOM" color="#000000"/><hh:strikeout shape="NONE"/></hh:charPr>
</hh:charProperties>
<hh:paraProperties>
<hh:paraPr id="0"><hh:align horizontal="JUSTIFY"/><hh:heading type="NONE" idRef="0" level="0"/><hp:switch><hp:case hp:required-namespace="x"><hh:margin><hc:intent value="-2000"/><hc:left value="1000"/><hc:right value="0"/><hc:prev value="0"/><hc:next value="500"/></hh:margin><hh:lineSpacing type="PERCENT" value="160"/></hp:case></hp:switch></hh:paraPr>
<hh:paraPr id="1"><hh:align horizontal="CENTER"/><hh:heading type="NUMBER" idRef="1" level="0"/></hh:paraPr>
<hh:paraPr id="2"><hh:align horizontal="LEFT"/><hh:heading type="NUMBER" idRef="1" level="1"/></hh:paraPr>
</hh:paraProperties>
<hh:numberings><hh:numbering id="1"><hh:paraHead start="1" level="1" numFormat="DIGIT">^1.</hh:paraHead><hh:paraHead start="1" level="2" numFormat="HANGUL_SYLLABLE">^2)</hh:paraHead></hh:numbering></hh:numberings>
</hh:refList></hh:head>`;

const SECTION = `<?xml version="1.0" encoding="UTF-8"?><hs:sec ${NS}>
<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:secPr><hp:pagePr landscape="WIDELY" width="59528" height="84186"><hp:margin header="4252" footer="4252" left="8504" right="8504" top="5668" bottom="4252"/></hp:pagePr></hp:secPr></hp:run><hp:run charPrIDRef="1"><hp:t>굵은 &amp;<hp:tab width="4000" leader="0"/>끝<hp:lineBreak/>둘째 줄</hp:t></hp:run></hp:p>
<hp:p paraPrIDRef="1"><hp:run charPrIDRef="0"><hp:t>첫 번호</hp:t></hp:run></hp:p>
<hp:p paraPrIDRef="2"><hp:run charPrIDRef="0"><hp:t>하위 번호</hp:t></hp:run></hp:p>
<hp:p paraPrIDRef="2"><hp:run charPrIDRef="0"><hp:t>하위 번호 둘</hp:t></hp:run></hp:p>
<hp:p paraPrIDRef="1"><hp:run charPrIDRef="0"><hp:t>둘째 번호</hp:t></hp:run></hp:p>
<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:tbl rowCnt="2" colCnt="2" borderFillIDRef="1"><hp:sz width="20000" height="4000"/><hp:pos treatAsChar="1"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>
<hp:tr><hp:tc borderFillIDRef="2"><hp:subList vertAlign="CENTER"><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>A1~B1</hp:t></hp:run></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="2" rowSpan="1"/><hp:cellSz width="20000" height="2000"/></hp:tc></hp:tr>
<hp:tr><hp:tc borderFillIDRef="1"><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>A2</hp:t></hp:run></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="1"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="8000" height="2000"/></hp:tc>
<hp:tc borderFillIDRef="1"><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>B2</hp:t></hp:run></hp:p></hp:subList><hp:cellAddr colAddr="1" rowAddr="1"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="12000" height="2000"/></hp:tc></hp:tr>
</hp:tbl></hp:run></hp:p>
<hp:p paraPrIDRef="0" pageBreak="1"><hp:run charPrIDRef="0"><hp:pic textWrap="TOP_AND_BOTTOM"><hp:sz width="7200" height="7200"/><hp:pos treatAsChar="1"/><hc:img binaryItemIDRef="image1"/></hp:pic><hp:t>본문&lt;script&gt;alert(1)&lt;/script&gt;</hp:t><hp:ctrl><hp:footNote number="1"><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>각주 내용</hp:t></hp:run></hp:p></hp:subList></hp:footNote></hp:ctrl></hp:run></hp:p>
<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:ctrl><hp:fieldBegin id="7" type="HYPERLINK"><hp:parameters><hp:stringParam name="Command">https\\://novalabs.co.kr;1;0;0;</hp:stringParam></hp:parameters></hp:fieldBegin></hp:ctrl><hp:t>링크</hp:t><hp:ctrl><hp:fieldEnd beginIDRef="7"/></hp:ctrl><hp:t> 뒤</hp:t><hp:dutmal posType="TOP"><hp:mainText>본말</hp:mainText><hp:subText>덧말</hp:subText></hp:dutmal></hp:run></hp:p>
<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"/></hp:p>
</hs:sec>`;

const HPF = `<?xml version="1.0" encoding="UTF-8"?><opf:package xmlns:opf="http://www.idpf.org/2007/opf/"><opf:metadata><opf:title>시험 문서</opf:title></opf:metadata><opf:manifest>
<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="image1" href="BinData/image1.png" media-type="image/png"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>
</opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>`;

const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAwAI/AL+p5qgoAAAAABJRU5ErkJggg==", "base64"));

const enc = new TextEncoder();
function makeHwpx(extra: Record<string, string> = {}) {
  return zipStore([
    { name: "mimetype", data: enc.encode("application/hwp+zip") },
    { name: "Contents/content.hpf", data: enc.encode(HPF) },
    { name: "Contents/header.xml", data: enc.encode(HEADER) },
    { name: "Contents/section0.xml", data: enc.encode(SECTION) },
    { name: "BinData/image1.png", data: PNG },
    ...Object.entries(extra).map(([name, text]) => ({ name, data: enc.encode(text) })),
  ]);
}

describe("unzip", () => {
  it("저장 방식과 deflate 방식을 모두 풉니다", async () => {
    const stored = await unzip(zipStore([{ name: "a.txt", data: enc.encode("안녕") }]));
    expect(new TextDecoder().decode(stored.get("a.txt"))).toBe("안녕");

    // zipStore로 만든 ZIP의 내용을 deflate로 바꿔 끼움(헤더의 방식·크기 수정)
    const text = enc.encode("가".repeat(1000));
    const comp = deflateRawSync(text);
    const zip = zipStore([{ name: "b.txt", data: comp }]);
    const dv = new DataView(zip.buffer);
    dv.setUint16(8, 8, true); // 지역 헤더: deflate
    const cd = dv.getUint32(zip.length - 22 + 16, true);
    dv.setUint16(cd + 10, 8, true);
    dv.setUint32(cd + 24, text.length, true);
    const out = await unzip(zip);
    expect(out.get("b.txt")).toEqual(text);
  });
});

describe("hwpxToHtml", () => {
  it("문단·글자 모양·번호·표·그림·각주·링크·덧말을 옮깁니다", async () => {
    const html = await hwpxToHtml(makeHwpx(), "파일");
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("<title>시험 문서</title>");
    // 글자 모양
    expect(html).toMatch(/\.c1\{font-size:18pt;font-family:'돋움',sans-serif;color:#FFFFFF;background-color:#FF0000;font-weight:bold;font-style:italic;text-decoration:underline;/);
    // 내어쓰기: 첫 줄은 왼쪽 여백, 다음 줄은 더 들어감
    expect(html).toContain(".p0{text-align:justify;padding-left:30pt;text-indent:-20pt;margin-bottom:5pt;line-height:1.6;");
    // 글자 안의 태그처럼 보이는 내용은 글자로
    expect(html).toContain("굵은 &amp;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('<span class="tab" style="width:40pt;"></span>');
    expect(html).toContain("<br>둘째 줄");
    // 문단 번호: 1. 가) 나) 2.
    const nums = [...html.matchAll(/<span class="c0">([^<]*) <\/span>/g)].map((m) => m[1]);
    expect(nums).toEqual(["1.", "가)", "나)", "2."]);
    // 표: 셀 합치기, 열 너비, 테두리·배경·대각선
    expect(html).toContain('<td class="b2" colspan="2"');
    expect(html).toContain('<col style="width:28.22mm"><col style="width:42.33mm">');
    expect(html).toMatch(/\.b2\{border-left:0\.12mm solid #000000;border-right:0\.8mm double #000000;border-top:0\.12mm solid #000000;border-bottom:0\.12mm dashed #FF0000;background-color:#FFFF00;background-image:url\("data:image\/svg\+xml,/);
    // 그림은 data URI로
    expect(html).toContain('src="data:image/png;base64,iVBOR');
    // 쪽 나누기 → 두 번째 쪽, 각주는 그 쪽 아래
    expect(html.match(/<div class="page"/g)).toHaveLength(2);
    expect(html).toMatch(/<sup class="note-ref c0"><a href="#note1">1\)?<\/a><\/sup>/);
    expect(html).toContain('<div class="notes"><div class="note" id="note1">');
    // 링크는 fieldBegin~fieldEnd 사이 글자만
    expect(html).toContain('<a href="https://novalabs.co.kr">링크</a></span><span class="c0"> 뒤</span>');
    expect(html).toContain("<ruby>본말<rt>덧말</rt></ruby>");
  });

  it("ZIP이 아니거나 header.xml이 없으면 알아볼 수 있는 오류를 냅니다", async () => {
    await expect(hwpxToHtml(enc.encode("not a zip"))).rejects.toMatchObject({ code: "notHwpx" });
    await expect(hwpxToHtml(zipStore([{ name: "a.txt", data: enc.encode("x") }]))).rejects.toBeInstanceOf(HwpxError);
  });

  it("차트는 SVG로 그립니다", async () => {
    const chart = `<?xml version="1.0"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:title><c:tx><c:rich><a:p><a:r><a:t>제목</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:barChart><c:barDir val="col"/>
<c:ser><c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>계열1</c:v></c:pt></c:strCache></c:strRef></c:tx><c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>가</c:v></c:pt><c:pt idx="1"><c:v>나</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:numCache><c:pt idx="0"><c:v>10</c:v></c:pt><c:pt idx="1"><c:v>20</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser>
</c:barChart></c:plotArea></c:chart></c:chartSpace>`;
    const section = SECTION.replace("<hp:run charPrIDRef=\"0\"/>", `<hp:run charPrIDRef="0"><hp:switch><hp:case hp:required-namespace="x"><hp:chart chartIDRef="Chart/chart1.xml"><hp:sz width="30000" height="15000"/><hp:pos treatAsChar="1"/></hp:chart></hp:case><hp:default><hp:ole/></hp:default></hp:switch></hp:run>`);
    const zip = zipStore([
      { name: "Contents/header.xml", data: enc.encode(HEADER) },
      { name: "Contents/section0.xml", data: enc.encode(section) },
      { name: "Chart/chart1.xml", data: enc.encode(chart) },
    ]);
    const html = await hwpxToHtml(zip, "차트");
    expect(html).toContain("<svg");
    expect(html).toContain(">제목</text>");
    expect(html.match(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" fill="#4472c4"\/>/g)).toHaveLength(3); // 막대 2개 + 범례
    expect(html).not.toContain("OLE 개체");
  });

  // 실제 HWPX로 시험: HWPX_SAMPLE=경로.hwpx (HWPX_OUT=결과.html 이면 결과도 저장)
  it.skipIf(!process.env.HWPX_SAMPLE)("실제 문서", async () => {
    const html = await hwpxToHtml(readFileSync(process.env.HWPX_SAMPLE!), "sample");
    expect(html).toContain('<div class="page"');
    if (process.env.HWPX_OUT) writeFileSync(process.env.HWPX_OUT, html);
  });
});

describe("번호·수식", () => {
  it("번호 모양", () => {
    expect([1, 2, 14, 15].map((n) => formatNumber(n, "HANGUL_SYLLABLE"))).toEqual(["가", "나", "하", "가"]);
    expect(formatNumber(3, "CIRCLED_DIGIT")).toBe("③");
    expect(formatNumber(1, "CIRCLED_HANGUL_JAMO")).toBe("㉠");
    expect(formatNumber(1, "CIRCLED_HANGUL_SYLLABLE")).toBe("㉮");
    expect(formatNumber(14, "ROMAN_CAPITAL")).toBe("XIV");
    expect(formatNumber(28, "LATIN_SMALL")).toBe("b");
  });

  it("수식 스크립트", () => {
    expect(equationHtml("{1} over {6} n(n+1)")).toBe('<span class="eq-frac"><span>1</span><span>6</span></span><i>n</i>(<i>n</i>+1)');
    expect(equationHtml("sum _{k=1} ^{n} k ^{2}")).toBe('<span class="eq-big">∑</span><sub><i>k</i>=1</sub><sup><i>n</i></sup><i>k</i><sup>2</sup>');
    expect(equationHtml("a TIMES b <= sqrt {x} +- ALPHA alpha")).toBe('<i>a</i>×<i>b</i>≤√<span class="eq-sqrt"><i>x</i></span>±Αα');
    expect(equationHtml("x<y")).toBe("<i>x</i>&lt;<i>y</i>");
  });
});
