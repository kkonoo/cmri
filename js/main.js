// 모바일 메뉴 열고 닫기
const menuBtn = document.querySelector('.menu-btn');
const gnb = document.getElementById('gnb');

function setMenu(open) {
  gnb.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', open);
  menuBtn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
}

menuBtn.addEventListener('click', () => setMenu(!gnb.classList.contains('open')));
gnb.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
