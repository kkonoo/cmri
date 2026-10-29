# 경북대학교 세포·기질연구소 홈페이지 리뉴얼

기존 홈페이지(cmri.knu.ac.kr)를 GitHub Pages용으로 새로 만드는 작업이에요. 관리자가 공지·세미나·소식과 연구진을 올리고, cmri@knu.ac.kr 이름으로 구성원에게 메일을 보낼 수 있어요. 연구비 지원·포상 신청과 분기별 업적 제출도 홈페이지에서 받아요.

- 홈페이지: https://kkonoo.github.io/cmri/
- 관리자: https://kkonoo.github.io/cmri/admin.html

## 하는 일

| 화면 | 하는 일 |
| --- | --- |
| 메인 (`index.html`) | 공지사항·세미나 → 연구소 소식 → 소장 인사말·연혁 → 연구 지원·학술행사 → 참여 프로그램 → 글로컬랩. 공지·세미나·소식은 관리자가 올린 최신 글을 보여 줘요 (뉴스레터는 게시판에만) |
| 연구소 소개 (`about.html`) | 인사말·소장 약력, 연혁·역대 소장, 조직, 연구진(관리자가 넣은 명단), 수상, 운영 규정 |
| 글로컬랩 (`glocal.html`) | 사업 소개(비전·목표), 참여 기관, 핵심과제 3개, 자율과제 5개, 로드맵, 추진 체계 |
| 프로그램 (`programs.html`) | 모집 공고, 공통 프로그램, 박사후·신진연구자, 대학원생, 학부생, 고교생·지역, 의료인문학 |
| 연구 지원 (`support.html`) | 포상, 연구비 지원, 업적 제출, 학술행사, 공동연구시설 4곳 장비, 문의. 포상·연구비·업적마다 신청 링크 |
| 신청·제출 (`apply.html`) | 학교 메일(@knu.ac.kr)로 받은 링크로 로그인 → 연구비 지원 3종·포상 5종·업적 제출, 증빙 파일 올리기, 내 신청과 결과 보기 |
| 게시판 (`board.html`, `post.html`) | 공지사항·세미나·연구소 소식·뉴스레터 목록과 글 보기 |
| 관리자 → 게시글 | 글 쓰기·고치기·삭제, 공지 고정, 첨부 링크, 세미나 일시·장소·연사 |
| 관리자 → 신청·제출 | 들어온 신청 보기·첨부 파일 열기, 승인(선정·확인)·반려와 결과 메일, 삭제, 고른 목록을 CSV(엑셀)로 받기 |
| 관리자 → 연구진 | 참여교수·연구초빙교수·박사후연구원·연구원 명단과 사진. 엑셀에서 붙여 넣기, 사진 여러 장을 파일 이름(홍길동.jpg, Gil-Dong Hong.jpg)으로 한꺼번에 넣기 |
| 관리자 → 받는 사람 | 메일 명단. 엑셀 열이나 메일의 받는 사람·참조 목록(`홍길동 <hong@knu.ac.kr>`)을 그대로 붙여 넣기 — 이름 옆 직함(연구초빙교수·연구원·학생 등)으로 그룹 자동 지정. 그룹 버튼으로 거르기, 사람을 골라 그룹에 넣기·빼기, 그룹 이름 바꾸기·지우기 |
| 관리자 → 메일 보내기 | 그룹을 골라 cmri@knu.ac.kr 이름으로 발송, 나에게 먼저 보내기, 보낸 기록과 실패 확인 |
| 관리자 → 관리자 | 관리자 추가·빼기 (구글 계정) |

Firebase를 연결하기 전에는 메인에 예시 글이 보이고, 게시판·관리자·신청 화면은 설정 안내만 보여요.

- **한국어/영어**: 오른쪽 위 `EN`/`KO` 버튼. 처음에는 브라우저 언어를 따라요(한국어가 아니면 영어). 관리자가 쓴 글은 쓴 그대로 보여요.
- **밝은/어두운 화면**: 오른쪽 위 달·해 버튼. 처음에는 기기 설정을 따라요.
- 고른 값은 이 브라우저에 저장돼요(`cmri-prefs`).
- 공지 분류를 **규정**으로 쓰면 연구소 소개 → 운영 규정에, **모집**으로 쓰면 프로그램 → 모집 공고에도 나와요.
- 뉴스레터는 첫 번째 첨부 링크(PDF)가 바로 열려요.
- 연구진은 구분별로 나와요. 편집 창에서 **소장**에 체크한 사람이 맨 앞, 나머지는 가나다순이에요. 사진은 관리자 화면에서 세로 3:4로 잘라 작게(한 장 10KB 안팎) 줄여 Firestore에 바로 저장해서, Storage를 따로 설정하지 않아도 돼요. 영문 칸을 비우면 영어 화면에도 한국어로 나와요. 위쪽 인원 숫자(참여교수 57명 등)는 `about.html`에 적힌 글이라 바뀌면 직접 고쳐요.

- 신청·제출: 새 신청이 들어오면 cmri@knu.ac.kr로 알림 메일이 가고, 관리자 탭에 접수 건수가 떠요. 결과를 정하면 신청자에게 메일이 가고(끌 수 있어요) 신청 화면에도 결과 안내가 보여요. 종류와 칸은 [`js/apply-types.js`](js/apply-types.js)에서 바꿔요(종류를 더하면 `firestore.rules`의 목록도 함께).

## 처음 설정 (한 번만)

### 1. Firebase 프로젝트

1. https://console.firebase.google.com 에서 **프로젝트 추가** (예: `cmri-knu`). 애널리틱스는 꺼도 돼요.
2. 프로젝트 설정 → 내 앱 → **웹 앱 추가(`</>`)**. 나온 `firebaseConfig` 값을 [`js/firebase-config.js`](js/firebase-config.js)의 `null` 자리에 붙여 넣어요.
3. **Authentication** → 시작하기 → 로그인 방법에서 **Google** 사용. 설정 → 승인된 도메인에 `kkonoo.github.io` 추가.
4. **Firestore Database** → 데이터베이스 만들기 → 위치 **asia-northeast3 (서울)**, 프로덕션 모드.
5. Firestore → 규칙 탭에 [`firestore.rules`](firestore.rules) 내용을 그대로 붙여 넣고 **게시**.
6. 첫 관리자 등록: Firestore → 데이터 → 컬렉션 시작 `admins` → 문서 ID에 관리자 구글 이메일(소문자, 예: `hong@gmail.com`) → 필드 아무거나 하나(예: `name` = 홍길동). 나머지 관리자는 관리자 페이지 → 관리자 탭에서 추가하면 돼요.

### 2. 메일 발송 (cmri@knu.ac.kr)

학교 메일 비밀번호는 브라우저에 둘 수 없어서, 저장소의 [`functions/index.js`](functions/index.js)(Cloud Function `sendMail`)가 `mail` 컬렉션에 쌓인 메일을 학교 메일 서버(`msvr.knu.ac.kr:465`)로 대신 보내요. 비밀번호는 Google Secret Manager에만 있어요. (Firebase의 Trigger Email 확장 프로그램은 2027년 3월에 서비스가 끝나서 쓰지 않아요.)

1. 요금제를 **Blaze(종량제)** 로 바꿔요 (프로젝트 개요 → 업그레이드, 결제 카드 등록). 이 정도 사용량은 무료 한도 안이라 보통 청구되지 않아요. Google Cloud 콘솔 → 결제 → **예산 및 알림**에서 월 1만 원 같은 알림을 걸어 두면 안심이에요.
2. 내 컴퓨터에 [Node.js](https://nodejs.org) 22 이상을 설치하고, 터미널(Windows는 PowerShell)에서 한 번만:

   ```sh
   npm install -g firebase-tools
   firebase login                       # 프로젝트 관리자 구글 계정으로
   git clone https://github.com/kkonoo/cmri.git
   cd cmri/functions && npm install && cd ..
   firebase functions:secrets:set SMTP_PASSWORD   # cmri@knu.ac.kr 비밀번호를 물어보면 입력
   firebase deploy --only functions
   ```

   처음 배포할 때 Cloud Functions·Secret Manager 같은 서비스를 켜도 되는지 물으면 `y`로 답해요. 함수는 서울(`asia-northeast3`)에서 돌아요.
3. 관리자 페이지 → 메일 보내기 → **나에게 먼저 보내기**로 시험해요. 보낸 기록에 ‘1명 보냄’이 뜨면 끝이에요.

알아 둘 것

- 받는 사람끼리 주소가 보이지 않게 숨은참조 50명씩 나눠 보내요. 받는 주소는 cmri@knu.ac.kr이라 보낸 메일이 학교 메일함에도 한 통씩 남아요.
- 보내는 주소는 함수에서 `cmri@knu.ac.kr`로 고정돼 있어요. 메일 문서에 다른 주소를 넣어도 바뀌지 않아요.
- **cmri@knu.ac.kr 비밀번호를 바꾸면** 저장소 폴더에서 `firebase functions:secrets:set SMTP_PASSWORD`로 새 비밀번호를 넣고 `firebase deploy --only functions`를 다시 해요.
- 보낸 기록이 ‘실패’면 그 줄을 눌러 이유를 봐요. 비밀번호가 틀렸거나 학교 메일에서 외부 메일 프로그램(SMTP) 사용이 꺼져 있는 경우가 많아요. 10분 넘게 ‘보내는 중’이면 함수가 배포됐는지 확인해 주세요 (Firebase 콘솔 → Functions에 `sendMail`).
- 규칙 파일도 같은 방법으로 올릴 수 있어요: `firebase deploy --only firestore:rules,storage` (콘솔에 붙여 넣는 것과 같아요).
- **다른 계정(예: Gmail)으로 먼저 시험하려면**: `functions` 폴더에 `.env` 파일을 만들어 아래 두 줄을 적고, `SMTP_PASSWORD`에 그 계정의 비밀번호를 넣고 배포해요. Gmail은 일반 비밀번호 대신 **앱 비밀번호**(구글 계정 → 보안 → 2단계 인증을 켠 뒤 ‘앱 비밀번호’)를 써요. 학교 메일로 돌아갈 때는 `.env`를 지우고, `SMTP_PASSWORD`를 cmri 비밀번호로 바꾼 뒤 다시 배포해요. `.env`는 저장소에 올라가지 않아요.

  ```
  SMTP_USER=내계정@gmail.com
  SMTP_HOST=smtp.gmail.com
  ```

### 3. 신청·제출 (학교 메일 로그인, 증빙 파일)

1. **Authentication** → 로그인 방법 → **이메일/비밀번호** 사용 설정 → 그 안의 **이메일 링크(비밀번호가 없는 로그인)** 도 켜요.
2. 프로젝트 설정 → 일반 → **공개용 이름**을 `경북대학교 세포·기질연구소`로 바꿔요. 로그인 링크 메일에 이 이름이 보여요. 로그인 메일은 Firebase(`noreply@cmri-knumed.firebaseapp.com`)가 보내서 스팸함에 갈 수 있어요.
3. **Storage** → 시작하기 (Blaze 요금제 필요) → 위치 `asia-northeast3`(서울). PDF 몇백 개 정도면 비용은 보통 한 달 몇십 원 수준이에요.
4. Storage → 규칙 탭에 [`storage.rules`](storage.rules)를 붙여 넣고 **게시**. 관리자인지 Firestore에서 확인하는 규칙이라, Firestore 접근 권한을 묻는 창이 뜨면 허용해 주세요.
5. Firestore 규칙도 새 [`firestore.rules`](firestore.rules)로 다시 게시해요.
6. 신청 알림·결과 메일은 2번(메일 함수)을 배포해야 나가요. 그 전에도 신청과 관리는 돼요.

### 4. GitHub Pages

저장소 Settings → Pages → Source: Deploy from a branch → `main` / `(root)`.

### 5. 옛 홈페이지 글 옮기기 (한 번만)

옛 홈페이지(cmri.knu.ac.kr)의 공지·소식·뉴스레터를 새 게시판으로 옮겨요. 첨부파일과 사진은 Firebase Storage로 옮겨서 옛 서버를 닫아도 열려요. 옛 서버가 해외 접속을 막아서 **학교·집 같은 국내 인터넷에 연결된 내 컴퓨터**에서 돌려요.

1. 3번의 Storage가 켜져 있어야 해요.
2. Firebase 콘솔 → 프로젝트 설정 → **서비스 계정** → **새 비공개 키 생성**. 받은 JSON 파일 이름을 `service-account.json`으로 바꿔 저장소의 `tools` 폴더에 넣어요. 관리자 권한 키라 다른 사람에게 주지 말아요(저장소에는 올라가지 않아요).
3. 터미널에서 (Node.js는 2번 메일 설정 때 설치한 것):

   ```sh
   cd cmri/tools
   npm install
   node import-old-board.mjs            # 미리보기
   node import-old-board.mjs --upload   # 올리기
   ```

   미리보기는 옛 글과 파일을 `tools/.old-board/`에 받아 두고 무엇을 몇 개 옮길지 보여 줘요. Firebase는 건드리지 않아요. 글 내용은 `tools/.old-board/preview.json`, 손볼 것은 `warnings.txt`에서 봐요. 괜찮으면 `--upload`로 올려요. 처음에는 글 680개쯤과 파일을 받느라 시간이 걸리고, 다시 돌리면 받아 둔 것을 써서 빨라요.
4. 다 옮기면 `tools/service-account.json`을 지우고, Google Cloud 콘솔 → IAM 및 관리자 → 서비스 계정에서 그 키도 삭제해요.

옮기는 방법

| 옛 게시판 | 새 게시판 | 이렇게 바꿔요 |
| --- | --- | --- |
| Notice | 공지사항 | `[채용]`·`[기업 지원 공고]`·`[심포지엄 공지]` 머리말은 분류로(제목에서 빼요). 머리말이 없으면 `[세포기질연구소] …규정·세칙·계획`은 규정, ‘수상자 발표’는 수상, ‘성료·개최’는 행사, 나머지는 공지. 옛 고정 글은 새로도 고정 |
| Notice의 `[세미나 공지]` | 세미나 | 제목의 날짜를 세미나 날로, 본문의 ‘제목:’·‘장소:’·시간을 칸으로. 주제를 못 찾으면 연사(제목 뒷부분)를 제목으로 |
| News | 연구소 소식 | `[언론 보도]`·`[동정]`·`[수상]` 머리말은 분류로 |
| Newsletter | 뉴스레터 | 본문의 쪽 이미지를 차례대로 PDF 하나로 묶어요(PDF 첨부가 있으면 그것) |

- 본문은 글자만 옮기고 줄바꿈·표는 살려요. 첨부와 본문 사진은 첨부 링크가 되고, 합쳐서 10개가 넘으면 본문 사진을 `본문 이미지 모음.pdf` 하나로 묶어요.
- 받은 목록·글·파일은 `tools/.old-board/`에 남아서 다시 돌리면 못 받은 것만 받아요. 옛 사이트에 글이 새로 올라온 뒤 다시 옮기려면 `tools/.old-board/lists`를 지우고 돌려요.
- 옛 호스팅은 하루 트래픽 한도가 있어서(넘으면 옛 홈페이지가 하루 동안 안 열려요) 한 번 돌릴 때 옛 서버에서 300MB까지만 받아요. 그때까지 다 받은 글만 정리하고(`--upload`면 올리고) 나머지는 다음 날 다시 돌리면 이어서 받아요. 그래서 하루 한 번 `--upload`로 돌리면 공지부터 차례로 채워져요. 양은 `--max-mb 500`처럼 바꾸고, `--max-mb 0`이면 옛 서버에서 받지 않고 받아 둔 것만으로 되는 글을 정리해요(그날 이미 많이 받았을 때 `--upload --max-mb 0`).
- 옛 서버가 접속을 막으면(트래픽 초과 등) 더 받지 않고, 받아 둔 것만으로 되는 글만 정리해요. 받은 화면은 `tools/.old-board/blocked.html`에 남아요.
- 문서 ID가 `old-옛번호`라서 다시 돌려도 같은 글을 덮어쓸 뿐 겹치지 않아요. 그래서 옮긴 글을 관리자 화면에서 고친 뒤 다시 돌리면 옛 내용으로 돌아가요. 관리자가 이미 손으로 올린 글(같은 게시판·날짜·제목)은 건너뛰어요.
- Storage 비용: 서울 위치는 무료 한도가 없어서 저장 1GB에 한 달 30원쯤, 사람들이 내려받는 양 1GB에 170원쯤이에요(대략). 미리보기 끝에 전체 파일 용량이 나와요.

## 데이터는 어디에

모두 Firestore에 있고, 누가 읽고 쓸 수 있는지는 [`firestore.rules`](firestore.rules)가 정해요.

| 컬렉션 | 내용 | 읽기 | 쓰기 |
| --- | --- | --- | --- |
| `notices`, `seminars`, `news`, `newsletters` | 게시글 | 누구나 | 관리자 |
| `faculty` | 연구진 (이메일도 공개돼요) | 누구나 | 관리자 |
| `applications` | 신청·제출 | 신청자 본인·관리자 | 신청자는 학교 메일로 새로 내기만, 관리자는 결과·삭제만 |
| `recipients` | 메일 명단 (문서 ID = 이메일) | 관리자 | 관리자 |
| `admins` | 관리자 (문서 ID = 이메일) | 관리자 | 관리자 |
| `campaigns` | 보낸 메일 기록 | 관리자 | 관리자 |
| `mail` | 메일 함수(`sendMail`)가 보낼 메일, 결과는 `delivery` 칸에 | 관리자 | 관리자 (보내는 주소는 못 바꿈, 한 통 50명까지). 신청 알림은 신청자가 연구소로 한 번, 결과는 관리자가 그 신청자에게만 |
| Storage `applications/{신청자}/{신청}/` | 증빙 파일 (20MB, 한글·PDF·사진 등) | 신청자 본인·관리자 | 신청자는 올리기만, 관리자는 지우기 |
| Storage `old-board/{글}/` | 옛 홈페이지 글의 첨부·사진·뉴스레터 PDF | 게시글의 첨부 링크(다운로드 토큰)로 누구나 | 옮기기 도구(`tools/`)만 |

## 파일

| 파일 | 내용 |
| --- | --- |
| `index.html` | 메인 |
| `about.html`, `glocal.html`, `programs.html`, `support.html` | 하위 페이지 |
| `apply.html` | 신청·제출 |
| `board.html`, `post.html` | 게시판 목록, 글 보기 |
| `admin.html` | 관리자 |
| `css/style.css` | 공통 스타일 (색·간격 토큰은 맨 위 `:root`) |
| `css/admin.css` | 관리자 화면 스타일 |
| `js/main.js` | 언어·화면 밝기 버튼, 모바일 메뉴, 하위 페이지 안 메뉴 표시 |
| `js/live-lists.js` | 운영 규정·모집 공고 목록 (분류가 같은 공지) |
| `js/faculty.js` | 연구소 소개 → 연구진 목록 |
| `js/firebase-config.js` | Firebase 설정값 (처음 설정 1-2) |
| `js/firebase.js` | Firebase SDK 불러오기 |
| `js/posts.js` | 게시글 불러오기·그리기 공통 |
| `js/home.js`, `js/board.js` | 메인 최신 글, 게시판·글 보기 |
| `js/admin.js` | 관리자 로그인·탭·관리자 목록 |
| `js/admin-posts.js` | 게시글 관리 |
| `js/admin-faculty.js` | 연구진 관리, 사진 줄이기 |
| `js/apply.js`, `js/apply-types.js` | 신청 화면, 신청 종류·칸 (관리자 화면과 함께 씀) |
| `js/admin-applications.js` | 신청·제출 관리, 결과 메일, CSV |
| `js/admin-mail.js` | 받는 사람 명단, 메일 보내기, 보낸 기록 |
| `firestore.rules`, `storage.rules` | Firestore·Storage 보안 규칙 |
| `functions/` | 메일 보내는 Cloud Function (`firebase deploy --only functions`) |
| `firebase.json`, `.firebaserc` | Firebase CLI 설정 (프로젝트 `cmri-knumed`) |
| `img/` | 로고, 파비콘, 첫 화면 그림, 송년심포지엄 사진 |
| `tools/` | 옛 홈페이지 게시판 옮기기 (`import-old-board.mjs`, 처음 설정 5) |
| `old/` | 기존 홈페이지 스크린샷 (참고용) |

## 글 고치기

- 한 페이지 안에 한국어와 영어가 함께 있어요. `<span lang="ko">한국어</span><span lang="en">English</span>`처럼 짝으로 쓰면 고른 언어만 보여요. 긴 문단은 `<p lang="ko">`, `<p lang="en">`로 나눠요.
- 위쪽 메뉴와 푸터는 모든 HTML 파일(`index`, `about`, `glocal`, `programs`, `support`, `apply`, `board`, `post`)에 똑같이 들어 있어요. 메뉴를 바꿀 때는 여덟 파일을 함께 고쳐요.
- 색은 `css/style.css` 맨 위 `:root`(밝은 화면)와 바로 아래 어두운 화면 블록에서 바꿔요.

## 내용 출처

| 영역 | 출처 |
| --- | --- |
| 예시 공지·세미나·소식, 장비, 교육 프로그램 | 기존 홈페이지 (`old/` 스크린샷) |
| 글로컬랩·핵심과제·실적·연혁·연구 지원 제도·추진 체계 | 2026 글로컬랩 계획서와 발표 자료 |
| 인사말·소장 약력·조직·장비 | 기존 홈페이지 (영문) |
| 영어 문장 | DeepL 번역을 바탕으로 다듬음. 원어민 검토를 권해요 |
| 송년심포지엄 사진 | 발표 자료에서 잘라 냄 |
