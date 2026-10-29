// 관리자 목록 쪽 나누기: 10/25/50/100개씩. 고른 개수는 목록마다 이 브라우저에 기억해요
import { pageNumbers } from './posts.js';

const SIZES = [10, 25, 50, 100];

// el: 쪽 단추를 그릴 곳, table: 쪽을 넘기면 맨 위가 보이게 할 목록, render: 다시 그리기
export function createPager(el, table, render) {
  const key = `cmri-admin-page-size:${el.id}`;
  let page = 1;
  let size = 25;
  try { size = SIZES.find(n => n === Number(localStorage.getItem(key))) || size; } catch { /* 기본 25개 */ }

  el.addEventListener('click', e => {
    const b = e.target.closest('button[data-page]');
    if (!b || b.disabled) return;
    page = Number(b.dataset.page);
    render();
    const top = table.getBoundingClientRect().top;
    if (top < 0) window.scrollBy({ top: top - 100 });
  });
  el.addEventListener('change', e => {
    size = Number(e.target.value);
    page = 1;
    try { localStorage.setItem(key, size); } catch { /* 다음에는 25개씩 */ }
    render();
  });

  return {
    reset() { page = 1; },
    // 지금 쪽에 보일 것만 잘라 주고, 쪽 단추를 그려요
    slice(list) {
      const last = Math.max(1, Math.ceil(list.length / size));
      page = Math.min(page, last);
      el.hidden = !list.length;
      el.innerHTML = `<span class="pager-count">전체 ${list.length}개</span>
        <div class="pager-pages">
          <button type="button" data-page="${page - 1}" aria-label="이전 쪽"${page === 1 ? ' disabled' : ''}>‹</button>
          ${pageNumbers(page, last).map(n => (n === '…' ? '<span>…</span>'
            : `<button type="button" data-page="${n}"${n === page ? ' class="on" aria-current="page"' : ''}>${n}</button>`)).join('')}
          <button type="button" data-page="${page + 1}" aria-label="다음 쪽"${page === last ? ' disabled' : ''}>›</button>
        </div>
        <select aria-label="한 쪽에 보일 개수">${SIZES.map(n => `<option value="${n}"${n === size ? ' selected' : ''}>${n}개씩</option>`).join('')}</select>`;
      return list.slice((page - 1) * size, page * size);
    },
  };
}
