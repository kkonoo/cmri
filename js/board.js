// 게시판 목록(board.html)과 글 보기(post.html)
import {
  enabled, BOARDS, boardType, listPosts, pinnedPosts, getPost, MSG, bi,
  postItem, seminarItem, letterCard, esc, dotDate, weekdayBi, renderBody, safeUrl,
} from './posts.js';

const PAGE = 20;
const IMAGE = /\.(jpe?g|png|gif|webp)$/i;
const params = new URLSearchParams(location.search);
const type = boardType(params.get('type'));
const label = BOARDS[type];
const main = document.getElementById('content');
const setTitle = (ko, en) => window.cmriSetTitle?.(`${ko} | 세포·기질연구소`, `${en} | Cell & Matrix Research Institute`);
const msg = html => `<p class="msg">${html}</p>`;
const backBtn = `<a class="back-btn" href="board.html?type=${type}">${bi('목록으로', 'Back to list')}</a>`;

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

async function showBoard() {
  const seminar = type === 'seminars';
  const letters = type === 'newsletters';
  const render = (p, i) => (seminar ? seminarItem(p, true) : letters ? letterCard(p, i) : postItem(type, p));
  const [pinned, first] = await Promise.all([letters ? [] : pinnedPosts(type), listPosts(type, PAGE)]);
  if (!pinned.length && !first.posts.length) {
    main.innerHTML = msg(MSG.empty);
    return;
  }
  const listTag = letters ? 'div' : 'ul';
  const listClass = seminar ? 'seminar-list' : letters ? 'letter-grid' : 'post-list';
  main.innerHTML = `<${listTag} class="${listClass}"></${listTag}>
    <button class="more-btn" type="button" hidden>${bi('더 보기', 'Load more')}</button>`;
  const list = main.querySelector(`.${listClass}`);
  const more = main.querySelector('.more-btn');
  const pinnedIds = new Set(pinned.map(p => p.id));
  let count = 0;
  const add = posts => list.insertAdjacentHTML('beforeend',
    posts.filter(p => !pinnedIds.has(p.id)).map(p => render(p, count++)).join(''));

  list.innerHTML = pinned.map(p => (seminar ? render(p) : postItem(type, p, true))).join('');
  add(first.posts);
  let last = first.last;
  more.hidden = first.posts.length < PAGE;
  more.addEventListener('click', async () => {
    more.disabled = true;
    try {
      const next = await listPosts(type, PAGE, last);
      add(next.posts);
      last = next.last;
      more.hidden = next.posts.length < PAGE;
      more.innerHTML = bi('더 보기', 'Load more');
    } catch (err) {
      console.error(err);
      more.innerHTML = bi('다시 시도', 'Try again');
    }
    more.disabled = false;
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
  const isImage = l => IMAGE.test(l.label || '') || IMAGE.test(new URL(l.url).pathname);
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
