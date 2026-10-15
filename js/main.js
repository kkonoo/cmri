// 모든 페이지 공통: 화면 밝기·언어 바꾸기, 모바일 메뉴, 하위 메뉴 위치 표시
// 고른 값은 localStorage 'cmri-prefs'에 저장하고, 첫 화면 깜빡임은 <head>의 짧은 스크립트가 막아요.
const root = document.documentElement;
const isEn = () => root.dataset.lang === 'en';

function savePrefs(patch) {
  try {
    const prefs = JSON.parse(localStorage.getItem('cmri-prefs') || '{}');
    localStorage.setItem('cmri-prefs', JSON.stringify({ ...prefs, ...patch }));
  } catch { /* 저장이 안 돼도 화면은 바뀌어요 */ }
}

// 페이지 제목: <title data-en="...">한국어</title>. 게시판처럼 나중에 정하는 곳은 cmriSetTitle을 불러요.
const titleEl = document.querySelector('title');
let titles = { ko: document.title, en: titleEl?.dataset.en || document.title };
function applyTitle() { document.title = isEn() ? titles.en : titles.ko; }
window.cmriSetTitle = (ko, en) => { titles = { ko, en }; applyTitle(); };
applyTitle();

document.querySelector('.lang-btn')?.addEventListener('click', () => {
  const lang = isEn() ? 'ko' : 'en';
  root.dataset.lang = root.lang = lang;
  savePrefs({ lang });
  applyTitle();
  setMenuLabel();
});

document.querySelector('.theme-btn')?.addEventListener('click', () => {
  const dark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  savePrefs({ theme: root.dataset.theme });
});

// 지금 보고 있는 페이지의 메뉴 표시
const page = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.gnb > ul > li > a').forEach(a => {
  if (a.getAttribute('href').split(/[?#]/)[0] === page && page !== 'index.html') a.setAttribute('aria-current', 'page');
});

// 모바일 메뉴 열고 닫기
const menuBtn = document.querySelector('.menu-btn');
const gnb = document.getElementById('gnb');
function setMenuLabel() {
  if (!menuBtn) return;
  const open = gnb.classList.contains('open');
  menuBtn.setAttribute('aria-label', isEn() ? (open ? 'Close menu' : 'Open menu') : (open ? '메뉴 닫기' : '메뉴 열기'));
}
function setMenu(open) {
  gnb.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', open);
  setMenuLabel();
}
if (menuBtn && gnb) {
  setMenuLabel();
  menuBtn.addEventListener('click', () => setMenu(!gnb.classList.contains('open')));
  gnb.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
}

// 하위 페이지 안 메뉴: 지금 읽는 부분을 표시해요
const subnav = document.querySelector('.subnav');
if (subnav && 'IntersectionObserver' in window) {
  const links = [...subnav.querySelectorAll('a[href^="#"]')];
  const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const scroller = subnav.querySelector('.wrap');
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const link = byId.get(entry.target.id);
      links.forEach(a => a.classList.toggle('on', a === link));
      if (link) scroller.scrollTo({ left: link.offsetLeft - 16, behavior: 'smooth' });
    }
  }, { rootMargin: '-140px 0px -55% 0px' });
  byId.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
}
