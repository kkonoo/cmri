// 관리자: 받는 사람 명단, 메일 보내기, 보낸 기록
// 메일은 mail 컬렉션에 쓰면 메일 함수(functions/index.js)가 cmri@knu.ac.kr로 보내요.
import { esc, renderBody } from './posts.js';

const FROM = 'cmri@knu.ac.kr';
const BCC_SIZE = 50;   // 한 통에 숨은참조 50명씩 (firestore.rules와 같게)
export const SIGNATURE = '경북대학교 의과대학 세포·기질연구소\ncmri@knu.ac.kr · 053-420-4868';

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
  let groupFilter = '';          // 위쪽 그룹 버튼으로 고른 그룹 ('' = 전체)
  const picked = new Set();      // 표에서 고른 사람 (이메일)
  let shownEmails = [];

  function renderPeople() {
    const groups = groupsOf();
    if (groupFilter && !groups.includes(groupFilter)) groupFilter = '';
    for (const e of [...picked]) if (!people.some(p => p.email === e)) picked.delete(e);
    $('#groupChips').innerHTML = [['', '전체', people.length], ...groups.map(g => [g, g, countOf(g)])]
      .map(([g, label, n]) => `<button type="button" data-group="${esc(g)}"${g === groupFilter ? ' class="on"' : ''}>${esc(label)}<small>${n}</small></button>`).join('')
      + '<button type="button" class="add" id="newGroupBtn">+ 새 그룹</button>';
    $('#groupTools').hidden = !groupFilter;
    $('#groupToolsName').textContent = groupFilter;
    const q = $('#peopleSearch').value.trim().toLowerCase();
    const shown = people.filter(p => (!groupFilter || p.groups?.includes(groupFilter))
      && (!q || (p.name || '').toLowerCase().includes(q) || p.email.includes(q)));
    shownEmails = shown.map(p => p.email);
    $('#peopleRows').innerHTML = shown.length
      ? shown.map(p => `<tr data-email="${esc(p.email)}" tabindex="0">
          <td class="c-check"><input type="checkbox" data-pick="${esc(p.email)}" aria-label="${esc(p.name || p.email)} 고르기"${picked.has(p.email) ? ' checked' : ''}></td>
          <td>${esc(p.name || '-')}</td><td>${esc(p.email)}</td>
          <td>${(p.groups || []).map(x => `<span class="chip">${esc(x)}</span>`).join(' ')}</td>
        </tr>`).join('')
      : `<tr><td colspan="4" class="msg">${people.length ? '찾는 사람이 없어요.' : '아직 명단이 없어요. 엑셀이나 메일 주소록을 붙여 넣어 시작해 보세요.'}</td></tr>`;
    renderPicked();
  }

  function renderPicked() {
    const n = picked.size;
    $('#selectionBar').hidden = !n;
    $('#selectionCount').textContent = `${n}명 골랐어요`;
    $('#removeFromGroupBtn').hidden = !groupFilter;
    $('#removeFromGroupBtn').textContent = `‘${groupFilter}’에서 빼기`;
    const all = $('#pickAll');
    all.checked = shownEmails.length > 0 && shownEmails.every(e => picked.has(e));
    all.indeterminate = !all.checked && shownEmails.some(e => picked.has(e));
  }

  // 여러 사람의 그룹을 한 번에 저장해요 (400명씩)
  async function saveGroups(changes, done) {
    if (!changes.length) return;
    try {
      for (let i = 0; i < changes.length; i += 400) {
        const batch = fs.writeBatch(db);
        for (const c of changes.slice(i, i + 400)) {
          batch.update(fs.doc(db, 'recipients', c.email), { groups: c.groups, updatedAt: fs.serverTimestamp() });
        }
        await batch.commit();
      }
      for (const c of changes) {
        const p = people.find(x => x.email === c.email);
        if (p) p.groups = c.groups;
      }
      renderPeople();
      renderGroupChecks();
      toast(done);
    } catch (err) {
      console.error(err);
      toast('저장하지 못했어요. 다시 시도해 주세요.');
    }
  }

  // 그룹 이름: 쉼표·세미콜론·빗금은 붙여 넣기에서 그룹을 나누는 글자라 못 써요
  function groupName(v) {
    const g = v.trim().replace(/\s+/g, ' ');
    if (!g) return null;
    if (/[,;/]/.test(g)) {
      toast('그룹 이름에는 쉼표(,)·세미콜론(;)·빗금(/)을 쓸 수 없어요.');
      return null;
    }
    return g;
  }

  // 그룹에 넣기 / 이름 바꾸기 창
  const groupForm = $('#groupForm');
  let groupMode = 'add';
  function openGroupDialog(mode) {
    groupMode = mode;
    groupForm.reset();
    $('#groupList').innerHTML = groupsOf().map(g => `<option value="${esc(g)}">`).join('');
    $('#groupDialogTitle').textContent = mode === 'add' ? `${picked.size}명을 그룹에 넣기` : '그룹 이름 바꾸기';
    $('#groupDialogHint').textContent = mode === 'add'
      ? '있는 그룹을 고르거나 새 이름을 쓰면 그 이름으로 그룹이 생겨요.'
      : `‘${groupFilter}’ 그룹 ${countOf(groupFilter)}명의 그룹 이름이 바뀌어요. 있는 그룹 이름을 쓰면 두 그룹이 합쳐져요.`;
    if (mode === 'rename') groupForm.elements.group.value = groupFilter;
    $('#groupDialog').showModal();
  }

  groupForm.addEventListener('submit', async e => {
    if (e.submitter?.value !== 'save') return;
    e.preventDefault();
    const g = groupName(groupForm.elements.group.value);
    if (!g) return;
    $('#groupDialog').close();
    if (groupMode === 'add') {
      const changes = people.filter(p => picked.has(p.email) && !p.groups?.includes(g))
        .map(p => ({ email: p.email, groups: [...(p.groups || []), g] }));
      const n = picked.size;
      picked.clear();
      if (!changes.length) {
        renderPeople();
        toast(`모두 이미 ‘${g}’에 있어요.`);
        return;
      }
      await saveGroups(changes, `${n}명을 ‘${g}’에 넣었어요.`);
    } else {
      const from = groupFilter;
      if (g === from) return;
      const changes = people.filter(p => p.groups?.includes(from))
        .map(p => ({ email: p.email, groups: [...new Set(p.groups.map(x => (x === from ? g : x)))] }));
      groupFilter = g;
      await saveGroups(changes, `‘${from}’을 ‘${g}’(으)로 바꿨어요.`);
    }
  });

  $('#groupChips').addEventListener('click', e => {
    if (e.target.closest('#newGroupBtn')) {
      if (!picked.size) toast('넣을 사람을 아래 표에서 먼저 골라 주세요.');
      else openGroupDialog('add');
      return;
    }
    const b = e.target.closest('button[data-group]');
    if (!b) return;
    groupFilter = b.dataset.group;
    renderPeople();
  });
  $('#addToGroupBtn').addEventListener('click', () => openGroupDialog('add'));
  $('#renameGroupBtn').addEventListener('click', () => openGroupDialog('rename'));
  $('#removeFromGroupBtn').addEventListener('click', () => {
    const g = groupFilter;
    const changes = people.filter(p => picked.has(p.email) && p.groups?.includes(g))
      .map(p => ({ email: p.email, groups: p.groups.filter(x => x !== g) }));
    picked.clear();
    saveGroups(changes, `${changes.length}명을 ‘${g}’에서 뺐어요.`);
  });
  $('#deleteGroupBtn').addEventListener('click', () => {
    const g = groupFilter;
    if (!confirm(`‘${g}’ 그룹을 지울까요? ${countOf(g)}명은 명단에 그대로 남고 이 그룹만 빠져요.`)) return;
    const changes = people.filter(p => p.groups?.includes(g)).map(p => ({ email: p.email, groups: p.groups.filter(x => x !== g) }));
    groupFilter = '';
    saveGroups(changes, `‘${g}’ 그룹을 지웠어요.`);
  });
  $('#clearPickBtn').addEventListener('click', () => {
    picked.clear();
    renderPeople();
  });
  $('#pickAll').addEventListener('change', e => {
    for (const em of shownEmails) e.target.checked ? picked.add(em) : picked.delete(em);
    renderPeople();
  });
  $('#peopleRows').addEventListener('change', e => {
    const box = e.target.closest('input[data-pick]');
    if (!box) return;
    box.checked ? picked.add(box.dataset.pick) : picked.delete(box.dataset.pick);
    renderPicked();
  });

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

  $('#peopleSearch').addEventListener('input', renderPeople);
  $('#addPersonBtn').addEventListener('click', () => openPerson());
  $('#peopleRows').addEventListener('click', e => {
    if (e.target.closest('.c-check')) return;
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

  // 엑셀: 한 줄에 이름·이메일·그룹 (탭, 아니면 쉼표로 나눠요)
  // 메일 주소록: "홍길동 <hong@knu.ac.kr>," 처럼 한 줄에 한 명이든, 받는 사람 칸을 통째로 복사한 한 줄이든 돼요
  const ADDRESS = /([^<>,;]*?)\s*<([^<>\s]+@[^<>\s]+)>/g;
  // 이름 옆 직함으로 그룹 나누기 (앞에서부터 먼저 맞는 것)
  const ROLE_GROUPS = [[/연구초빙교수/, '연구초빙교수'], [/박사후/, '박사후연구원'], [/연구행정원/, '연구행정원'], [/연구원/, '연구원'], [/학생|과정생|대학원생/, '학생']];

  function parseRows() {
    const f = importForm.elements;
    const byEmail = new Map();
    const fallback = f.defaultGroup.value.trim();
    let skipped = 0;
    const add = (addr, name, groups) => {
      if (!groups.length && f.byRole.checked) {
        const role = ROLE_GROUPS.find(([re]) => re.test(name));
        if (role) groups = [role[1]];
      }
      if (!groups.length && fallback) groups = [fallback];
      const prev = byEmail.get(addr);
      byEmail.set(addr, { email: addr, name: name || prev?.name || '', groups: [...new Set([...(prev?.groups || []), ...groups])] });
    };
    for (const raw of f.rows.value.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const found = [...line.matchAll(ADDRESS)].filter(m => isEmail(m[2].toLowerCase()));
      if (found.length) {
        for (const m of found) add(m[2].toLowerCase(), m[1].replace(/^[\s*•·-]+/, '').replace(/^["']|["']$/g, '').trim(), []);
        continue;
      }
      const cells = (line.includes('\t') ? line.split('\t') : line.split(',')).map(c => c.trim());
      const ei = cells.findIndex(c => isEmail(c.toLowerCase()));
      if (ei < 0) {
        skipped++;
        continue;
      }
      const rest = cells.filter((_, i) => i !== ei);
      add(cells[ei].toLowerCase(), rest[0] || '', splitGroups(rest.slice(1).join(',')));
    }
    return { rows: [...byEmail.values()], skipped };
  }

  function preview() {
    const { rows, skipped } = parseRows();
    if (!rows.length && !skipped) {
      $('#importPreview').textContent = '붙여 넣으면 몇 명인지, 그룹마다 몇 명인지 알려 드려요.';
      return;
    }
    const counts = new Map();
    for (const r of rows) for (const g of r.groups.length ? r.groups : ['그룹 없음']) counts.set(g, (counts.get(g) || 0) + 1);
    $('#importPreview').textContent = `가져올 사람 ${rows.length}명`
      + (counts.size ? ` (${[...counts].map(([g, n]) => `${g} ${n}`).join(' · ')})` : '')
      + (skipped ? ` · 이메일이 없어 건너뛸 줄 ${skipped}개` : '');
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
        rows.innerHTML = '<tr><td colspan="5" class="msg">아직 보낸 메일이 없어요.</td></tr>';
        return;
      }
      rows.innerHTML = snap.docs.map(d => {
        const c = d.data();
        return `<tr data-id="${d.id}">
          <td class="c-date">${when(c.createdAt)}</td>
          <td>${c.test ? '<span class="chip">시험</span> ' : ''}${esc(c.subject)}<small class="sub">${esc((c.groups || []).join(', '))}</small></td>
          <td class="c-num">${c.total}명</td>
          <td class="c-state">확인 중…</td>
          <td class="c-del"><button class="icon-x" type="button" data-del="${d.id}" aria-label="기록 지우기" title="기록 지우기">✕</button></td>
        </tr>`;
      }).join('');
      await Promise.all(snap.docs.map(async d => {
        rows.querySelector(`tr[data-id="${d.id}"] .c-state`).innerHTML = await status(d.id, d.data().createdAt);
      }));
    } catch (err) {
      console.error(err);
      rows.innerHTML = '<tr><td colspan="5" class="msg">기록을 불러오지 못했어요.</td></tr>';
    }
  }
  $('#refreshLogBtn').addEventListener('click', loadLog);

  // 기록과 그 메일 문서를 함께 지워요. 이미 나간 메일은 되돌아오지 않아요
  $('#logRows').addEventListener('click', async e => {
    const b = e.target.closest('[data-del]');
    if (!b || !confirm('이 기록을 지울까요? 이미 보낸 메일은 그대로예요.')) return;
    b.disabled = true;
    try {
      const id = b.dataset.del;
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'mail'), fs.where('campaignId', '==', id)));
      const batch = fs.writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      batch.delete(fs.doc(db, 'campaigns', id));
      await batch.commit();
      toast('기록을 지웠어요.');
      loadLog();
    } catch (err) {
      console.error(err);
      b.disabled = false;
      toast('지우지 못했어요. 다시 시도해 주세요.');
    }
  });

  loadPeople();
  loadLog();
}
