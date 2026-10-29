// 관리자: 게시글 쓰기·고치기·삭제
import { BOARDS, esc, dotDate, weekday, today } from './posts.js';
import { createPager } from './admin-pager.js';

// '규정'은 연구소 소개 → 운영 규정, '모집'은 프로그램 → 모집 공고에도 보여요
const CATEGORIES = {
  notices: ['공지', '모집', '채용', '행사', '수상', '기업지원', '규정'],
  seminars: [],
  news: ['언론 보도', '동정', '수상'],
  newsletters: [],
};
const MAX_LINKS = 10;   // firestore.rules와 같게

export function initPosts(ctx) {
  const { db, fs, email, toast } = ctx;
  const $ = s => document.querySelector(s);
  const rows = $('#postRows');
  const dialog = $('#postDialog');
  const form = $('#postForm');
  const f = form.elements;
  const linkRows = $('#linkRows');
  const pager = createPager($('#postPager'), rows.closest('table'), render);
  let board = 'notices';
  let posts = [];
  let editing = null;

  // 게시판의 글을 모두 불러와서 쪽으로 나눠 보여 줘요. 고치고 나서는 보던 쪽에 머물러요
  async function load(keepPage = false) {
    rows.closest('table').querySelector('.c-cat').textContent = board === 'seminars' ? '연사' : '분류';
    rows.innerHTML = '<tr><td colspan="3" class="msg">불러오는 중…</td></tr>';
    $('#postPager').hidden = true;
    if (!keepPage) pager.reset();
    try {
      const snap = await fs.getDocs(fs.query(fs.collection(db, board), fs.orderBy('date', 'desc')));
      posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    } catch (err) {
      console.error(err);
      rows.innerHTML = '<tr><td colspan="3" class="msg">글을 불러오지 못했어요.</td></tr>';
    }
  }

  function render() {
    const shown = pager.slice(posts);
    rows.innerHTML = posts.length
      ? shown.map(p => `<tr data-id="${p.id}" tabindex="0">
          <td class="c-date">${dotDate(p.date)}</td>
          <td class="c-cat">${esc(board === 'seminars' ? p.speaker : p.category)}</td>
          <td>${p.pinned ? '<span class="tag pin">고정</span> ' : ''}${esc(p.title)}</td>
        </tr>`).join('')
      : '<tr><td colspan="3" class="msg">아직 글이 없어요. 새 글 쓰기로 시작해 보세요.</td></tr>';
  }

  function addLink(l = {}) {
    if (linkRows.children.length >= MAX_LINKS) return;
    linkRows.insertAdjacentHTML('beforeend', `<div class="link-row">
      <input data-k="label" placeholder="이름 (예: 포스터)" maxlength="100" value="${esc(l.label)}" aria-label="링크 이름">
      <input data-k="url" type="url" placeholder="https://" value="${esc(l.url)}" aria-label="링크 주소">
      <button class="icon-x" type="button" aria-label="링크 빼기">✕</button>
    </div>`);
  }

  function open(post) {
    editing = post?.id || null;
    form.reset();
    $('#postDialogTitle').textContent = `${BOARDS[board].ko} · ${post ? '글 고치기' : '새 글'}`;
    dialog.querySelectorAll('[data-only]').forEach(el => (el.hidden = !el.dataset.only.split(' ').includes(board)));
    dialog.querySelectorAll('[data-not]').forEach(el => (el.hidden = el.dataset.not.split(' ').includes(board)));
    $('#categoryList').innerHTML = CATEGORIES[board].map(c => `<option value="${c}">`).join('');
    const p = post || { date: today() };
    for (const k of ['title', 'category', 'date', 'body', 'time', 'speaker', 'affiliation', 'place']) f[k].value = p[k] || '';
    f.pinned.checked = !!p.pinned;
    linkRows.innerHTML = '';
    (p.links || []).forEach(addLink);
    $('#deletePostBtn').hidden = !post;
    $('#mailPostBtn').hidden = !post;
    dialog.showModal();
  }

  $('#boardSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-board]');
    if (!b) return;
    board = b.dataset.board;
    $('#boardSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    load();
  });
  $('#newPostBtn').addEventListener('click', () => open());
  rows.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) open(posts.find(p => p.id === tr.dataset.id));
  });
  rows.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('tr[data-id]')) open(posts.find(p => p.id === e.target.dataset.id));
  });
  $('#addLinkBtn').addEventListener('click', () => addLink());
  linkRows.addEventListener('click', e => {
    if (e.target.closest('.icon-x')) e.target.closest('.link-row').remove();
  });

  form.addEventListener('submit', async e => {
    if (e.submitter?.value !== 'save') return;   // 취소는 그냥 닫혀요
    e.preventDefault();
    const links = [...linkRows.querySelectorAll('.link-row')]
      .map(r => ({ label: r.querySelector('[data-k=label]').value.trim(), url: r.querySelector('[data-k=url]').value.trim() }))
      .filter(l => l.url);
    if (links.some(l => !/^https?:\/\//i.test(l.url))) {
      toast('링크 주소는 https://로 시작해야 해요.');
      return;
    }
    const data = {
      title: f.title.value.trim(),
      category: CATEGORIES[board].length ? f.category.value.trim() : '',
      date: f.date.value,
      body: f.body.value.trim(),
      links,
      pinned: board === 'notices' && f.pinned.checked,
      updatedAt: fs.serverTimestamp(),
      updatedBy: email,
    };
    if (board === 'seminars') {
      for (const k of ['time', 'speaker', 'affiliation', 'place']) data[k] = f[k].value.trim();
    }
    try {
      if (editing) await fs.setDoc(fs.doc(db, board, editing), data);
      else await fs.addDoc(fs.collection(db, board), data);
      dialog.close();
      toast('저장했어요. 홈페이지에 바로 보여요.');
      load(true);
    } catch (err) {
      console.error(err);
      toast('저장하지 못했어요. 다시 시도해 주세요.');
    }
  });

  $('#deletePostBtn').addEventListener('click', async () => {
    if (!confirm('이 글을 삭제할까요? 되돌릴 수 없어요.')) return;
    try {
      await fs.deleteDoc(fs.doc(db, board, editing));
      dialog.close();
      toast('삭제했어요.');
      load(true);
    } catch (err) {
      console.error(err);
      toast('삭제하지 못했어요. 다시 시도해 주세요.');
    }
  });

  // 저장된 내용으로 메일 쓰기 화면을 채워요
  $('#mailPostBtn').addEventListener('click', () => {
    const p = posts.find(x => x.id === editing);
    const url = new URL(`post.html?type=${board}&id=${encodeURIComponent(p.id)}`, location.href).href;
    let subject = p.title;
    let text = p.body;
    if (board === 'seminars') {
      subject = `[세미나] ${p.title}${p.speaker ? ` - ${p.speaker}` : ''}`;
      const info = [
        `일시: ${dotDate(p.date)} (${weekday(p.date)}) ${p.time || ''}`.trim(),
        p.place && `장소: ${p.place}`,
        p.speaker && `연사: ${[p.speaker, p.affiliation].filter(Boolean).join(', ')}`,
      ].filter(Boolean).join('\n');
      text = [info, p.body].filter(Boolean).join('\n\n');
    } else if (p.category) {
      subject = `[${p.category}] ${p.title}`;
    }
    dialog.close();
    ctx.composeMail(subject, `${text}\n\n자세히 보기: ${url}`.trim());
  });

  load();
}
