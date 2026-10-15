// 게시판 목록(board.html)과 글 보기(post.html)
import {
  enabled, BOARDS, boardType, listPosts, pinnedPosts, getPost,
  postItem, seminarItem, esc, dotDate, weekday, renderBody, safeUrl,
} from './posts.js';

const PAGE = 20;
const params = new URLSearchParams(location.search);
const type = boardType(params.get('type'));
const label = BOARDS[type];
const main = document.getElementById('content');

document.getElementById('pageTitle').textContent = label;
document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.type === type));
document.title = `${label} | 세포·기질연구소`;

const fail = err => {
  console.error(err);
  main.innerHTML = '<p class="msg">글을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>';
};

if (!enabled) {
  main.innerHTML = '<p class="msg">게시판은 Firebase를 연결하면 보여요.</p>';
} else if (document.body.dataset.page === 'board') {
  showBoard().catch(fail);
} else {
  showPost().catch(fail);
}

async function showBoard() {
  const seminar = type === 'seminars';
  const render = p => (seminar ? seminarItem(p, true) : postItem(type, p));
  const [pinned, first] = await Promise.all([pinnedPosts(type), listPosts(type, PAGE)]);
  if (!pinned.length && !first.posts.length) {
    main.innerHTML = '<p class="msg">아직 올라온 글이 없어요.</p>';
    return;
  }
  main.innerHTML = `<ul class="${seminar ? 'seminar-list' : 'post-list'}"></ul>
    <button class="more-btn" type="button" hidden>더 보기</button>`;
  const list = main.querySelector('ul');
  const more = main.querySelector('.more-btn');
  const pinnedIds = new Set(pinned.map(p => p.id));
  const add = posts => list.insertAdjacentHTML('beforeend',
    posts.filter(p => !pinnedIds.has(p.id)).map(render).join(''));

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
      more.textContent = '더 보기';
    } catch (err) {
      console.error(err);
      more.textContent = '다시 시도';
    }
    more.disabled = false;
  });
}

async function showPost() {
  const id = params.get('id');
  const p = id && await getPost(type, id);
  if (!p) {
    main.innerHTML = `<p class="msg">글을 찾을 수 없어요.</p><a class="back-btn" href="board.html?type=${type}">목록으로</a>`;
    return;
  }
  document.title = `${p.title} | 세포·기질연구소`;
  const meta = type === 'seminars'
    ? [['일시', `${dotDate(p.date)} (${weekday(p.date)}) ${p.time || ''}`.trim()],
       ['연사', [p.speaker, p.affiliation].filter(Boolean).join(' · ')],
       ['장소', p.place]]
    : [['작성일', dotDate(p.date)]];
  const links = (p.links || []).filter(l => safeUrl(l.url));
  main.innerHTML = `<article class="article">
    <p class="article-cat"><a href="board.html?type=${type}">${label}</a>${p.category ? `<span class="tag">${esc(p.category)}</span>` : ''}</p>
    <h1>${esc(p.title)}</h1>
    <dl class="article-meta">${meta.filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <div class="article-body">${renderBody(p.body)}</div>
    ${links.length ? `<ul class="attach">${links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a></li>`).join('')}</ul>` : ''}
    <a class="back-btn" href="board.html?type=${type}">목록으로</a>
  </article>`;
}
