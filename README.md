# 경북대학교 세포·기질연구소 홈페이지 리뉴얼

기존 홈페이지(cmri.knu.ac.kr)를 GitHub Pages용으로 새로 만드는 작업이에요. 관리자가 공지·세미나·소식과 연구진을 올리고, cmri@knu.ac.kr 이름으로 구성원에게 메일을 보낼 수 있어요.

- 홈페이지: https://kkonoo.github.io/cmri/
- 관리자: https://kkonoo.github.io/cmri/admin.html

## 하는 일

| 화면 | 하는 일 |
| --- | --- |
| 메인 (`index.html`) | 연구소 소개, 글로컬랩, 프로그램, 연구 지원 요약. 공지·세미나·소식·뉴스레터는 관리자가 올린 최신 글을 보여 줘요 |
| 연구소 소개 (`about.html`) | 인사말·소장 약력, 연혁·역대 소장, 조직, 연구진(관리자가 넣은 명단), 수상, 운영 규정 |
| 글로컬랩 (`glocal.html`) | 비전·목표, 핵심과제 3개, 자율과제 5개, 추진 체계, 로드맵·성과 목표, 참여 기관 |
| 프로그램 (`programs.html`) | 모집 공고, 학부생·대학원생·박사후·고교생 프로그램, 의료인문학, 공통 프로그램 |
| 연구 지원 (`support.html`) | 포상, 연구비 지원, 학술행사, 공동연구시설 4곳 장비, 문의 |
| 게시판 (`board.html`, `post.html`) | 공지사항·세미나·연구소 소식·뉴스레터 목록과 글 보기 |
| 관리자 → 게시글 | 글 쓰기·고치기·삭제, 공지 고정, 첨부 링크, 세미나 일시·장소·연사 |
| 관리자 → 연구진 | 참여교수·연구초빙교수·박사후연구원·연구원 명단과 사진. 엑셀에서 붙여 넣기 |
| 관리자 → 받는 사람 | 메일 명단. 엑셀에서 붙여 넣기, 그룹(구성원·참여 학생 등) |
| 관리자 → 메일 보내기 | 그룹을 골라 cmri@knu.ac.kr 이름으로 발송, 나에게 먼저 보내기, 보낸 기록과 실패 확인 |
| 관리자 → 관리자 | 관리자 추가·빼기 (구글 계정) |

Firebase를 연결하기 전에는 메인에 예시 글이 보이고, 게시판·관리자 화면은 설정 안내만 보여요.

- **한국어/영어**: 오른쪽 위 `EN`/`KO` 버튼. 처음에는 브라우저 언어를 따라요(한국어가 아니면 영어). 관리자가 쓴 글은 쓴 그대로 보여요.
- **밝은/어두운 화면**: 오른쪽 위 달·해 버튼. 처음에는 기기 설정을 따라요.
- 고른 값은 이 브라우저에 저장돼요(`cmri-prefs`).
- 공지 분류를 **규정**으로 쓰면 연구소 소개 → 운영 규정에, **모집**으로 쓰면 프로그램 → 모집 공고에도 나와요.
- 뉴스레터는 첫 번째 첨부 링크(PDF)가 바로 열려요.
- 연구진은 구분별로 가나다순으로 나와요. 사진은 관리자 화면에서 세로 3:4로 잘라 작게(한 장 10KB 안팎) 줄여 Firestore에 바로 저장해서, Storage를 따로 설정하지 않아도 돼요. 영문 칸을 비우면 영어 화면에도 한국어로 나와요. 위쪽 인원 숫자(참여교수 57명 등)는 `about.html`에 적힌 글이라 바뀌면 직접 고쳐요.

## 처음 설정 (한 번만)

### 1. Firebase 프로젝트

1. https://console.firebase.google.com 에서 **프로젝트 추가** (예: `cmri-knu`). 애널리틱스는 꺼도 돼요.
2. 프로젝트 설정 → 내 앱 → **웹 앱 추가(`</>`)**. 나온 `firebaseConfig` 값을 [`js/firebase-config.js`](js/firebase-config.js)의 `null` 자리에 붙여 넣어요.
3. **Authentication** → 시작하기 → 로그인 방법에서 **Google** 사용. 설정 → 승인된 도메인에 `kkonoo.github.io` 추가.
4. **Firestore Database** → 데이터베이스 만들기 → 위치 **asia-northeast3 (서울)**, 프로덕션 모드.
5. Firestore → 규칙 탭에 [`firestore.rules`](firestore.rules) 내용을 그대로 붙여 넣고 **게시**.
6. 첫 관리자 등록: Firestore → 데이터 → 컬렉션 시작 `admins` → 문서 ID에 관리자 구글 이메일(소문자, 예: `hong@gmail.com`) → 필드 아무거나 하나(예: `name` = 홍길동). 나머지 관리자는 관리자 페이지 → 관리자 탭에서 추가하면 돼요.

### 2. 메일 발송 (cmri@knu.ac.kr)

학교 메일 비밀번호는 브라우저에 둘 수 없어서, Firebase의 **Trigger Email** 확장 프로그램이 대신 학교 메일 서버(`msvr.knu.ac.kr:465`)로 보내요.

1. 요금제를 **Blaze(종량제)** 로 바꿔요 (프로젝트 개요 → 업그레이드, 결제 카드 등록). 이 정도 사용량은 무료 한도 안이라 보통 청구되지 않아요. Google Cloud 콘솔 → 결제 → **예산 및 알림**에서 월 1만 원 같은 알림을 걸어 두면 안심이에요.
2. Firebase → Extensions → **Trigger Email from Firestore** 설치. 설정값:

   | 항목 | 값 |
   | --- | --- |
   | Cloud Functions location | `asia-northeast3` (서울) |
   | Authentication Type | `UsernamePassword` |
   | SMTP connection URI | `smtps://cmri%40knu.ac.kr@msvr.knu.ac.kr:465` |
   | SMTP password | cmri@knu.ac.kr 비밀번호 |
   | Email documents collection | `mail` |
   | Default FROM address | `경북대학교 세포·기질연구소 <cmri@knu.ac.kr>` |

   나머지(Reply-To, Users·Templates collection 등)는 비워 둬요. 확장 프로그램 버전에 따라 항목 이름이 조금 다를 수 있어요.
3. 관리자 페이지 → 메일 보내기 → **나에게 먼저 보내기**로 시험해요. 보낸 기록에 ‘1명 보냄’이 뜨면 끝이에요.

알아 둘 것

- 받는 사람끼리 주소가 보이지 않게 숨은참조 50명씩 나눠 보내요. 받는 주소는 cmri@knu.ac.kr이라 보낸 메일이 학교 메일함에도 한 통씩 남아요.
- cmri@knu.ac.kr 비밀번호를 바꾸면 확장 프로그램 설정의 SMTP password도 바꿔야 해요.
- 보낸 기록이 10분 넘게 ‘보내는 중’이면 확장 프로그램 설정이나 학교 메일 서버의 하루 발송 제한을 확인해 주세요.

### 3. GitHub Pages

저장소 Settings → Pages → Source: Deploy from a branch → `main` / `(root)`.

## 데이터는 어디에

모두 Firestore에 있고, 누가 읽고 쓸 수 있는지는 [`firestore.rules`](firestore.rules)가 정해요.

| 컬렉션 | 내용 | 읽기 | 쓰기 |
| --- | --- | --- | --- |
| `notices`, `seminars`, `news`, `newsletters` | 게시글 | 누구나 | 관리자 |
| `faculty` | 연구진 (이메일도 공개돼요) | 누구나 | 관리자 |
| `recipients` | 메일 명단 (문서 ID = 이메일) | 관리자 | 관리자 |
| `admins` | 관리자 (문서 ID = 이메일) | 관리자 | 관리자 |
| `campaigns` | 보낸 메일 기록 | 관리자 | 관리자 |
| `mail` | 확장 프로그램이 보낼 메일 | 관리자 | 관리자 (보내는 주소는 못 바꿈, 한 통 50명까지) |

## 파일

| 파일 | 내용 |
| --- | --- |
| `index.html` | 메인 |
| `about.html`, `glocal.html`, `programs.html`, `support.html` | 하위 페이지 |
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
| `js/admin-mail.js` | 받는 사람 명단, 메일 보내기, 보낸 기록 |
| `firestore.rules` | Firestore 보안 규칙 |
| `img/` | 첫 화면 그림, 송년심포지엄 사진 |
| `old/` | 기존 홈페이지 스크린샷 (참고용) |

## 글 고치기

- 한 페이지 안에 한국어와 영어가 함께 있어요. `<span lang="ko">한국어</span><span lang="en">English</span>`처럼 짝으로 쓰면 고른 언어만 보여요. 긴 문단은 `<p lang="ko">`, `<p lang="en">`로 나눠요.
- 위쪽 메뉴와 푸터는 모든 HTML 파일(`index`, `about`, `glocal`, `programs`, `support`, `board`, `post`)에 똑같이 들어 있어요. 메뉴를 바꿀 때는 일곱 파일을 함께 고쳐요.
- 색은 `css/style.css` 맨 위 `:root`(밝은 화면)와 바로 아래 어두운 화면 블록에서 바꿔요.

## 내용 출처

| 영역 | 출처 |
| --- | --- |
| 예시 공지·세미나·소식, 장비, 교육 프로그램 | 기존 홈페이지 (`old/` 스크린샷) |
| 글로컬랩·핵심과제·실적·연혁·연구 지원 제도·추진 체계 | 2026 글로컬랩 계획서와 발표 자료 |
| 인사말·소장 약력·조직·장비 | 기존 홈페이지 (영문) |
| 영어 문장 | DeepL 번역을 바탕으로 다듬음. 원어민 검토를 권해요 |
| 송년심포지엄 사진 | 발표 자료에서 잘라 냄 |
