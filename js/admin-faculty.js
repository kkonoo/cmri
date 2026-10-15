// 관리자: 연구진 (홈페이지 연구소 소개 → 연구진에 나와요)
import { esc } from './posts.js';
import { ROLES, sortFaculty, facultyPhoto } from './faculty.js';

const FIELDS = ['nameKo', 'nameEn', 'role', 'positionKo', 'positionEn', 'deptKo', 'deptEn', 'researchKo', 'researchEn', 'email'];
const isEmail = s => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(s);

// 사진은 세로 3:4로 잘라 150×200 JPEG로 줄여 Firestore 문서에 그대로 넣어요 (한 장 10~20KB)
async function shrinkPhoto(file) {
  const img = await createImageBitmap(file);
  const W = 150, H = 200;
  const scale = Math.max(W / img.width, H / img.height);
  const w = img.width * scale, h = img.height * scale;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  // 가로는 가운데, 세로는 얼굴이 있는 위쪽을 더 남겨요
  g.drawImage(img, (W - w) / 2, (H - h) * 0.25, w, h);
  return c.toDataURL('image/jpeg', 0.85);
}

// 엑셀 '구분' 칸을 넷 중 하나로
function roleOf(s) {
  if (/초빙|visiting/i.test(s)) return 'visiting';
  if (/박사후|포닥|postdoc/i.test(s)) return 'postdoc';
  if (/연구원|researcher/i.test(s)) return 'researcher';
  return 'faculty';
}

export function initFaculty({ db, fs, email, toast }) {
  const $ = s => document.querySelector(s);
  const form = $('#facultyForm');
  let people = [];   // { id, nameKo, ... }
  let editing = null;
  let photo = '';

  async function load() {
    try {
      const snap = await fs.getDocs(fs.collection(db, 'faculty'));
      people = sortFaculty(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      toast('연구진을 불러오지 못했어요.');
    }
    render();
  }

  function render() {
    const filter = $('#facultyFilter');
    const r = filter.value;
    const q = $('#facultySearch').value.trim().toLowerCase();
    filter.innerHTML = `<option value="">전체 (${people.length}명)</option>`
      + Object.entries(ROLES).map(([k, v]) => `<option value="${k}"${k === r ? ' selected' : ''}>${v.ko} (${people.filter(p => p.role === k).length}명)</option>`).join('');
    const shown = people.filter(p => (!r || p.role === r)
      && (!q || [p.nameKo, p.nameEn, p.deptKo].some(s => (s || '').toLowerCase().includes(q))));
    $('#facultyRows').innerHTML = shown.length
      ? shown.map(p => `<tr data-id="${esc(p.id)}" tabindex="0">
          <td class="c-photo">${facultyPhoto(p)}</td>
          <td>${esc(p.nameKo)}${p.director === true ? ' <span class="chip">소장</span>' : ''}<small class="sub">${esc(p.nameEn || '')}</small></td>
          <td>${ROLES[p.role]?.ko || ''}</td>
          <td>${esc([p.deptKo, p.positionKo].filter(Boolean).join(' '))}</td>
        </tr>`).join('')
      : `<tr><td colspan="4" class="msg">${people.length ? '찾는 사람이 없어요.' : '아직 연구진이 없어요. 엑셀에서 붙여 넣거나 한 명씩 추가해 보세요.'}</td></tr>`;
  }

  function showPhoto() {
    $('#facultyPhoto').innerHTML = facultyPhoto({ nameKo: form.elements.nameKo.value || '?', photo });
    $('#facultyPhotoRemove').hidden = !photo;
  }

  function open(p) {
    editing = p || null;
    form.reset();
    const f = form.elements;
    for (const k of FIELDS) f[k].value = p?.[k] || '';
    f.role.value = p?.role || 'faculty';
    f.director.checked = p?.director === true;
    photo = p?.photo || '';
    showPhoto();
    $('#facultyDialogTitle').textContent = p ? '연구진 고치기' : '연구진 추가';
    $('#deleteFacultyBtn').hidden = !p;
    $('#facultyDialog').showModal();
  }

  $('#facultyFilter').addEventListener('change', render);
  $('#facultySearch').addEventListener('input', render);
  $('#addFacultyBtn').addEventListener('click', () => open());
  $('#facultyRows').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) open(people.find(p => p.id === tr.dataset.id));
  });
  $('#facultyRows').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('tr[data-id]')) open(people.find(p => p.id === e.target.dataset.id));
  });

  $('#facultyPhotoInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      photo = await shrinkPhoto(file);
      showPhoto();
    } catch (err) {
      console.error(err);
      toast('이 사진은 열 수 없어요. JPG나 PNG로 올려 주세요.');
    }
  });
  $('#facultyPhotoRemove').addEventListener('click', () => {
    photo = '';
    showPhoto();
  });

  form.addEventListener('submit', async e => {
    if (e.submitter?.value !== 'save') return;
    e.preventDefault();
    const f = form.elements;
    const data = Object.fromEntries(FIELDS.map(k => [k, f[k].value.trim()]));
    data.email = data.email.toLowerCase();
    data.director = f.director.checked;
    if (data.email && !isEmail(data.email)) {
      toast('이메일 주소를 확인해 주세요.');
      return;
    }
    const ref = editing ? fs.doc(db, 'faculty', editing.id) : fs.doc(fs.collection(db, 'faculty'));
    try {
      await fs.setDoc(ref, { ...data, photo, updatedAt: fs.serverTimestamp(), updatedBy: email });
      people = sortFaculty([...people.filter(p => p.id !== ref.id), { id: ref.id, ...data, photo }]);
      render();
      $('#facultyDialog').close();
      toast('저장했어요.');
    } catch (err) {
      console.error(err);
      toast('저장하지 못했어요. 다시 시도해 주세요.');
    }
  });

  $('#deleteFacultyBtn').addEventListener('click', async () => {
    if (!confirm(`${editing.nameKo}을(를) 연구진에서 지울까요?`)) return;
    try {
      await fs.deleteDoc(fs.doc(db, 'faculty', editing.id));
      people = people.filter(p => p.id !== editing.id);
      render();
      $('#facultyDialog').close();
      toast('지웠어요.');
    } catch (err) {
      console.error(err);
      toast('지우지 못했어요. 다시 시도해 주세요.');
    }
  });

  // ---------- 엑셀에서 붙여 넣기 ----------
  // 한 줄에 이름 · 영문 이름 · 구분 · 직위 · 소속 · 이메일. 빈 칸은 원래 값을 그대로 둬요.
  const importForm = $('#facultyImportForm');

  function parseRows() {
    const rows = new Map();   // 같은 사람이 두 번 있으면 아래 줄로
    for (const line of importForm.elements.rows.value.split(/\r?\n/)) {
      const c = (line.includes('\t') ? line.split('\t') : line.split(',')).map(x => x.trim());
      if (!c[0] || c[0] === '이름') continue;
      const row = { nameKo: c[0], nameEn: c[1], role: roleOf(c[2] || ''), positionKo: c[3], deptKo: c[4], email: (c[5] || '').toLowerCase() };
      if (!isEmail(row.email)) row.email = '';
      rows.set(`${row.nameKo}|${row.role}`, Object.fromEntries(Object.entries(row).filter(([, v]) => v)));
    }
    return [...rows.values()];
  }

  function preview() {
    const rows = parseRows();
    const added = rows.filter(r => !people.some(p => p.nameKo === r.nameKo && p.role === r.role)).length;
    $('#facultyImportPreview').textContent = rows.length
      ? `${rows.length}명 · 새로 추가 ${added}명, 고침 ${rows.length - added}명`
      : '붙여 넣으면 몇 명인지 알려 드려요.';
  }

  $('#facultyImportBtn').addEventListener('click', () => {
    importForm.reset();
    preview();
    $('#facultyImportDialog').showModal();
  });
  importForm.addEventListener('input', preview);
  importForm.addEventListener('submit', async e => {
    if (e.submitter?.value !== 'save') return;
    e.preventDefault();
    const rows = parseRows();
    if (!rows.length) {
      toast('가져올 사람이 없어요.');
      return;
    }
    try {
      for (let i = 0; i < rows.length; i += 400) {
        const batch = fs.writeBatch(db);
        for (const r of rows.slice(i, i + 400)) {
          // 이름과 구분이 같은 사람이 있으면 그 사람을 고쳐요 (사진은 그대로)
          const old = people.find(p => p.nameKo === r.nameKo && p.role === r.role);
          const ref = old ? fs.doc(db, 'faculty', old.id) : fs.doc(fs.collection(db, 'faculty'));
          batch.set(ref, { ...r, updatedAt: fs.serverTimestamp(), updatedBy: email }, { merge: true });
        }
        await batch.commit();
      }
      $('#facultyImportDialog').close();
      toast(`${rows.length}명을 가져왔어요.`);
      load();
    } catch (err) {
      console.error(err);
      toast('가져오지 못했어요. 다시 시도해 주세요.');
    }
  });

  load();
}
