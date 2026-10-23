"""python -m pytest tools/hwp2html

한컴오피스 없이 돌도록 pyhwp 변환과 HWPX→HWP 저장을 가짜로 바꿔 시험합니다.
실제 HWP로 시험하려면 HWP2HTML_SAMPLE=경로.hwp 를 지정하세요.
"""

import os
from pathlib import Path

import pytest

import hwp2html as h

PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4f10000000049454e44ae426082"
)

XHTML = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta http-equiv="content-type" content="text/html; charset=utf-8" /><title></title>
<link rel="stylesheet" href="styles.css" type="text/css" /></head>
<body><div class="Section"><table><tr><td><p>칸</p><div class="empty" /></td></tr></table>
<p>뒤 문단</p><img src="bindata/BIN0001.png" style="width: 4mm;" /><img src="http://example.com/a.png" /></div></body></html>
"""


def write_fake_output(out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "bindata").mkdir(exist_ok=True)
    (out_dir / "bindata" / "BIN0001.png").write_bytes(PNG_1PX)
    (out_dir / "styles.css").write_text(".Section { background: url(bindata/BIN0001.png); }", encoding="utf-8")
    (out_dir / "index.xhtml").write_text(XHTML, encoding="utf-8")
    return out_dir / "index.xhtml"


@pytest.fixture
def fake_pyhwp(monkeypatch):
    seen = []

    def fake(hwp_path, out_dir):
        hwp_path = Path(hwp_path)
        seen.append(hwp_path)
        if hwp_path.read_bytes().startswith(b"HWP3"):
            raise h.UnsupportedHwp("v3")
        return write_fake_output(out_dir)

    monkeypatch.setattr(h, "hwp5_to_dir", fake)
    return seen


class FakeHancom:
    def __init__(self):
        self.calls = []

    def to_hwp(self, src, dst):
        self.calls.append((Path(src), Path(dst)))
        Path(dst).write_bytes(b"HWP5 converted")


def test_inline_html_makes_one_file(tmp_path):
    html = h.inline_html(write_fake_output(tmp_path), title="문서")
    assert html.startswith("<!DOCTYPE html>")
    assert "<link" not in html and "styles.css" not in html
    assert "bindata/" not in html
    assert html.count("data:image/png;base64,") == 2  # <img>와 CSS 배경
    assert 'src="http://example.com/a.png"' in html  # 외부 주소는 그대로
    assert '<div class="empty"></div>' in html  # 빈 div가 HTML로 제대로 닫힘
    assert "xmlns" not in html
    assert "<title>문서</title>" in html
    assert 'name="viewport"' in html
    assert "<table>" in html and "칸" in html


def test_local_file_stays_inside_output(tmp_path):
    (tmp_path / "out").mkdir()
    (tmp_path / "secret.png").write_bytes(PNG_1PX)
    assert h._local_file(tmp_path / "out", "../secret.png") is None
    assert h._local_file(tmp_path / "out", "data:image/png;base64,AA") is None


def test_convert_hwp_single(tmp_path, fake_pyhwp):
    src = tmp_path / "보고서.hwp"
    src.write_bytes(b"HWP5")
    made = h.convert_file(src, None, "single", hancom=None)
    assert made == [tmp_path / "보고서.html"]
    assert "data:image/png" in made[0].read_text(encoding="utf-8")
    assert fake_pyhwp == [src]


def test_convert_hwp_dir_and_both(tmp_path, fake_pyhwp):
    src = tmp_path / "a.hwp"
    src.write_bytes(b"HWP5")
    out = tmp_path / "out"
    made = h.convert_file(src, out, "both")
    assert made == [out / "a.html", out / "a_html"]
    assert (out / "a_html" / "index.xhtml").exists()
    assert (out / "a_html" / "bindata" / "BIN0001.png").exists()


def test_hwpx_goes_through_hancom(tmp_path, fake_pyhwp):
    src = tmp_path / "양식.hwpx"
    src.write_bytes(b"PK")
    hancom = FakeHancom()
    made = h.convert_file(src, None, "single", hancom=hancom)
    assert made == [tmp_path / "양식.html"]
    assert hancom.calls[0][0] == src
    assert hancom.calls[0][1].suffix == ".hwp"
    assert fake_pyhwp == [hancom.calls[0][1]]  # pyhwp는 한글이 저장한 HWP를 읽음
    assert not (tmp_path / "양식.hwp").exists()  # 임시 HWP는 남기지 않음


def test_hwpx_keep_hwp(tmp_path, fake_pyhwp):
    src = tmp_path / "양식.hwpx"
    src.write_bytes(b"PK")
    made = h.convert_file(src, None, "single", hancom=FakeHancom(), keep_hwp=True)
    assert tmp_path / "양식.hwp" in made
    assert (tmp_path / "양식.hwp").read_bytes() == b"HWP5 converted"


def test_keep_hwp_never_overwrites_original(tmp_path, fake_pyhwp):
    (tmp_path / "a.hwp").write_bytes(b"ORIGINAL")
    (tmp_path / "a.hwpx").write_bytes(b"PK")
    with pytest.raises(h.ConvertError):
        h.convert_file(tmp_path / "a.hwpx", None, "single", hancom=FakeHancom(), keep_hwp=True)
    assert (tmp_path / "a.hwp").read_bytes() == b"ORIGINAL"


def test_hwpx_without_hancom_fails_clearly(tmp_path, fake_pyhwp):
    src = tmp_path / "a.hwpx"
    src.write_bytes(b"PK")
    with pytest.raises(h.ConvertError, match="한컴오피스"):
        h.convert_file(src, None, "single", hancom=None)


def test_old_hwp_falls_back_to_hancom(tmp_path, fake_pyhwp):
    src = tmp_path / "옛문서.hwp"
    src.write_bytes(b"HWP3 old")
    hancom = FakeHancom()
    made = h.convert_file(src, None, "single", hancom=hancom)
    assert made == [tmp_path / "옛문서.html"]
    assert len(hancom.calls) == 1
    with pytest.raises(h.UnsupportedHwp):
        h.convert_file(src, None, "single", hancom=None)


def test_find_inputs(tmp_path):
    (tmp_path / "a.hwp").write_bytes(b"")
    (tmp_path / "b.HWPX").write_bytes(b"")
    (tmp_path / "~$a.hwp").write_bytes(b"")
    (tmp_path / "c.txt").write_bytes(b"")
    (tmp_path / "sub").mkdir()
    (tmp_path / "sub" / "d.hwp").write_bytes(b"")
    assert [p.name for p in h.find_inputs([tmp_path])] == ["a.hwp", "b.HWPX"]
    assert [p.name for p in h.find_inputs([tmp_path], recursive=True)] == ["a.hwp", "b.HWPX", "d.hwp"]
    with pytest.raises(h.ConvertError):
        h.find_inputs([tmp_path / "없음.hwp"])


def test_main_starts_hancom_once_and_continues_after_failure(tmp_path, fake_pyhwp, capsys):
    for name in ("a.hwpx", "b.hwpx"):
        (tmp_path / name).write_bytes(b"PK")
    (tmp_path / "c.hwp").write_bytes(b"HWP5")
    started = []

    class Converter(FakeHancom):
        def __enter__(self):
            started.append(self)
            return self

        def __exit__(self, *exc):
            self.closed = True

        def to_hwp(self, src, dst):
            if Path(src).name == "a.hwpx":
                raise h.ConvertError("열지 못함")
            super().to_hwp(src, dst)

    code = h.main([str(tmp_path), "-o", str(tmp_path / "out")], hancom_factory=Converter)
    assert code == 1
    assert len(started) == 1 and started[0].closed
    assert sorted(p.name for p in (tmp_path / "out").iterdir()) == ["b.html", "c.html"]
    assert "2/3개 변환" in capsys.readouterr().out


def test_main_hwp_only_does_not_start_hancom(tmp_path, fake_pyhwp):
    (tmp_path / "c.hwp").write_bytes(b"HWP5")

    def boom():
        raise AssertionError("HWP만 있으면 한글을 띄우지 않아야 함")

    assert h.main([str(tmp_path / "c.hwp")], hancom_factory=boom) == 0


@pytest.mark.skipif(not os.environ.get("HWP2HTML_SAMPLE"), reason="HWP2HTML_SAMPLE 미지정")
def test_real_pyhwp(tmp_path):
    src = Path(os.environ["HWP2HTML_SAMPLE"])
    made = h.convert_file(src, tmp_path, "both")
    html = made[0].read_text(encoding="utf-8")
    assert html.startswith("<!DOCTYPE html>") and "<body" in html
    assert (tmp_path / f"{src.stem}_html" / "index.xhtml").exists()
