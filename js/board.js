// 게시판 목록(board.html)과 글 보기(post.html)
import {
  enabled, BOARDS, boardType, listPosts, countPosts, pinnedPosts, getPost, MSG, bi, pageNumbers,
  postItem, seminarItem, letterCard, esc, dotDate, weekdayBi, renderBody, safeUrl, IMAGE, isImage,
} from './posts.js';

const SIZES = [10, 25, 50, 100];
const SIZE_KEY = 'cmri-board-page-size';
const params = new URLSearchParams(location.search);
const type = boardType(params.get('type'));
const label = BOARDS[type];
const main = document.getElementById('content');
const setTitle = (ko, en) => window.cmriSetTitle?.(`${ko} | 세포·기질연구소`, `${en} | Cell & Matrix Research Institute`);
const msg = html => `<p class="msg">${html}</p>`;
// 목록의 몇째 쪽에서 왔으면 그 쪽으로 돌아가요
const from = document.referrer ? new URL(document.referrer) : null;
const listHref = from?.origin === location.origin && from.pathname.endsWith('/board.html') && from.searchParams.get('type') === type
  ? from.href : `board.html?type=${type}`;
const backBtn = `<a class="back-btn" href="${esc(listHref)}">${bi('목록으로', 'Back to list')}</a>`;

document.getElementById('pageTitle').innerHTML = bi(label.ko, label.en);
document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.type === type));
setTitle(label.ko, label.en);

const fail = err => {
  console.error(err);
  main.innerHTML = msg(MSG.failed);
};

if (!enabled) {
  main.innerHTML = msg(bi('게시판은 Firebase를 연결하면 보여요.', 'The board will appear once it is connected.'));
} else if (document.body.dataset.page === 'board') {
  showBoard().catch(fail);
} else {
  showPost().catch(fail);
}

// 한 쪽에 몇 개: 주소의 &size=, 없으면 이 브라우저에 고른 것, 그것도 없으면 25개
function pageSize() {
  const asked = Number(params.get('size'));
  if (SIZES.includes(asked)) return asked;
  try {
    const saved = Number(localStorage.getItem(SIZE_KEY));
    if (SIZES.includes(saved)) return saved;
  } catch { /* 기본 25개 */ }
  return 25;
}

// 고정 글은 쪽마다 맨 위에 따로 보여 주고, 쪽 번호 목록에서는 빼요.
// 전체 글 수만 세고, 보려는 쪽까지만 불러와요 (주소의 &page=)
async function showBoard() {
  const PAGE = pageSize();
  const seminar = type === 'seminars';
  const letters = type === 'newsletters';
  const render = (p, i) => (seminar ? seminarItem(p, true) : letters ? letterCard(p, i) : postItem(type, p));
  const [pinned, total] = await Promise.all([letters ? [] : pinnedPosts(type), countPosts(type)]);
  if (!total) {
    main.innerHTML = msg(MSG.empty);
    return;
  }
  const pinnedIds = new Set(pinned.map(p => p.id));
  const lastPage = Math.max(1, Math.ceil((total - pinned.length) / PAGE));
  const page = Math.min(lastPage, Math.max(1, parseInt(params.get('page'), 10) || 1));
  const kept = [];
  for (let after; kept.length < page * PAGE;) {
    const n = page * PAGE - kept.length + pinnedIds.size;
    const { posts, last } = await listPosts(type, n, after);
    kept.push(...posts.filter(p => !pinnedIds.has(p.id)));
    if (posts.length < n) break;
    after = last;
  }
  const shown = kept.slice((page - 1) * PAGE, page * PAGE);

  const listTag = letters ? 'div' : 'ul';
  const listClass = seminar ? 'seminar-list' : letters ? 'letter-grid' : 'post-list';
  const href = n => `board.html?type=${type}&page=${n}&size=${PAGE}`;
  const step = (n, label, aria) => (n >= 1 && n <= lastPage
    ? `<a href="${href(n)}" aria-label="${aria}">${label}</a>` : `<span class="off" aria-hidden="true">${label}</span>`);
  main.innerHTML = `<${listTag} class="${listClass}">
      ${pinned.map(p => (seminar ? render(p) : postItem(type, p, true))).join('')}
      ${shown.map((p, i) => render(p, (page - 1) * PAGE + i)).join('')}
    </${listTag}>
    <div class="page-bar">
      <span class="page-count">${bi(`전체 ${total}개`, `${total} posts`)}</span>
      ${lastPage > 1 ? `<nav class="page-nav" aria-label="쪽 Pages">
        ${step(page - 1, '‹', '이전 쪽 Previous page')}
        ${pageNumbers(page, lastPage).map(n => (n === '…' ? '<span class="gap">…</span>'
          : n === page ? `<span class="on" aria-current="page">${n}</span>` : `<a href="${href(n)}">${n}</a>`)).join('')}
        ${step(page + 1, '›', '다음 쪽 Next page')}
      </nav>` : ''}
      <label class="page-size">${bi('한 쪽에', 'Per page')}
        <select>${SIZES.map(n => `<option value="${n}"${n === PAGE ? ' selected' : ''}>${n}</option>`).join('')}</select>
      </label>
    </div>`;
  main.querySelector('.page-size select').addEventListener('change', e => {
    try { localStorage.setItem(SIZE_KEY, e.target.value); } catch { /* 주소의 size로 이어가요 */ }
    location.href = `board.html?type=${type}&size=${e.target.value}`;
  });
}

async function showPost() {
  const id = params.get('id');
  const p = id && await getPost(type, id);
  if (!p) {
    main.innerHTML = msg(bi('글을 찾을 수 없어요.', 'Post not found.')) + backBtn;
    return;
  }
  setTitle(p.title, p.title);
  const meta = type === 'seminars'
    ? [[bi('일시', 'When'), `${dotDate(p.date)} (${weekdayBi(p.date)}) ${esc(p.time || '')}`.trim()],
       [bi('연사', 'Speaker'), esc([p.speaker, p.affiliation].filter(Boolean).join(' · '))],
       [bi('장소', 'Venue'), esc(p.place || '')]]
    : [[bi('작성일', 'Date'), dotDate(p.date)]];
  const links = (p.links || []).filter(l => safeUrl(l.url));
  // 사진 첨부는 본문 위에 그림으로 보여 줘요 (옛 홈페이지 소식 사진, 세미나 포스터 등)
  const photos = links.filter(isImage);
  const files = links.filter(l => !isImage(l));
  main.innerHTML = `<article class="article">
    <p class="article-cat"><a href="board.html?type=${type}">${bi(label.ko, label.en)}</a>${p.category ? `<span class="tag" data-cat="${esc(p.category)}">${esc(p.category)}</span>` : ''}</p>
    <h1>${esc(p.title)}</h1>
    <dl class="article-meta">${meta.filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${photos.length ? `<div class="article-photos">${photos.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener"><img src="${esc(l.url)}" alt="${esc((l.label || '').replace(IMAGE, ''))}" loading="lazy"></a>`).join('')}</div>` : ''}
    <div class="article-body">${renderBody(p.body)}</div>
    ${files.length ? `<ul class="attach">${files.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a></li>`).join('')}</ul>` : ''}
    ${backBtn}
  </article>`;
}
