// 관리자: 받는 사람 명단, 메일 보내기, 보낸 기록
// 메일은 mail 컬렉션에 쓰면 Firebase 'Trigger Email' 확장 프로그램이 cmri@knu.ac.kr로 보내요.
import { esc, renderBody } from './posts.js';

const FROM = 'cmri@knu.ac.kr';
const BCC_SIZE = 50;   // 한 통에 숨은참조 50명씩 (firestore.rules와 같게)
const SIGNATURE = '경북대학교 의과대학 세포·기질연구소\ncmri@knu.ac.kr · 053-420-4868';

const isEmail = s => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(s);
const splitGroups = s => [...new Set(String(s || '').split(/[,;/]/).map(g => g.trim()).filter(Boolean))];
const byKo = (a, b) => a.localeCompare(b, 'ko');

function mailHtml(text) {
  return `<div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:15px;line-height:1.7;color:#222">
    ${renderBody(text)}
    <hr style="border:0;border-top:1px solid #ddd;margin:24px 0 12px">
    <p style="font-size:13px;color:#777">${esc(SIGNATURE).replace('\n', '<br>')}</p>
  </div>`;
}

function when(ts) {
  if (!ts) return '방금';
  const d = ts.toDate();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function initMail(ctx) {
  const { db, fs, email, toast, openTab } = ctx;
  const $ = s => document.querySelector(s);
  const mailForm = $('#mailForm');
  let people = [];   // { email, name, groups }

  const groupsOf = () => [...new Set(people.flatMap(p => p.groups || []))].sort(byKo);
  const countOf = g => people.filter(p => p.groups?.includes(g)).length;

  async function loadPeople() {
    try {
      const snap = await fs.getDocs(fs.collection(db, 'recipients'));
      people = snap.docs.map(d => d.data()).sort((a, b) => byKo(a.name || a.email, b.name || b.email));
    } catch (err) {
      console.error(err);
      toast('명단을 불러오지 못했어요.');
    }
    renderPeople();
    renderGroupChecks();
  }

  function upsertLocal(list) {
    for (const p of list) {
      const i = people.findIndex(x => x.email === p.email);
      if (i >= 0) people[i] = p;
      else people.push(p);
    }
    people.sort((a, b) => byKo(a.name || a.email, b.name || b.email));
    renderPeople();
    renderGroupChecks();
  }

  // ---------- 받는 사람 탭 ----------
  function renderPeople() {
    const filter = $('#groupFilter');
    const g = filter.value;
    const q = $('#peopleSearch').value.trim().toLowerCase();
    filter.innerHTML = `<option value="">전체 (${people.length}명)</option>`
      + groupsOf().map(x => `<option value="${esc(x)}"${x === g ? ' selected' : ''}>${esc(x)} (${countOf(x)}명)</option>`).join('');
    const shown = people.filter(p => (!filter.value || p.groups?.includes(filter.value))
      && (!q || (p.name || '').toLowerCase().includes(q) || p.email.includes(q)));
    $('#peopleRows').innerHTML = shown.length
      ? shown.map(p => `<tr data-email="${esc(p.email)}" tabindex="0">
          <td>${esc(p.name || '-')}</td><td>${esc(p.email)}</td>
          <td>${(p.groups || []).map(x => `<span class="chip">${esc(x)}</span>`).join(' ')}</td>
        </tr>`).join('')
      : `<tr><td colspan="3" class="msg">${people.length ? '찾는 사람이 없어요.' : '아직 명단이 없어요. 엑셀에서 붙여 넣어 시작해 보세요.'}</td></tr>`;
  }

  let editingEmail = null;
  const personForm = $('#personForm');
  function openPerson(p) {
    editingEmail = p?.email || null;
    personForm.reset();
    const f = personForm.elements;
    f.name.value = p?.name || '';
    f.email.value = p?.email || '';
    f.email.readOnly = !!p;
    f.groups.value = (p?.groups || []).join(', ');
    $('#personDialogTitle').textContent = p ? '받는 사람 고치기' : '받는 사람 추가';
    $('#deletePersonBtn').hidden = !p;
    $('#personDialog').showModal();
  }

  $('#groupFilter').addEventListener('change', renderPeople);
  $('#peopleSearch').addEventListener('input', renderPeople);
  $('#addPersonBtn').addEventListener('click', () => openPerson());
  $('#peopleRows').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-email]');
    if (tr) openPerson(people.find(p => p.email === tr.dataset.email));
  });
  $('#peopleRows').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('tr[data-email]')) openPerson(people.find(p => p.email === e.target.dataset.email));
  });

  personForm.addEventListener('submit', async e => {
    if (e.submitter?.value !== 'save') return;
    e.preventDefault();
    const f = personForm.elements;
    const addr = f.email.value.trim().toLowerCase();
    if (!isEmail(addr)) {
      toast('이메일 주소를 확인해 주세요.');
      return;
    }
    const p = { email: addr, name: f.name.value.trim(), groups: splitGroups(f.groups.value) };
    try {
      await fs.setDoc(fs.doc(db, 'recipients', addr), { ...p, updatedAt: fs.serverTimestamp() });
      upsertLocal([p]);
      $('#personDialog').close();
      toast('저장했어요.');
    } catch (err) {
      console.error(err);
      toast('저장하지 못했어요. 다시 시도해 주세요.');
    }
  });

  $('#deletePersonBtn').addEventListener('click', async () => {
    if (!confirm(`${editingEmail}을 명단에서 지울까요?`)) return;
    try {
      await fs.deleteDoc(fs.doc(db, 'recipients', editingEmail));
      people = people.filter(p => p.email !== editingEmail);
      renderPeople();
      renderGroupChecks();
      $('#personDialog').close();
      toast('지웠어요.');
    } catch (err) {
      console.error(err);
      toast('지우지 못했어요. 다시 시도해 주세요.');
    }
  });

  // ---------- 엑셀에서 붙여 넣기 ----------
  const importForm = $('#importForm');

  // 한 줄에 이름·이메일·그룹. 엑셀 복사는 탭으로, 아니면 쉼표로 나눠요.
  function parseRows() {
    const f = importForm.elements;
    const byEmail = new Map();
    let skipped = 0;
    for (const line of f.rows.value.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cells = (line.includes('\t') ? line.split('\t') : line.split(',')).map(c => c.trim());
      const ei = cells.findIndex(c => isEmail(c.toLowerCase()));
      if (ei < 0) {
        skipped++;
        continue;
      }
      const rest = cells.filter((_, i) => i !== ei);
      const addr = cells[ei].toLowerCase();
      let groups = splitGroups(rest.slice(1).join(','));
      if (!groups.length && f.defaultGroup.value.trim()) groups = [f.defaultGroup.value.trim()];
      const prev = byEmail.get(addr);
      byEmail.set(addr, { email: addr, name: rest[0] || prev?.name || '', groups: [...new Set([...(prev?.groups || []), ...groups])] });
    }
    return { rows: [...byEmail.values()], skipped };
  }

  function preview() {
    const { rows, skipped } = parseRows();
    $('#importPreview').textContent = rows.length || skipped
      ? `가져올 사람 ${rows.length}명${skipped ? ` · 이메일이 없어 건너뛸 줄 ${skipped}개` : ''}`
      : '붙여 넣으면 몇 명인지 알려 드려요.';
  }

  $('#importBtn').addEventListener('click', () => {
    importForm.reset();
    preview();
    $('#importDialog').showModal();
  });
  importForm.addEventListener('input', preview);
  importForm.addEventListener('submit', async e => {
    if (e.submitter?.value !== 'save') return;
    e.preventDefault();
    const { rows } = parseRows();
    if (!rows.length) {
      toast('가져올 사람이 없어요. 이메일 열이 있는지 확인해 주세요.');
      return;
    }
    // 이미 있는 사람은 그룹을 더하고, 이름이 비어 있으면 원래 이름을 둬요
    const merged = rows.map(r => {
      const old = people.find(p => p.email === r.email);
      return old ? { email: r.email, name: r.name || old.name || '', groups: [...new Set([...(old.groups || []), ...r.groups])] } : r;
    });
    try {
      for (let i = 0; i < merged.length; i += 400) {
        const batch = fs.writeBatch(db);
        for (const p of merged.slice(i, i + 400)) {
          batch.set(fs.doc(db, 'recipients', p.email), { ...p, updatedAt: fs.serverTimestamp() });
        }
        await batch.commit();
      }
      upsertLocal(merged);
      $('#importDialog').close();
      toast(`${merged.length}명을 가져왔어요.`);
    } catch (err) {
      console.error(err);
      toast('가져오지 못했어요. 다시 시도해 주세요.');
    }
  });

  // ---------- 메일 쓰기 ----------
  function selected() {
    const groups = [...document.querySelectorAll('#groupChecks input:checked')].map(i => i.value);
    const emails = [...new Set(people.filter(p => p.groups?.some(g => groups.includes(g))).map(p => p.email))];
    return { groups, emails };
  }

  function updateCount() {
    $('#recipientCount').textContent = `받는 사람 ${selected().emails.length}명 (겹치는 사람은 한 번만)`;
  }

  function renderGroupChecks() {
    const checked = new Set(selected().groups);
    const groups = groupsOf();
    $('#groupChecks').innerHTML = groups.length
      ? groups.map(g => `<label class="check"><input type="checkbox" value="${esc(g)}"${checked.has(g) ? ' checked' : ''}> ${esc(g)} <small>${countOf(g)}명</small></label>`).join('')
      : '<p class="hint">받는 사람 탭에서 명단을 먼저 넣어 주세요.</p>';
    updateCount();
  }
  $('#groupChecks').addEventListener('change', updateCount);

  ctx.composeMail = (subject, text) => {
    openTab('mail');
    mailForm.elements.subject.value = subject;
    mailForm.elements.text.value = text;
    mailForm.elements.subject.focus();
  };

  async function send(groups, emails, test) {
    const f = mailForm.elements;
    const subject = f.subject.value.trim();
    const text = f.text.value.trim();
    const buttons = mailForm.querySelectorAll('button');
    buttons.forEach(b => (b.disabled = true));
    try {
      const campaign = fs.doc(fs.collection(db, 'campaigns'));
      await fs.setDoc(campaign, {
        subject, groups, total: emails.length, test,
        createdAt: fs.serverTimestamp(), createdBy: email,
      });
      const message = { subject, text: `${text}\n\n--\n${SIGNATURE}`, html: mailHtml(text) };
      const chunks = [];
      for (let i = 0; i < emails.length; i += BCC_SIZE) chunks.push(emails.slice(i, i + BCC_SIZE));
      for (let i = 0; i < chunks.length; i += 8) {
        const batch = fs.writeBatch(db);
        for (const bcc of chunks.slice(i, i + 8)) {
          batch.set(fs.doc(fs.collection(db, 'mail')), { to: FROM, bcc, message, campaignId: campaign.id, createdAt: fs.serverTimestamp() });
        }
        await batch.commit();
      }
      if (test) {
        toast(`${email}로 보냈어요. 받은편지함을 확인해 주세요.`);
      } else {
        mailForm.reset();
        renderGroupChecks();
        toast(`${emails.length}명에게 보내기 시작했어요.`);
      }
      loadLog();
      setTimeout(loadLog, 15000);
    } catch (err) {
      console.error(err);
      toast('보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    buttons.forEach(b => (b.disabled = false));
  }

  mailForm.addEventListener('submit', e => {
    e.preventDefault();
    const { groups, emails } = selected();
    if (!emails.length) {
      toast('받는 그룹을 골라 주세요.');
      return;
    }
    if (confirm(`${emails.length}명에게 보낼까요? 보낸 메일은 되돌릴 수 없어요.`)) send(groups, emails, false);
  });

  $('#testMailBtn').addEventListener('click', () => {
    if (mailForm.reportValidity()) send(['나에게 시험 발송'], [email], true);
  });

  // ---------- 보낸 기록 ----------
  async function status(id, created) {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'mail'), fs.where('campaignId', '==', id)));
    let sent = 0;
    let waiting = 0;
    const failed = [];
    const errors = new Set();
    snap.forEach(d => {
      const m = d.data();
      const state = m.delivery?.state;
      if (state === 'SUCCESS') {
        const accepted = m.delivery.info?.accepted;
        sent += accepted ? accepted.filter(a => a.toLowerCase() !== FROM).length : m.bcc.length;
        failed.push(...(m.delivery.info?.rejected || []));
      } else if (state === 'ERROR') {
        failed.push(...m.bcc);
        errors.add(m.delivery.error);
      } else {
        waiting += m.bcc.length;
      }
    });
    if (waiting) {
      const stuck = created && Date.now() - created.toMillis() > 10 * 60 * 1000;
      return stuck
        ? '<span class="state bad">보내지 못했어요 (메일 설정 확인)</span>'
        : '<span class="state wait">보내는 중</span>';
    }
    if (failed.length) {
      return `<details class="state bad"><summary>${sent}명 보냄 · ${failed.length}명 실패</summary>
        <p>${failed.map(esc).join('<br>')}</p>${[...errors].map(x => `<p class="hint">${esc(x)}</p>`).join('')}</details>`;
    }
    return `<span class="state ok">${sent}명 보냄</span>`;
  }

  async function loadLog() {
    const rows = $('#logRows');
    try {
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'campaigns'), fs.orderBy('createdAt', 'desc'), fs.limit(20)));
      if (snap.empty) {
        rows.innerHTML = '<tr><td colspan="4" class="msg">아직 보낸 메일이 없어요.</td></tr>';
        return;
      }
      rows.innerHTML = snap.docs.map(d => {
        const c = d.data();
        return `<tr data-id="${d.id}">
          <td class="c-date">${when(c.createdAt)}</td>
          <td>${c.test ? '<span class="chip">시험</span> ' : ''}${esc(c.subject)}<small class="sub">${esc((c.groups || []).join(', '))}</small></td>
          <td class="c-num">${c.total}명</td>
          <td class="c-state">확인 중…</td>
        </tr>`;
      }).join('');
      await Promise.all(snap.docs.map(async d => {
        rows.querySelector(`tr[data-id="${d.id}"] .c-state`).innerHTML = await status(d.id, d.data().createdAt);
      }));
    } catch (err) {
      console.error(err);
      rows.innerHTML = '<tr><td colspan="4" class="msg">기록을 불러오지 못했어요.</td></tr>';
    }
  }
  $('#refreshLogBtn').addEventListener('click', loadLog);

  loadPeople();
  loadLog();
}
