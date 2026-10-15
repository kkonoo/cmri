// 메인 페이지: 관리자가 올린 공지·세미나·소식을 보여 줘요.
// Firebase를 연결하기 전에는 index.html에 있는 예시 글이 그대로 보여요.
import { enabled, listPosts, postItem, seminarItem, newsCard } from './posts.js';

const FEEDS = [
  ['#notice .post-list', 'notices', 5, p => postItem('notices', p)],
  ['#seminar .seminar-list', 'seminars', 4, p => seminarItem(p)],
  ['#news .news-grid', 'news', 4, newsCard],
];

if (enabled) {
  for (const [sel, type, n, render] of FEEDS) {
    const el = document.querySelector(sel);
    const tag = el.tagName === 'UL' ? 'li' : 'p';
    const empty = text => `<${tag} class="empty">${text}</${tag}>`;
    el.innerHTML = '';
    listPosts(type, n)
      .then(({ posts }) => {
        el.innerHTML = posts.length ? posts.map(render).join('') : empty('아직 올라온 글이 없어요.');
      })
      .catch(err => {
        console.error(err);
        el.innerHTML = empty('글을 불러오지 못했어요. 잠시 후 다시 열어 주세요.');
      });
  }
}
