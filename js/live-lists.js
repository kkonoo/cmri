// 하위 페이지의 '운영 규정', '모집 공고' 목록: 분류가 같은 공지를 보여 줘요.
// <ul data-category="규정"> 처럼 표시하고, Firebase 연결 전에는 HTML에 있는 예시가 그대로 보여요.
import { enabled, categoryPosts, postItem, MSG } from './posts.js';

if (enabled) {
  for (const list of document.querySelectorAll('ul[data-category]')) {
    categoryPosts('notices', list.dataset.category)
      .then(posts => {
        list.innerHTML = posts.length
          ? posts.slice(0, 10).map(p => postItem('notices', p)).join('')
          : `<li class="empty">${MSG.empty}</li>`;
      })
      .catch(err => {
        console.error(err);
        list.innerHTML = `<li class="empty">${MSG.failed}</li>`;
      });
  }
}
