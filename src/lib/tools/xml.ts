// 네임스페이스 접두어(hp:, hh: …)를 신경 쓰지 않고 XML 요소를 이름(localName)으로 찾는 도우미.
// querySelector 대신 childNodes만 써서 브라우저 DOMParser와 테스트용 @xmldom/xmldom에서 똑같이 동작합니다.

const isEl = (n: Node): n is Element => n.nodeType === 1;
const nameOf = (el: Element) => el.localName || el.nodeName.replace(/^.*:/, "");

export function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text.replace(/^﻿/, ""), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("XML 해석 실패");
  return doc;
}

export const localName = nameOf;

export function children(el: Element | undefined | null, name?: string): Element[] {
  const out: Element[] = [];
  if (!el) return out;
  for (let n = el.firstChild; n; n = n.nextSibling) if (isEl(n) && (!name || nameOf(n) === name)) out.push(n);
  return out;
}

export function first(el: Element | undefined | null, name: string): Element | undefined {
  if (!el) return undefined;
  for (let n = el.firstChild; n; n = n.nextSibling) if (isEl(n) && nameOf(n) === name) return n;
  return undefined;
}

export function desc(el: Element | undefined | null, name: string): Element[] {
  const out: Element[] = [];
  const walk = (e: Element) => {
    for (let n = e.firstChild; n; n = n.nextSibling) {
      if (!isEl(n)) continue;
      if (nameOf(n) === name) out.push(n);
      walk(n);
    }
  };
  if (el) walk(el);
  return out;
}

export function attr(el: Element | undefined | null, name: string): string | undefined {
  if (!el) return undefined;
  const v = el.getAttribute(name);
  return v === null ? undefined : v;
}

export const num = (el: Element | undefined | null, name: string, d = 0): number => {
  const v = Number(attr(el, name));
  return Number.isFinite(v) ? v : d;
};

export const textOf = (el: Element | undefined | null): string => (el ? el.textContent ?? "" : "");
