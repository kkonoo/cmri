// 메인 페이지: 관리자가 올린 공지·세미나·소식·뉴스레터를 보여 줘요.
// Firebase를 연결하기 전에는 index.html에 있는 예시 글이 그대로 보여요.
import { enabled, listPosts, postItem, seminarItem, newsCard, letterCard, MSG } from './posts.js';

const FEEDS = [
  ['#notice .post-list', 'notices', 5, p => postItem('notices', p)],
  ['#seminar .seminar-list', 'seminars', 4, p => seminarItem(p)],
  ['#news .news-grid', 'news', 4, newsCard],
  ['#newsletter .letter-grid', 'newsletters', 4, letterCard],
];

if (enabled) {
  for (const [sel, type, n, render] of FEEDS) {
    const el = document.querySelector(sel);
    const tag = el.tagName === 'UL' ? 'li' : 'p';
    const empty = html => `<${tag} class="empty">${html}</${tag}>`;
    el.innerHTML = '';
    listPosts(type, n)
      .then(({ posts }) => {
        el.innerHTML = posts.length ? posts.map(render).join('') : empty(MSG.empty);
      })
      .catch(err => {
        console.error(err);
        el.innerHTML = empty(MSG.failed);
      });
  }
}
