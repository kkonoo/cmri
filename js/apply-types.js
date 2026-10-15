// 신청·제출 종류: 신청 화면(apply.js), 관리자 화면(admin-applications.js), 알림 메일이 함께 써요.
// 종류를 더하거나 칸을 바꾸면 firestore.rules의 type 목록도 같이 고쳐요.

export const GROUPS = {
  funding: { ko: '연구비 지원', en: 'Funding' },
  award: { ko: '포상', en: 'Awards' },
  achievement: { ko: '업적 제출', en: 'Achievements' },
};

// 칸: key, 한국어·영어 이름, kind(text·date·textarea·choice·check), required, options(choice: [한국어, 영어]),
// short(관리자 화면·CSV에 쓰는 짧은 이름)
const F = {
  paperTitle: { key: 'paperTitle', ko: '논문 제목', en: 'Paper title', required: true },
  journal: { key: 'journal', ko: '학술지', en: 'Journal', required: true },
  impactFactor: { key: 'impactFactor', ko: 'IF', en: 'Impact factor' },
  publishedAt: { key: 'publishedAt', ko: '게재일', en: 'Publication date', kind: 'date' },
  authorRole: { key: 'authorRole', ko: '저자 구분', en: 'Author role', kind: 'choice',
    options: [['제1저자', 'First author'], ['교신저자', 'Corresponding author'], ['공동저자', 'Co-author']] },
};

export const TYPES = {
  publication: {
    group: 'funding', ko: '논문 게재료', en: 'Publication fees', amount: true,
    fields: [F.paperTitle, F.journal, F.impactFactor, F.publishedAt, F.authorRole],
    files: ['예: 논문 PDF, 게재료 영수증', 'e.g. paper PDF, publication fee invoice'],
  },
  proposal: {
    group: 'funding', ko: '신규 과제 신청 지원금', en: 'New grant proposals', amount: true,
    fields: [
      { key: 'projectTitle', ko: '과제명', en: 'Project title', required: true },
      { key: 'agency', ko: '지원 기관·사업명', en: 'Funding agency and program', required: true },
      { key: 'submittedAt', ko: '신청일', en: 'Submission date', kind: 'date' },
    ],
    files: ['예: 과제 신청 확인서', 'e.g. proof of grant submission'],
  },
  editing: {
    group: 'funding', ko: '영문 교정 · 학술대회 참가', en: 'English editing & conferences', amount: true,
    fields: [
      { key: 'kind', ko: '구분', en: 'Type', kind: 'choice', required: true, options: [['영문 교정', 'English editing'], ['학술대회 참가', 'Conference']] },
      { key: 'subject', ko: '학술지 또는 학술대회 이름', en: 'Journal or conference', required: true },
      { key: 'period', ko: '기간·장소', en: 'Dates and venue' },
    ],
    files: ['예: 교정 영수증, 학술대회 등록 영수증', 'e.g. receipts for English editing or conference registration'],
  },
  'academic-award': {
    group: 'award', ko: '학술상', en: 'Academic Award',
    fields: [F.paperTitle, F.journal, { ...F.impactFactor, required: true }, F.publishedAt],
    files: ['예: 논문 PDF', 'e.g. paper PDF'],
  },
  'paper-award': {
    group: 'award', ko: '우수논문상', en: 'Best Paper Award',
    fields: [F.paperTitle, F.journal, F.impactFactor, F.publishedAt, F.authorRole,
      { key: 'advisor', ko: '지도교수', en: 'Advisor' }],
    files: ['예: 논문 PDF', 'e.g. paper PDF'],
  },
  'young-scientist': {
    group: 'award', ko: '젊은 과학자상', en: 'Young Scientist Award',
    fields: [{ key: 'achievements', ko: '주요 연구 업적', en: 'Key research achievements', kind: 'textarea', required: true }],
    files: ['예: 업적 목록, 대표 논문', 'e.g. list of achievements, key papers'],
  },
  'research-note': {
    group: 'award', ko: '연구노트상', en: 'Lab Notebook Award',
    fields: [
      { key: 'lab', ko: '연구실(책임교수)', en: 'Lab (PI)', required: true },
      { key: 'noteSummary', ko: '연구노트 소개', en: 'About the notebooks', kind: 'textarea' },
    ],
    files: ['예: 연구노트 사진 또는 스캔본', 'e.g. photos or scans of lab notebooks'],
  },
  'photo-contest': {
    group: 'award', ko: '사진 콘테스트', en: 'Photo contest', needsFile: true,
    fields: [
      { key: 'photoTitle', ko: '사진 제목', en: 'Photo title', required: true },
      { key: 'photoStory', ko: '사진 설명', en: 'About the photo', kind: 'textarea' },
    ],
    files: ['사진 파일(JPG·PNG)을 올려 주세요.', 'Please attach the photo (JPG or PNG).'],
  },
  achievement: {
    group: 'achievement', ko: '업적 제출', en: 'Achievement report',
    fields: [
      { key: 'kind', ko: '구분', en: 'Type', kind: 'choice', required: true,
        options: [['논문', 'Paper'], ['특허', 'Patent'], ['기술이전', 'Technology transfer'], ['수상', 'Award'], ['언론보도', 'Media coverage']] },
      { key: 'title', ko: '제목', en: 'Title', required: true },
      { key: 'date', ko: '날짜 (발행·등록·계약·수상·보도일)', en: 'Date (published, registered, signed, awarded or reported)', kind: 'date', required: true },
      { key: 'source', ko: '학술지·발행처', en: 'Journal or source' },
      { key: 'link', ko: '링크 (DOI·기사 주소)', en: 'Link (DOI or article URL)' },
      { key: 'acknowledged', ko: '연구소 소속을 밝혔거나 연구소로 이관한 연구비를 사사했어요.', en: 'CMRI is named as an affiliation, or funding administered by CMRI is acknowledged.', kind: 'check', short: '연구소 소속·사사 표기' },
    ],
    files: ['예: 논문 PDF, 특허 등록증, 계약서, 상장, 보도자료', 'e.g. paper PDF, patent certificate, contract, award certificate, press release'],
  },
};

// 목록에 보일 한 줄 제목: 그 종류의 첫 글자 칸
export function summary(a) {
  const t = TYPES[a.type];
  const key = t?.fields.find(f => !f.kind || f.kind === 'textarea')?.key;
  return String(a.details?.[key] ?? '').split('\n')[0];
}

// 결과 이름은 묶음마다 달라요
const RESULT = {
  funding: { approved: ['승인', 'Approved'], rejected: ['반려', 'Returned'] },
  award: { approved: ['선정', 'Selected'], rejected: ['미선정', 'Not selected'] },
  achievement: { approved: ['확인', 'Confirmed'], rejected: ['반려', 'Returned'] },
};
export function statusLabel(a, status = a.status) {
  if (status === 'submitted') return ['접수', 'Submitted'];
  return RESULT[TYPES[a.type]?.group]?.[status] || [status, status];
}

// 관리자 화면·메일에 쓰는 세부 내용 [이름, 값]
export function detailRows(a) {
  const t = TYPES[a.type];
  return (t?.fields || []).map(f => [f.short || f.ko, a.details?.[f.key]]).filter(([, v]) => v != null && v !== '');
}

export const won = n => `${Number(n).toLocaleString('ko-KR')}원`;
