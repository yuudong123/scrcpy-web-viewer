# scrcpy Web Viewer 사용법

[English README](../README.md)

USB로 연결한 안드로이드 폰 화면을 **http://localhost:8765**에서 보는 로컬 웹 뷰어입니다. 버튼이나 상태 표시 없이 폰 화면만 원래 비율로 표시합니다.

폰에서 받은 H.264 영상을 로컬 Node.js 서버가 브라우저에 전달하고, 브라우저의 WebCodecs가 재생합니다. PC 창을 캡처하는 방식이 아니므로 데스크톱 scrcpy 창이 가려져도 웹 화면을 볼 수 있습니다.

## 주요 기능

- 별도 UI 없이 폰 화면만 표시
- 최대 30 fps, 긴 변 기준 최대 1600픽셀
- USB 연결이 끊기면 자동 재연결 시도
- 여러 탭에서 하나의 폰 스트림 공유
- `127.0.0.1`에만 바인딩하는 로컬 서버

화면 보기 전용입니다. 소리 전송, 웹에서 폰 조작, 녹화는 지원하지 않습니다. 실제 프레임 속도는 폰 성능, 화면 변화, 브라우저 환경에 따라 달라집니다.

## 준비 사항

- Windows x64 및 Windows PowerShell
- npm이 포함된 [Node.js](https://nodejs.org/) 22 이상
- WebCodecs를 지원하는 최신 Chrome 또는 Edge
- [scrcpy 5.0.1](https://github.com/Genymobile/scrcpy/releases/tag/v5.0.1)이 지원하는 안드로이드 폰
- 데이터 전송이 가능한 USB 케이블
- 폰의 **USB 디버깅 활성화** 및 해당 PC의 디버깅 권한 허용
- 최초 설치 시 scrcpy와 npm 의존성을 다운로드할 인터넷 연결

현재 설치 스크립트와 실행 경로는 Windows x64 기준입니다. 다른 운영체제용 실행 스크립트는 제공하지 않습니다.

## 설치 및 실행

저장소를 복제하거나 GitHub에서 ZIP으로 내려받아 압축을 풉니다.

```powershell
git clone https://github.com/yuudong123/scrcpy-web-viewer.git
cd scrcpy-web-viewer
.\setup.cmd
```

`setup.cmd`는 필요한 경우 공식 scrcpy 5.0.1 Windows 압축 파일을 다운로드하고, 고정된 SHA-256과 일치하는지 검사한 뒤 압축을 풉니다. 웹 의존성은 잠금 파일 기준으로 `npm ci`를 실행해 설치합니다. 이미 있는 런타임은 재사용하며, 다운로드한 실행 파일과 의존성은 Git에 포함하지 않습니다.

폰을 USB로 연결하고 잠금을 해제합니다. **USB 디버깅**을 켜고 폰에 표시되는 디버깅 권한 요청을 허용한 다음 실행합니다.

```powershell
.\start-web.cmd
```

Chrome 또는 Edge에서 **[http://localhost:8765](http://localhost:8765)**에 접속합니다. 사용 중에는 서버 터미널을 열어두고, 종료하려면 해당 터미널에서 **Ctrl+C**를 누릅니다. 탭을 열면 영상 전송을 시작하고, 마지막 탭을 닫으면 약 5초 뒤 전송을 멈춥니다.

페이지에는 버튼이나 오류 안내를 표시하지 않습니다. 연결 상태는 서버 터미널 또는 [`/api/status`](http://localhost:8765/api/status)에서 확인할 수 있습니다.

## 설정

PowerShell에서 다른 포트로 실행하려면:

```powershell
$env:PORT = '9000'
.\start-web.cmd
```

접속 주소는 `http://localhost:9000`입니다.

USB 폰을 여러 대 연결한 경우 ADB 일련번호로 대상을 지정합니다.

```powershell
.\scrcpy-win64-v5.0.1\adb.exe devices -l
$env:ANDROID_SERIAL = 'YOUR_DEVICE_SERIAL'
.\start-web.cmd
```

일반 데스크톱 scrcpy 창이 필요하면 `start-mirroring.cmd`를 실행합니다. USB 기기가 한 대 연결된 상태에서 사용하며, 웹 뷰어와 별개로 실행됩니다.

## 문제 해결

| 증상 | 확인할 내용 |
| --- | --- |
| 화면이 검게 표시됨 | USB 디버깅 권한, 데이터 케이블, USB 포트를 확인하고 서버 터미널의 오류를 확인합니다. |
| 폰이 없거나 `unauthorized`로 표시됨 | `.\scrcpy-win64-v5.0.1\adb.exe devices -l`을 실행하고, 폰 잠금을 해제해 디버깅 요청을 허용합니다. 필요하면 제조사 ADB 드라이버도 확인합니다. |
| 포트 사용 중 오류(`EADDRINUSE`) | 기존 서버를 종료하거나 `PORT`를 변경합니다. |
| 런타임 파일이나 `ws`를 찾지 못함 | `setup.cmd`를 다시 실행합니다. |
| 브라우저에서 영상을 재생하지 못함 | 최신 Chrome 또는 Edge에서 페이지를 새로고침합니다. |
| USB 연결이 끊김 | 폰을 다시 연결하고 필요하면 권한을 허용합니다. 웹 뷰어는 자동으로 재연결을 시도합니다. |
| 잠금 화면 또는 보호된 콘텐츠가 검게 표시됨 | 폰 잠금을 해제합니다. 캡처를 제한하는 앱의 콘텐츠는 표시되지 않을 수 있습니다. |

`localhost`는 서버를 실행한 PC에서 접속하는 주소입니다. 이 서버는 LAN에 공개되지 않습니다. USB 폰에 대한 로컬 ADB 접근이 필요하므로 정적 GitHub Pages 사이트로 실행할 수 없습니다.

## 파일 구성

```text
README.md                 영문 사용법
docs/README.ko.md          한글 사용법
LICENSE                   프로젝트 코드의 MIT 라이선스
THIRD_PARTY_NOTICES.md     외부 구성요소와 라이선스
setup.cmd                 Windows 최초 설치
scripts/setup.mjs          scrcpy 다운로드 검증 및 npm 설치
start-web.cmd             웹 뷰어 실행
start-mirroring.cmd       선택 사항: 데스크톱 scrcpy 실행
web/server.mjs            로컬 HTTP/WebSocket 서버 및 scrcpy 연결
web/viewer.js             브라우저 영상 디코딩 및 출력
web/index.html            폰 화면만 표시하는 페이지
```

scrcpy 서버와 통신 규약은 **5.0.1**에 맞춰져 있습니다. 버전을 바꾸려면 서버 연결 코드와 설치 스크립트도 함께 수정해야 합니다.

## 라이선스

직접 작성한 코드와 문서는 [MIT 라이선스](../LICENSE)로 제공합니다. 외부 구성요소에는 각 원본 라이선스가 적용됩니다. 자세한 내용은 [외부 구성요소 안내](../THIRD_PARTY_NOTICES.md)를 확인해 주세요. 이 저장소는 scrcpy를 활용하는 독립 프로젝트이며 Genymobile의 공식 제품이 아닙니다.
