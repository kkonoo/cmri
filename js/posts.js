// 게시판 공통: Firestore에서 글 불러오기와 HTML 만들기
import { enabled, firestore } from './firebase.js';

export { enabled };

export const BOARDS = {
  notices: '공지사항',
  seminars: '세미나',
  news: '연구소 소식',
};

export const boardType = v => (v in BOARDS ? v : 'notices');

const DAY = ['일', '월', '화', '수', '목', '금', '토'];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const dotDate = d => d.replaceAll('-', '.');
export const weekday = d => DAY[new Date(d + 'T00:00:00').getDay()];
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
    ${pinnedRow ? '<span class="tag pin">고정</span>' : ''}${tag(p.category)}
    <span class="title">${esc(p.title)}</span>
    ${isNew(p.date) ? '<span class="badge-new" aria-label="새 글">N</span>' : ''}
    <time datetime="${p.date}">${dotDate(p.date)}</time>
  </a></li>`;
}

export function seminarItem(p, withTitle = false) {
  const [y, m, d] = p.date.split('-');
  const who = p.speaker || p.title;
  const sub = [p.affiliation, withTitle && p.speaker ? p.title : ''].filter(Boolean);
  return `<li${p.date >= today() ? ' class="upcoming"' : ''}><a href="${postUrl('seminars', p.id)}">
    <time class="date-tile" datetime="${p.date}"><small>${y}.${m}</small><b>${d}</b><span>${weekday(p.date)}</span></time>
    <div><strong>${esc(who)}</strong>${sub.map(s => `<p>${esc(s)}</p>`).join('')}</div>
  </a></li>`;
}

export function newsCard(p) {
  return `<a class="news-card" href="${postUrl('news', p.id)}">
    ${tag(p.category)}<h3>${esc(p.title)}</h3><time datetime="${p.date}">${dotDate(p.date)}</time>
  </a>`;
}

const toPost = d => ({ id: d.id, ...d.data() });

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
  return snap.docs.map(toPost).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPost(type, id) {
  const { db, fs } = await firestore();
  const d = await fs.getDoc(fs.doc(db, type, id));
  return d.exists() ? toPost(d) : null;
}
