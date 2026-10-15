// 연구소 소개 → 연구진: 관리자가 넣은 연구진을 구분별로 보여 줘요. 소장이 맨 앞, 나머지는 가나다순.
// 아무도 없거나 불러오지 못하면 HTML에 있는 숫자와 안내가 그대로 보여요.
import { enabled, firestore } from './firebase.js';
import { bi, esc } from './posts.js';

export const ROLES = {
  faculty: { ko: '참여교수', en: 'Participating faculty' },
  visiting: { ko: '연구초빙교수', en: 'Visiting research professors' },
  postdoc: { ko: '박사후연구원', en: 'Postdoctoral researchers' },
  researcher: { ko: '연구원', en: 'Researchers' },
};

export const sortFaculty = list => list.sort((a, b) => (b.director === true) - (a.director === true) || a.nameKo.localeCompare(b.nameKo, 'ko'));
export const photoOk = s => /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s || '');

// 영문 칸이 비어 있으면 영어 화면에도 한국어로 보여요
const both = (ko, en) => bi(esc(ko), esc(en || ko));

export function facultyPhoto(p) {
  return photoOk(p.photo)
    ? `<span class="faculty-photo"><img src="${p.photo}" alt=""></span>`
    : `<span class="faculty-photo" aria-hidden="true">${both(p.nameKo[0], (p.nameEn || p.nameKo)[0])}</span>`;
}

function card(p) {
  return `<li class="faculty-card">
    ${facultyPhoto(p)}
    <div>
      ${p.director === true ? `<span class="tag alt">${bi('소장', 'Director')}</span> ` : ''}<strong>${both(p.nameKo, p.nameEn)}</strong>${p.positionKo ? ` <small>${both(p.positionKo, p.positionEn)}</small>` : ''}
      ${p.deptKo ? `<p>${both(p.deptKo, p.deptEn)}</p>` : ''}
      ${p.researchKo ? `<p class="research">${both(p.researchKo, p.researchEn)}</p>` : ''}
      ${p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''}
    </div>
  </li>`;
}

const list = document.getElementById('facultyList');
if (enabled && list) {
  firestore()
    .then(({ db, fs }) => fs.getDocs(fs.collection(db, 'faculty')))
    .then(snap => {
      const people = sortFaculty(snap.docs.map(d => d.data()));
      if (!people.length) return;
      list.innerHTML = Object.entries(ROLES).map(([role, label]) => {
        const group = people.filter(p => p.role === role);
        return group.length
          ? `<h3 class="block-title">${bi(label.ko, label.en)}</h3><ul class="faculty-grid">${group.map(card).join('')}</ul>`
          : '';
      }).join('');
      list.hidden = false;
      document.getElementById('facultyNote').hidden = true;
    })
    .catch(err => console.error(err));
}
