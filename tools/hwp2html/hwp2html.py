"""HWP·HWPX 문서를 HTML로 바꿉니다.

- HWP(5.x)는 pyhwp(hwp5html)로 바로 바꿉니다. 표·문단 모양을 가장 잘 살립니다.
- pyhwp는 HWPX를 읽지 못하므로, HWPX는 한컴오피스 COM(HWPFrame.HwpObject)으로
  HWP로 먼저 저장한 뒤 바꿉니다(Windows + 한컴오피스 한글 필요).
- pyhwp가 읽지 못하는 HWP(예: HWP 3.x)도 한컴오피스가 있으면 HWP 5로 다시 저장해 바꿉니다.

사용 예:
    python hwp2html.py 문서.hwp 양식.hwpx
    python hwp2html.py 폴더 -r -o 결과 --format both
"""

from __future__ import annotations

import argparse
import base64
import mimetypes
import re
import shutil
import sys
import tempfile
from contextlib import closing
from pathlib import Path
from typing import Callable, Iterable, Optional
from urllib.parse import unquote

HWP_EXTS = {".hwp"}
HWPX_EXTS = {".hwpx"}
FORMATS = ("single", "dir", "both")

# 한컴 보안 승인 모듈. 등록돼 있으면 파일을 열고 저장할 때 "접근 허용" 창이 뜨지 않습니다.
SECURITY_MODULE = "FilePathCheckerModule"


class ConvertError(Exception):
    pass


# ---------------------------------------------------------------------------
# HWPX → HWP (한컴오피스 COM)
# ---------------------------------------------------------------------------


class HancomConverter:
    """한컴오피스 한글을 COM으로 띄워 문서를 HWP(5.x)로 다시 저장합니다.

    한 번 띄운 한글 창을 여러 파일에 다시 쓰고, with 블록이 끝나면 닫습니다.
    """

    def __init__(self, visible: bool = False, security_module: str = SECURITY_MODULE):
        self.visible = visible
        self.security_module = security_module
        self.hwp = None

    def __enter__(self) -> "HancomConverter":
        if sys.platform != "win32":
            raise ConvertError("HWPX 변환은 Windows에 한컴오피스 한글이 설치돼 있어야 합니다.")
        try:
            import pythoncom  # type: ignore
            import win32com.client  # type: ignore
        except ImportError as e:
            raise ConvertError("pywin32가 필요합니다: pip install pywin32") from e
        pythoncom.CoInitialize()
        try:
            self.hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
        except Exception as e:  # pywintypes.com_error
            raise ConvertError(f"한컴오피스 한글을 실행하지 못했습니다(HWPFrame.HwpObject): {e}") from e
        try:
            self.hwp.XHwpWindows.Item(0).Visible = self.visible
        except Exception:
            pass
        if self.security_module:
            try:
                self.hwp.RegisterModule("FilePathCheckDLL", self.security_module)
            except Exception:
                pass  # 모듈이 없으면 한글이 접근 허용 여부를 묻는 창을 띄웁니다
        return self

    def to_hwp(self, src: Path, dst: Path) -> None:
        src, dst = Path(src).resolve(), Path(dst).resolve()
        hwp = self.hwp
        # 형식을 비워 두면 한글이 파일 내용을 보고 HWPX·HWP 3.x 등을 알아서 엽니다
        if not hwp.Open(str(src), "", "forceopen:true"):
            raise ConvertError(f"한글에서 파일을 열지 못했습니다: {src}")
        try:
            if not hwp.SaveAs(str(dst), "HWP", "") or not dst.exists():
                raise ConvertError(f"HWP로 저장하지 못했습니다: {dst}")
        finally:
            hwp.Clear(1)  # 저장하지 않고 문서 닫기

    def __exit__(self, *exc) -> None:
        if self.hwp is not None:
            try:
                self.hwp.Quit()
            except Exception:
                pass
            self.hwp = None


class LazyHancom:
    """HWPX가 실제로 나올 때만 한글을 띄우도록 감쌉니다."""

    def __init__(self, factory: Callable[[], HancomConverter]):
        self.factory = factory
        self.converter: Optional[HancomConverter] = None

    def to_hwp(self, src: Path, dst: Path) -> None:
        if self.converter is None:
            self.converter = self.factory().__enter__()
        self.converter.to_hwp(src, dst)

    def close(self) -> None:
        if self.converter is not None:
            self.converter.__exit__(None, None, None)
            self.converter = None


# ---------------------------------------------------------------------------
# HWP → HTML (pyhwp)
# ---------------------------------------------------------------------------


def hwp5_to_dir(hwp_path: Path, out_dir: Path) -> Path:
    """pyhwp로 index.xhtml, styles.css, bindata/를 만들고 index.xhtml 경로를 돌려줍니다."""
    try:
        from hwp5.errors import InvalidHwp5FileError, InvalidOleStorageError
        from hwp5.hwp5html import HTMLTransform
        from hwp5.xmlmodel import Hwp5File
    except ImportError as e:
        raise ConvertError("pyhwp가 필요합니다: pip install pyhwp six") from e

    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        with closing(Hwp5File(str(hwp_path))) as hwp5file:
            HTMLTransform().transform_hwp5_to_dir(hwp5file, str(out_dir))
    except (InvalidHwp5FileError, InvalidOleStorageError) as e:
        raise UnsupportedHwp(f"pyhwp가 읽을 수 없는 HWP입니다(HWP 5.x만 지원): {hwp_path}") from e
    return out_dir / "index.xhtml"


class UnsupportedHwp(ConvertError):
    pass


# ---------------------------------------------------------------------------
# 한 파일짜리 HTML 만들기
# ---------------------------------------------------------------------------

_CSS_URL = re.compile(r"url\(\s*(['\"]?)([^'\")]+)\1\s*\)")


def _data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def _local_file(base: Path, ref: str) -> Optional[Path]:
    if not ref or re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", ref) or ref.startswith(("#", "/")):
        return None  # data:, http:, 절대 경로 등은 그대로 둠
    path = (base / unquote(ref.split("#")[0].split("?")[0])).resolve()
    try:
        path.relative_to(base.resolve())
    except ValueError:
        return None  # 결과 폴더 밖은 넣지 않음
    return path if path.is_file() else None


def _inline_css_urls(css: str, base: Path) -> str:
    def repl(m: re.Match) -> str:
        path = _local_file(base, m.group(2))
        return f"url({_data_uri(path)})" if path else m.group(0)

    return _CSS_URL.sub(repl, css)


def inline_html(xhtml_path: Path, title: str = "") -> str:
    """pyhwp가 만든 index.xhtml에 styles.css와 bindata 그림을 넣어 HTML 한 파일로 만듭니다."""
    from lxml import etree

    base = xhtml_path.parent
    root = etree.parse(str(xhtml_path)).getroot()

    # XHTML 네임스페이스를 지워야 HTML로 저장할 때 <div/> 같은 빈 태그가 제대로 닫힙니다
    for el in root.iter():
        if isinstance(el.tag, str) and el.tag.startswith("{"):
            el.tag = el.tag.split("}", 1)[1]
    etree.cleanup_namespaces(root)

    for link in root.iter("link"):
        if (link.get("rel") or "").lower() != "stylesheet":
            continue
        path = _local_file(base, link.get("href", ""))
        if path is None:
            continue
        style = etree.Element("style")
        style.text = "\n" + _inline_css_urls(path.read_text(encoding="utf-8"), path.parent) + "\n"
        link.getparent().replace(link, style)

    for style in root.iter("style"):
        if style.text:
            style.text = _inline_css_urls(style.text, base)

    for el in root.iter():
        if not isinstance(el.tag, str):
            continue
        path = _local_file(base, el.get("src", ""))
        if path is not None:
            el.set("src", _data_uri(path))
        if el.get("style"):
            el.set("style", _inline_css_urls(el.get("style"), base))

    head = root.find("head")
    if head is not None:
        title_el = head.find("title")
        if title_el is not None and not (title_el.text or "").strip() and title:
            title_el.text = title
        # 휴대폰에서도 원래 폭대로 보이도록(가로로 밀어 보기)
        if head.find("meta[@name='viewport']") is None:
            head.insert(1, etree.Element("meta", name="viewport", content="width=device-width, initial-scale=1"))

    return etree.tostring(root, method="html", encoding="unicode", doctype="<!DOCTYPE html>")


# ---------------------------------------------------------------------------
# 파일 하나 바꾸기
# ---------------------------------------------------------------------------


class Hancom:
    """HWPX → HWP 변환기의 모양(테스트에서 가짜로 바꿔 끼움)."""

    def to_hwp(self, src: Path, dst: Path) -> None: ...


def convert_file(
    src: Path,
    out_root: Optional[Path],
    fmt: str = "single",
    hancom: Optional[Hancom] = None,
    keep_hwp: bool = False,
) -> list[Path]:
    """src를 HTML로 바꾸고 만든 파일·폴더 경로를 돌려줍니다.

    out_root가 없으면 원본과 같은 폴더에 만듭니다.
      single → <이름>.html
      dir    → <이름>_html/index.xhtml, styles.css, bindata/
      keep_hwp(HWPX만) → <이름>.hwp
    """
    src = Path(src)
    ext = src.suffix.lower()
    if ext not in HWP_EXTS | HWPX_EXTS:
        raise ConvertError(f"HWP·HWPX 파일이 아닙니다: {src}")
    if fmt not in FORMATS:
        raise ValueError(fmt)

    out_root = Path(out_root) if out_root else src.parent
    out_root.mkdir(parents=True, exist_ok=True)
    stem = src.stem
    made: list[Path] = []

    with tempfile.TemporaryDirectory(prefix="hwp2html-") as tmp:
        tmp = Path(tmp)

        def resave(dst: Path) -> Path:
            if hancom is None:
                raise ConvertError(
                    "HWPX(또는 pyhwp가 못 읽는 HWP)는 한컴오피스로 HWP로 먼저 저장해야 합니다. "
                    "Windows에 한컴오피스 한글과 pywin32를 설치하세요."
                )
            hancom.to_hwp(src, dst)
            return dst

        if ext in HWPX_EXTS:
            hwp_path = resave(tmp / f"{stem}.hwp")
            if keep_hwp:
                kept = out_root / f"{stem}.hwp"
                if kept.exists():
                    # 같은 이름의 원본 HWP를 덮어쓰지 않도록
                    raise ConvertError(f"이미 있는 파일이라 HWP를 남기지 않았습니다: {kept} (-o로 다른 폴더를 지정하세요)")
                shutil.copy2(hwp_path, kept)
                made.append(kept)
        else:
            hwp_path = src

        work_dir = tmp / "html"
        try:
            xhtml = hwp5_to_dir(hwp_path, work_dir)
        except UnsupportedHwp:
            if ext not in HWP_EXTS or hancom is None:
                raise
            # HWP 3.x 등: 한글로 HWP 5로 다시 저장한 뒤 한 번 더
            shutil.rmtree(work_dir, ignore_errors=True)
            xhtml = hwp5_to_dir(resave(tmp / f"{stem}.v5.hwp"), work_dir)

        if fmt in ("single", "both"):
            html_path = out_root / f"{stem}.html"
            html_path.write_text(inline_html(xhtml, title=stem), encoding="utf-8")
            made.append(html_path)
        if fmt in ("dir", "both"):
            dir_path = out_root / f"{stem}_html"
            if dir_path.exists():
                shutil.rmtree(dir_path)
            shutil.copytree(work_dir, dir_path)
            made.append(dir_path)

    return made


def find_inputs(paths: Iterable[Path], recursive: bool = False) -> list[Path]:
    exts = HWP_EXTS | HWPX_EXTS
    found: list[Path] = []
    for p in map(Path, paths):
        if p.is_dir():
            it = p.rglob("*") if recursive else p.iterdir()
            # ~$문서.hwp 같은 한글 임시 파일은 건너뜀
            found += sorted(f for f in it if f.is_file() and f.suffix.lower() in exts and not f.name.startswith("~$"))
        elif p.is_file():
            found.append(p)
        else:
            raise ConvertError(f"파일이나 폴더가 없습니다: {p}")
    return found


# ---------------------------------------------------------------------------
# 명령줄
# ---------------------------------------------------------------------------


def main(argv: Optional[list[str]] = None, hancom_factory: Optional[Callable[[], HancomConverter]] = None) -> int:
    ap = argparse.ArgumentParser(
        prog="hwp2html",
        description="HWP·HWPX 문서를 HTML로 바꿉니다(HWP는 pyhwp, HWPX는 한컴오피스로 HWP 저장 후 pyhwp).",
    )
    ap.add_argument("inputs", nargs="+", type=Path, help="HWP·HWPX 파일 또는 폴더")
    ap.add_argument("-o", "--output", type=Path, help="결과를 둘 폴더(기본: 원본과 같은 폴더)")
    ap.add_argument("-r", "--recursive", action="store_true", help="폴더 안의 하위 폴더까지 찾기")
    ap.add_argument(
        "--format",
        choices=FORMATS,
        default="single",
        help="single: 그림·CSS를 넣은 HTML 한 파일(기본), dir: pyhwp 원래 결과 폴더, both: 둘 다",
    )
    ap.add_argument("--keep-hwp", action="store_true", help="HWPX를 바꾸며 만든 HWP 파일도 남기기")
    ap.add_argument("--show-hangul", action="store_true", help="변환하는 동안 한글 창 보이기")
    ap.add_argument(
        "--security-module",
        default=SECURITY_MODULE,
        help=f"한글 보안 승인 모듈 이름(기본 {SECURITY_MODULE}, 빈 값이면 등록 안 함)",
    )
    args = ap.parse_args(argv)

    try:
        files = find_inputs(args.inputs, args.recursive)
    except ConvertError as e:
        print(f"오류: {e}", file=sys.stderr)
        return 2
    if not files:
        print("바꿀 HWP·HWPX 파일이 없습니다.", file=sys.stderr)
        return 2

    factory = hancom_factory or (lambda: HancomConverter(args.show_hangul, args.security_module))
    # Windows가 아니면 HWP만 바꿀 수 있음(HWPX는 파일마다 안내 오류)
    hancom = LazyHancom(factory) if (hancom_factory or sys.platform == "win32") else None

    failed = 0
    try:
        for f in files:
            try:
                made = convert_file(f, args.output, args.format, hancom, args.keep_hwp)
                print(f"완료: {f} → " + ", ".join(str(m) for m in made))
            except Exception as e:  # pyhwp 해석 오류 등도 다음 파일로 넘어감
                failed += 1
                print(f"실패: {f}: {e}", file=sys.stderr)
    finally:
        if hancom is not None:
            hancom.close()

    print(f"{len(files) - failed}/{len(files)}개 변환")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
