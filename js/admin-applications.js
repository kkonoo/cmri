// 관리자: 신청·제출(연구비 지원·포상·업적) 보기, 승인·반려와 결과 메일, CSV 받기
import { storage } from './firebase.js';
import { esc, safeUrl } from './posts.js';
import { GROUPS, TYPES, summary, statusLabel, detailRows, won } from './apply-types.js';
import { SIGNATURE } from './admin-mail.js';

const p2 = n => String(n).padStart(2, '0');
const day = ts => (ts ? (d => `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`)(ts.toDate()) : '');
const STATE_CLASS = { submitted: 'wait', approved: 'ok', rejected: 'bad' };

// 결과 메일 문장 (묶음마다 말이 달라요)
const VERB = {
  funding: { approved: '승인되었습니다', rejected: '반려되었습니다' },
  award: { approved: '선정되었습니다', rejected: '선정되지 않았습니다' },
  achievement: { approved: '확인되었습니다', rejected: '반려되었습니다' },
};

function resultMessage(a, status, note) {
  const t = TYPES[a.type];
  const what = summary(a);
  const text = [
    `${a.name} 님께,`,
    '',
    `${day(a.createdAt)}에 ${t.group === 'achievement' ? '제출하신' : '신청하신'} ${t.ko}${what ? ` (${what})` : ''} 건이 ${VERB[t.group][status]}.`,
    note ? `\n${note}` : null,
    '',
    `신청·제출 내역: ${new URL('apply.html', location.href).href}`,
    '',
    '--',
    SIGNATURE,
  ].filter(x => x != null).join('\n');
  return { subject: `[세포·기질연구소] ${t.ko} ${t.group === 'achievement' ? '확인' : '결과'} 안내`, text: text.slice(0, 9900) };
}

// 엑셀에서 수식으로 읽히지 않게 앞에 '를 붙여요
function cell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function initApplications({ db, fs, email, toast }) {
  const $ = s => document.querySelector(s);
  const form = $('#appForm');
  let apps = [];
  let current = null;

  // 신청자가 올린 경로가 자기 폴더인지 확인해요
  const ownPath = (a, f) => typeof f?.path === 'string' && f.path.startsWith(`applications/${a.uid}/${a.id}/`);

  async function load() {
    try {
      const snap = await fs.getDocs(fs.collection(db, 'applications'));
      apps = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((x, y) => (y.createdAt?.toMillis() || 0) - (x.createdAt?.toMillis() || 0));
    } catch (err) {
      console.error(err);
      toast('신청·제출 목록을 불러오지 못했어요.');
    }
    render();
  }

  function filtered() {
    const g = $('#appGroupFilter').value;
    const s = $('#appStatusFilter').value;
    return apps.filter(a => (!g || TYPES[a.type]?.group === g) && (!s || a.status === s));
  }

  function render() {
    const gf = $('#appGroupFilter');
    const sf = $('#appStatusFilter');
    const g = gf.value;
    const s = sf.value;
    const inGroup = apps.filter(a => !g || TYPES[a.type]?.group === g);
    gf.innerHTML = `<option value="">전체 (${apps.length}건)</option>`
      + Object.entries(GROUPS).map(([k, v]) => `<option value="${k}"${k === g ? ' selected' : ''}>${v.ko} (${apps.filter(a => TYPES[a.type]?.group === k).length}건)</option>`).join('');
    sf.innerHTML = `<option value="">모든 상태</option>`
      + [['submitted', '접수'], ['approved', '승인·선정·확인'], ['rejected', '반려·미선정']]
        .map(([k, v]) => `<option value="${k}"${k === s ? ' selected' : ''}>${v} (${inGroup.filter(a => a.status === k).length}건)</option>`).join('');

    const waiting = apps.filter(a => a.status === 'submitted').length;
    $('#appCount').textContent = waiting;
    $('#appCount').hidden = !waiting;

    const shown = filtered();
    $('#appRows').innerHTML = shown.length
      ? shown.map(a => {
        const t = TYPES[a.type];
        return `<tr data-id="${esc(a.id)}" tabindex="0">
          <td class="c-date">${day(a.createdAt)}</td>
          <td class="c-cat">${esc(t?.ko || a.type)}<small class="sub">${esc(GROUPS[t?.group]?.ko || '')}</small></td>
          <td>${esc(a.name)}<small class="sub">${esc(a.dept)}</small></td>
          <td>${esc(summary(a))}${a.amount ? `<small class="sub">${won(a.amount)}</small>` : ''}</td>
          <td class="c-num"><span class="state ${STATE_CLASS[a.status] || ''}">${esc(statusLabel(a)[0])}</span></td>
        </tr>`;
      }).join('')
      : `<tr><td colspan="5" class="msg">${apps.length ? '고른 조건에 맞는 것이 없어요.' : '아직 들어온 신청·제출이 없어요.'}</td></tr>`;
  }

  async function open(a) {
    current = a;
    const t = TYPES[a.type];
    form.reset();
    $('#appDialogTitle').textContent = `${t?.ko || a.type} · ${a.name}`;
    const rows = [
      ['종류', `${GROUPS[t?.group]?.ko || ''} · ${t?.ko || a.type}`],
      ['신청일', day(a.createdAt)],
      ['상태', `${statusLabel(a)[0]}${a.decidedBy ? ` (${a.decidedBy}, ${day(a.decidedAt)})` : ''}`],
      ['이름', `${a.name}${a.position ? ` (${a.position})` : ''}`],
      ['소속', a.dept],
      ['연락처', a.phone],
      ['이메일', a.email],
      a.amount ? ['신청 금액', won(a.amount)] : null,
      ...detailRows(a),
      a.memo ? ['하고 싶은 말', a.memo] : null,
    ].filter(Boolean);
    $('#appInfo').innerHTML = rows.map(([k, v]) => {
      const url = safeUrl(String(v));
      return `<div><dt>${esc(k)}</dt><dd>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v)}</dd></div>`;
    }).join('');

    const files = a.files || [];
    $('#appFiles').innerHTML = files.length
      ? `<p class="hint">첨부 파일 ${files.length}개</p><ul>${files.map((f, i) =>
        `<li><a data-file="${i}" target="_blank" rel="noopener">${esc(f.name)}</a> <small>${Math.ceil((f.size || 0) / 1024).toLocaleString()}KB</small></li>`).join('')}</ul>`
      : '<p class="hint">첨부 파일 없음</p>';
    form.elements.note.value = a.note || '';
    $('#approveBtn').textContent = statusLabel(a, 'approved')[0];
    $('#rejectBtn').textContent = statusLabel(a, 'rejected')[0];
    $('#appDialog').showModal();

    // 파일은 볼 수 있는 주소를 받아서 걸어요
    if (files.length) {
      const { storage: s, st } = await storage();
      files.forEach((f, i) => {
        const link = $(`#appFiles [data-file="${i}"]`);
        if (!ownPath(a, f)) {
          link.insertAdjacentText('afterend', ' (경로가 맞지 않아 열 수 없어요)');
          return;
        }
        st.getDownloadURL(st.ref(s, f.path))
          .then(url => (link.href = url))
          .catch(err => {
            console.error(err);
            link.insertAdjacentText('afterend', ' (열 수 없어요)');
          });
      });
    }
  }

  $('#appGroupFilter').addEventListener('change', render);
  $('#appStatusFilter').addEventListener('change', render);
  $('#appRefreshBtn').addEventListener('click', load);
  $('#appRows').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) open(apps.find(a => a.id === tr.dataset.id));
  });
  $('#appRows').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('tr[data-id]')) open(apps.find(a => a.id === e.target.dataset.id));
  });

  form.addEventListener('submit', async e => {
    const status = e.submitter?.value;
    if (status !== 'approved' && status !== 'rejected') return;
    e.preventDefault();
    const a = current;
    const note = form.elements.note.value.trim();
    try {
      await fs.updateDoc(fs.doc(db, 'applications', a.id), { status, note, decidedAt: fs.serverTimestamp(), decidedBy: email });
      Object.assign(a, { status, note, decidedBy: email, decidedAt: fs.Timestamp.now() });
      if (form.elements.notify.checked) {
        await fs.addDoc(fs.collection(db, 'mail'), { to: a.email, message: resultMessage(a, status, note), applicationId: a.id, createdAt: fs.serverTimestamp() });
      }
      render();
      $('#appDialog').close();
      toast(`결과를 저장했어요 (${statusLabel(a)[0]}).${form.elements.notify.checked ? ' 신청자에게 메일을 보내요.' : ''}`);
    } catch (err) {
      console.error(err);
      toast('바꾸지 못했어요. 다시 시도해 주세요.');
    }
  });

  $('#deleteAppBtn').addEventListener('click', async () => {
    const a = current;
    if (!confirm(`${a.name}의 ${TYPES[a.type]?.ko || ''} 신청을 지울까요? 첨부 파일도 함께 지워져요.`)) return;
    try {
      const files = (a.files || []).filter(f => ownPath(a, f));
      if (files.length) {
        const { storage: s, st } = await storage();
        await Promise.all(files.map(f => st.deleteObject(st.ref(s, f.path)).catch(err => console.error(err))));
      }
      await fs.deleteDoc(fs.doc(db, 'applications', a.id));
      apps = apps.filter(x => x.id !== a.id);
      render();
      $('#appDialog').close();
      toast('지웠어요.');
    } catch (err) {
      console.error(err);
      toast('지우지 못했어요. 다시 시도해 주세요.');
    }
  });

  // 지금 고른 목록을 CSV로 (엑셀에서 바로 열려요)
  $('#appCsvBtn').addEventListener('click', () => {
    const list = filtered();
    if (!list.length) {
      toast('받을 것이 없어요.');
      return;
    }
    const present = new Set(list.map(a => a.type));
    const cols = [];
    for (const [k, t] of Object.entries(TYPES)) {
      if (!present.has(k)) continue;
      for (const f of t.fields) if (!cols.some(c => c[0] === f.key)) cols.push([f.key, f.short || f.ko]);
    }
    const head = ['신청일', '분류', '종류', '상태', '이름', '직위·과정', '소속', '연락처', '이메일', '신청 금액', ...cols.map(c => c[1]), '하고 싶은 말', '첨부 파일', '결과 안내'];
    const lines = [head.map(cell).join(',')].concat(list.map(a => {
      const t = TYPES[a.type];
      return [day(a.createdAt), GROUPS[t?.group]?.ko, t?.ko || a.type, statusLabel(a)[0], a.name, a.position, a.dept, a.phone, a.email,
        a.amount ?? '', ...cols.map(([k]) => a.details?.[k]), a.memo, (a.files || []).map(f => f.name).join(' / '), a.note].map(cell).join(',');
    }));
    const t = new Date();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    link.download = `신청·제출_${t.getFullYear()}${p2(t.getMonth() + 1)}${p2(t.getDate())}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  load();
}
