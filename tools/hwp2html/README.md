# hwp2html: HWP·HWPX → HTML 변환

HWP를 HTML로 바꿀 때는 pyhwp(`hwp5html`)가 표와 양식을 가장 잘 살립니다. 다만 pyhwp는 HWPX를 읽지 못하므로,
HWPX는 한컴오피스 한글을 COM(`HWPFrame.HwpObject`)으로 띄워 **HWP로 먼저 저장한 뒤** pyhwp로 바꿉니다.

| 입력 | 처리 | 필요한 것 |
| --- | --- | --- |
| `.hwp` (HWP 5.x) | pyhwp로 바로 변환 | Python + pyhwp (Windows·macOS·Linux) |
| `.hwpx` | 한글로 HWP 저장 → pyhwp | Windows + 한컴오피스 한글 + pywin32 |
| `.hwp` (HWP 3.x 등 pyhwp가 못 읽는 HWP) | 한글로 HWP 5 저장 → pyhwp | Windows + 한컴오피스 한글 + pywin32 |

한컴오피스가 필요한 부분 때문에 PC에서 돌리는 도구입니다. 사이트의 `/tools/hwp-to-html`은 같은 `hwp2html.py`의 변환 함수를 브라우저(Pyodide)에서 쓰고, HWPX는 한컴오피스 없이 직접 읽어 바꿉니다.

## 설치
```bash
cd tools/hwp2html
pip install -r requirements.txt
```

## 사용
```bash
python hwp2html.py 문서.hwp                  # 문서.html (그림·CSS를 넣은 한 파일)
python hwp2html.py 양식.hwpx -o 결과          # 결과/양식.html
python hwp2html.py 폴더 -r --format both     # 하위 폴더까지, 한 파일 HTML + pyhwp 원래 결과 폴더
```

| 옵션 | 설명 |
| --- | --- |
| `-o, --output 폴더` | 결과를 둘 폴더(기본: 원본과 같은 폴더) |
| `-r, --recursive` | 폴더를 넣었을 때 하위 폴더까지 찾기(`~$` 임시 파일은 건너뜀) |
| `--format single` | 기본. `styles.css`와 `bindata/` 그림을 data URI로 넣은 `<이름>.html` 한 파일 |
| `--format dir` | pyhwp가 만든 그대로 `<이름>_html/index.xhtml`, `styles.css`, `bindata/` |
| `--format both` | 둘 다 |
| `--keep-hwp` | HWPX를 바꾸며 만든 `<이름>.hwp`도 남기기(같은 이름의 HWP가 있으면 덮어쓰지 않고 실패) |
| `--show-hangul` | 변환하는 동안 한글 창 보이기 |
| `--security-module 이름` | 한글 보안 승인 모듈 이름(기본 `FilePathCheckerModule`) |

여러 파일을 넣으면 한글은 HWPX(또는 옛 HWP)가 처음 나올 때 한 번만 띄우고 끝나면 닫습니다. 한 파일이 실패해도 나머지는 계속 바꾸며,
하나라도 실패하면 종료 코드 1을 돌려줍니다.

## 한글 "접근 허용" 창 없애기
COM으로 파일을 열고 저장하면 한글이 매번 접근 허용 여부를 묻습니다. 한컴 개발자 사이트(developer.hancom.com)의
한글 오토메이션 보안 모듈(`FilePathCheckerModuleExample.dll`)을 받아 두고 레지스트리에 등록하면 창 없이 진행됩니다.

```
HKEY_CURRENT_USER\Software\HNC\HwpAutomation\Modules
  문자열 값  이름: FilePathCheckerModule   데이터: C:\경로\FilePathCheckerModuleExample.dll
```

다른 이름으로 등록했다면 `--security-module 그이름`으로 넘깁니다. 등록하지 않아도 변환은 되지만, 창이 뜰 때마다 "모두 허용"을 눌러야 합니다.

## 결과 HTML
- pyhwp가 만든 XHTML을 HTML로 다시 저장합니다(`<div/>` 같은 빈 태그가 HTML에서 깨지지 않도록). 용지 폭(mm)을 그대로 쓰므로 휴대폰에서는 가로로 밀어 봅니다.
- 그림은 `bindata/` 파일을 data URI로 넣고, 외부 주소나 결과 폴더 밖을 가리키는 경로는 건드리지 않습니다.
- pyhwp가 지원하지 않는 개체(수식·차트·글맵시 등)는 HTML에도 나오지 않습니다. 배포용(읽기 전용)·암호 문서는 변환할 수 없습니다.

## 테스트
```bash
python -m pytest tools/hwp2html                                  # 한컴오피스 없이(가짜 변환기로) 시험
HWP2HTML_SAMPLE=경로/문서.hwp python -m pytest tools/hwp2html     # 실제 HWP로 pyhwp까지 시험
```
