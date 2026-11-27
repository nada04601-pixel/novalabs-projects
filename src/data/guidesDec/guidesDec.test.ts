import { describe, expect, it } from "vitest";
import { guidesDec } from "./index";
import { scheduledGuides } from "@/data/guides";
import { getTool, isHiddenTool } from "@/data/tools";

// 12월 예약 가이드(2026-11-29~12-31, 하루 한 편)가 빠짐없이, 겹치지 않게 들어 있는지 확인합니다.
const FIRST = "2026-11-29";
const LAST = "2026-12-31";

const daysBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
};

// 공백을 뺀 글자 수. prose는 소제목·문단·표 뒤 문단·표 설명만, page는 표 제목과 칸까지 더한 값입니다
// (2026-11-23 애드센스 보강 때 사이트 화면에서 메뉴를 빼고 잰 방식과 같은 범위).
const strip = (parts: string[]) => parts.join("").replace(/\s/g, "").length;
const proseLength = (g: (typeof guidesDec)[number]) =>
  strip(g.sections.flatMap((s) => [s.heading, ...s.body, ...(s.after ?? []), s.table?.note ?? ""]));
const pageLength = (g: (typeof guidesDec)[number]) =>
  proseLength(g) + strip(g.sections.flatMap((s) => (s.table ? [s.table.caption, ...s.table.head, ...s.table.rows.flat()] : [])));

describe("12월 예약 가이드", () => {
  it("공개일마다 정확히 한 편씩 있다", () => {
    const dates = guidesDec.map((g) => g.date).sort();
    expect(dates).toEqual(daysBetween(FIRST, LAST));
  });

  it("슬러그가 기존 글과 겹치지 않는다", () => {
    const slugs = scheduledGuides.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("기존 글의 공개일과 겹치지 않는다", () => {
    const decSlugs = new Set(guidesDec.map((g) => g.slug));
    const others = scheduledGuides.filter((g) => !decSlugs.has(g.slug)).map((g) => g.date);
    for (const g of guidesDec) expect(others).not.toContain(g.date);
  });

  it("연결 도구가 있고 숨긴 도구가 아니다", () => {
    for (const g of guidesDec) {
      expect(g.tool, g.slug).toBeTruthy();
      expect(getTool(g.tool!), `${g.slug} → ${g.tool}`).toBeTruthy();
      expect(isHiddenTool(g.tool!), `${g.slug} → ${g.tool}`).toBe(false);
    }
  });

  it("형식: 소제목 5~8개, 표 1개 이상, 참고 자료 2~5개, updated 없음", () => {
    for (const g of guidesDec) {
      expect(g.sections.length, g.slug).toBeGreaterThanOrEqual(5);
      expect(g.sections.length, g.slug).toBeLessThanOrEqual(8);
      expect(g.sections.some((s) => s.table), g.slug).toBe(true);
      expect(g.sources?.length ?? 0, g.slug).toBeGreaterThanOrEqual(2);
      expect(g.sources?.length ?? 0, g.slug).toBeLessThanOrEqual(5);
      expect(g.updated, g.slug).toBeUndefined();
    }
  });

  // 기준: 표까지 포함해 3,000자 이상(2026-11-23 보강 글과 같은 잣대), 표만 늘려 채우지 않도록 문단만으로도 2,000자 이상.
  it("본문이 얇지 않다(공백 빼고 표 포함 3,000자·문단만 2,000자 이상)", () => {
    const lengths = guidesDec.map((g) => ({ date: g.date, slug: g.slug, prose: proseLength(g), page: pageLength(g) })).sort((a, b) => a.date.localeCompare(b.date));
    console.table(lengths);
    for (const l of lengths) {
      expect(l.prose, l.slug).toBeGreaterThanOrEqual(2_000);
      expect(l.page, l.slug).toBeGreaterThanOrEqual(3_000);
    }
  });

  // 작성 규칙에서 쓰지 않기로 한 표현(질문·답 형식, 인사말, 1인칭 경험담, 과장, 내부 이야기, 숨긴 도구 안내)
  it("쓰지 않기로 한 표현이 없다", () => {
    const banned = [/자주 묻는 질문/, /(^|\s)Q\.\s/, /도움이 되(셨|었)/, /제가 (써|해) 보/, /무조건/, /100% ?(보장|확실|안전|효과|성공)/, /노바랩스? 직원|AI 직원|노바(?!랩)/, /워터마크 지우기|자막 지우기|로또/, /오늘은|이번 주/];
    for (const g of guidesDec) {
      const text = [g.title, g.description, ...g.sections.flatMap((s) => [s.heading, ...s.body, ...(s.after ?? []), s.table?.note ?? ""])].join("\n");
      for (const re of banned) expect(text, `${g.slug}: ${re}`).not.toMatch(re);
    }
  });

  it("표 칸에 계산 실패 흔적(NaN, undefined, Infinity)이 없다", () => {
    for (const g of guidesDec) {
      const text = JSON.stringify(g);
      expect(text, g.slug).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
});
