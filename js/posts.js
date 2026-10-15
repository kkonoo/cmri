// 게시판 공통: Firestore에서 글 불러오기와 HTML 만들기
// 글 내용은 관리자가 쓴 그대로 보여 주고, 버튼·안내 문구만 한국어/영어 두 벌로 넣어요.
import { enabled, firestore } from './firebase.js';

export { enabled };

// 두 언어를 함께 넣으면 고른 언어만 보여요 (css/style.css의 [lang] 규칙)
export const bi = (ko, en) => `<span lang="ko">${ko}</span><span lang="en">${en}</span>`;

export const BOARDS = {
  notices: { ko: '공지사항', en: 'Notices' },
  seminars: { ko: '세미나', en: 'Seminars' },
  news: { ko: '연구소 소식', en: 'News' },
  newsletters: { ko: '뉴스레터', en: 'Newsletter' },
};

export const boardType = v => (v in BOARDS ? v : 'notices');

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MSG = {
  empty: bi('아직 올라온 글이 없어요.', 'No posts yet.'),
  failed: bi('글을 불러오지 못했어요. 잠시 후 다시 열어 주세요.', 'Could not load posts. Please try again later.'),
};

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const dotDate = d => d.replaceAll('-', '.');
const dayIndex = d => new Date(d + 'T00:00:00').getDay();
export const weekday = d => DAY_KO[dayIndex(d)];           // 메일 본문용 (한국어)
export const weekdayBi = d => bi(DAY_KO[dayIndex(d)], DAY_EN[dayIndex(d)]);
export function today() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
const isNew = d => Date.now() - new Date(d + 'T00:00:00') < 7 * 864e5;
export const safeUrl = u => (/^https?:\/\//i.test(u || '') ? u : null);
export const postUrl = (type, id) => `post.html?type=${type}&id=${encodeURIComponent(id)}`;

// 줄바꿈은 그대로, 빈 줄은 문단, 주소는 링크로
export function renderBody(text) {
  return String(text || '').trim().split(/\n{2,}/).map(para =>
    '<p>' + esc(para)
      .replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`)
      .replace(/\n/g, '<br>') + '</p>'
  ).join('');
}

function tag(category) {
  return category ? `<span class="tag${category === '동정' ? ' alt' : ''}">${esc(category)}</span>` : '';
}

export function postItem(type, p, pinnedRow = false) {
  return `<li${pinnedRow ? ' class="pinned"' : ''}><a href="${postUrl(type, p.id)}">
    ${pinnedRow ? `<span class="tag pin">${bi('고정', 'Pinned')}</span>` : ''}${tag(p.category)}
    <span class="title">${esc(p.title)}</span>
    ${isNew(p.date) ? '<span class="badge-new" aria-label="New">N</span>' : ''}
    <time datetime="${p.date}">${dotDate(p.date)}</time>
  </a></li>`;
}

export function seminarItem(p, withTitle = false) {
  const [y, m, d] = p.date.split('-');
  const who = p.speaker || p.title;
  const sub = [p.affiliation, withTitle && p.speaker ? p.title : ''].filter(Boolean);
  return `<li${p.date >= today() ? ' class="upcoming"' : ''}><a href="${postUrl('seminars', p.id)}">
    <time class="date-tile" datetime="${p.date}"><small>${y}.${m}</small><b>${d}</b><span>${weekdayBi(p.date)}</span></time>
    <div><strong>${esc(who)}</strong>${sub.map(s => `<p>${esc(s)}</p>`).join('')}</div>
  </a></li>`;
}

export function newsCard(p) {
  return `<a class="news-card" href="${postUrl('news', p.id)}">
    ${tag(p.category)}<h3>${esc(p.title)}</h3><time datetime="${p.date}">${dotDate(p.date)}</time>
  </a>`;
}

// 뉴스레터: 첫 번째 첨부 링크(PDF)가 있으면 바로 열어요
export function letterCard(p, i = 0) {
  const pdf = safeUrl(p.links?.[0]?.url);
  const attrs = pdf ? `href="${esc(pdf)}" target="_blank" rel="noopener"` : `href="${postUrl('newsletters', p.id)}"`;
  return `<a class="letter" ${attrs}>
    <span class="cover c${(i % 4) + 1}"><b>CMRI</b> Newsletter</span><span class="cap">${esc(p.title)}</span>
  </a>`;
}

const toPost = d => ({ id: d.id, ...d.data() });
const byDateDesc = (a, b) => b.date.localeCompare(a.date);

// 최신순 n개. after(마지막 문서)를 주면 그 다음부터
export async function listPosts(type, n, after) {
  const { db, fs } = await firestore();
  const parts = [fs.collection(db, type), fs.orderBy('date', 'desc'), fs.limit(n)];
  if (after) parts.splice(2, 0, fs.startAfter(after));
  const snap = await fs.getDocs(fs.query(...parts));
  return { posts: snap.docs.map(toPost), last: snap.docs.at(-1) };
}

export async function pinnedPosts(type) {
  const { db, fs } = await firestore();
  const snap = await fs.getDocs(fs.query(fs.collection(db, type), fs.where('pinned', '==', true)));
  return snap.docs.map(toPost).sort(byDateDesc);
}

// 분류가 같은 공지 (예: 규정, 모집)
export async function categoryPosts(type, category) {
  const { db, fs } = await firestore();
  const snap = await fs.getDocs(fs.query(fs.collection(db, type), fs.where('category', '==', category)));
  return snap.docs.map(toPost).sort(byDateDesc);
}

export async function getPost(type, id) {
  const { db, fs } = await firestore();
  const d = await fs.getDoc(fs.doc(db, type, id));
  return d.exists() ? toPost(d) : null;
}
