// 신청·제출: 로그인 없이 누구나 종류별 신청서와 증빙 파일을 내요. 결과는 신청자가 적은 이메일로 보내요.
// 신청서를 applications 컬렉션에 먼저 쓰고, 파일은 Storage applications/{신청 ID}/ 아래에 올려요
// (storage.rules가 신청서에 적힌 파일만 받아요).
import { enabled, firestore, storage } from './firebase.js';
import { bi, esc } from './posts.js';
import { GROUPS, TYPES, detailRows, won } from './apply-types.js';

const $ = s => document.querySelector(s);
const MAX_FILES = 5;
const MAX_SIZE = 20 * 1024 * 1024;
const FILE_OK = /\.(pdf|jpe?g|png|hwpx?|docx?|xlsx?|pptx?)$/i;   // storage.rules와 같게
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;   // firestore.rules와 같게

const MSG = {
  setup: bi('아직 홈페이지 설정 중이에요. 행정실로 문의해 주세요.', 'The site is still being set up. Please contact the administrative office.'),
  email: bi('이메일 주소를 확인해 주세요. 결과를 이 주소로 보내 드려요.', 'Please check your email address. We’ll send the result there.'),
  amount: bi('신청 금액을 숫자로 넣어 주세요.', 'Please enter the amount as a number.'),
  tooMany: bi('파일은 5개까지 올릴 수 있어요.', 'You can attach up to 5 files.'),
  tooBig: bi('20MB가 넘는 파일이 있어요.', 'One of the files is larger than 20 MB.'),
  badFile: bi('올릴 수 없는 파일 형식이에요.', 'This file type can’t be uploaded.'),
  saving: bi('저장하는 중…', 'Saving…'),
  done: bi('제출했어요. 결과는 적어 주신 이메일로 알려 드려요. 다른 것도 이어서 제출할 수 있어요.',
    'Submitted. We’ll email you the result. You can submit another one right away.'),
  submitFailed: bi('제출하지 못했어요. 잠시 후 다시 시도해 주세요.', 'Couldn’t submit. Please try again in a moment.'),
};

const gate = $('#applyGate');
const form = $('#applyForm');

function say(el, html = '', kind = '') {
  el.innerHTML = html;
  el.className = `form-msg ${kind}`;
}

const params = new URLSearchParams(location.search);
const startType = params.get('type') in TYPES ? params.get('type') : 'publication';
// 고른 종류는 주소창에 남겨요 (그대로 링크로 보낼 수 있게)
const cleanUrl = type => location.pathname + (type ? `?type=${encodeURIComponent(type)}` : '');
const currentType = () => form.elements.type?.value || startType;

if (enabled) {
  gate.hidden = true;
  form.hidden = false;
  initForm();
} else {
  gate.innerHTML = `<p class="msg">${MSG.setup}</p>`;
}

// ---------- 신청서 ----------
function fieldHtml(f) {
  const label = bi(esc(f.ko), esc(f.en));
  const name = `d_${f.key}`;
  const req = f.required ? ' required' : '';
  if (f.kind === 'choice') {
    return `<fieldset class="field"><legend>${label}</legend><div class="choices">${f.options.map(([ko, en]) =>
      `<label><input type="radio" name="${name}" value="${esc(ko)}"${req}> ${bi(esc(ko), esc(en))}</label>`).join('')}</div></fieldset>`;
  }
  if (f.kind === 'check') return `<label class="check"><input type="checkbox" name="${name}" value="예"> ${label}</label>`;
  if (f.kind === 'textarea') return `<label class="field">${label}<textarea name="${name}" rows="4" maxlength="2000"${req}></textarea></label>`;
  return `<label class="field">${label}<input name="${name}" type="${f.kind === 'date' ? 'date' : 'text'}" maxlength="300"${req}></label>`;
}

function renderTypes(selected) {
  $('#typeChoices').innerHTML = Object.entries(GROUPS).map(([g, gl]) => `<div class="choice-group">
    <span class="choice-label">${bi(gl.ko, gl.en)}</span>
    <div class="choices">${Object.entries(TYPES).filter(([, t]) => t.group === g).map(([k, t]) =>
      `<label><input type="radio" name="type" value="${k}" required${k === selected ? ' checked' : ''}> ${bi(esc(t.ko), esc(t.en))}</label>`).join('')}</div>
  </div>`).join('');
}

function renderDetails(type) {
  const t = TYPES[type];
  $('#detailFields').innerHTML = t.fields.map(fieldHtml).join('');
  const amount = form.elements.amount;
  $('#amountField').hidden = !t.amount;
  amount.required = !!t.amount;
  amount.disabled = !t.amount;   // 숨긴 칸이 제출을 막지 않게
  form.elements.files.required = !!t.needsFile;
  $('#fileHint').innerHTML = bi(esc(t.files[0]), esc(t.files[1]));
}

function checkFiles(list) {
  if (list.length > MAX_FILES) return MSG.tooMany;
  if (list.some(f => f.size > MAX_SIZE)) return MSG.tooBig;
  const bad = list.find(f => !FILE_OK.test(f.name));
  if (bad) return `${MSG.badFile} (${esc(bad.name)})`;
  return null;
}

// 연구소로 가는 새 신청 알림 (글만)
function noticeMessage(app) {
  const t = TYPES[app.type];
  const lines = [
    `종류: ${GROUPS[t.group].ko} · ${t.ko}`,
    `이름: ${app.name}${app.position ? ` (${app.position})` : ''}`,
    `소속: ${app.dept}`,
    `연락처: ${app.phone} · ${app.email}`,
    app.amount ? `신청 금액: ${won(app.amount)}` : null,
    ...detailRows(app).map(([k, v]) => `${k}: ${v}`),
    app.memo ? `하고 싶은 말: ${app.memo}` : null,
    `첨부: ${app.files.length ? app.files.map(f => f.name).join(', ') : '없음'}`,
    '',
    `관리자 페이지에서 확인: ${new URL('admin.html', location.href).href}`,
  ];
  return {
    subject: `[${GROUPS[t.group].ko}] ${t.ko} - ${app.name} (${app.dept})`,
    text: lines.filter(x => x != null).join('\n').slice(0, 9900),
  };
}

function initForm() {
  const msg = $('#applyMsg');
  renderTypes(startType);
  renderDetails(startType);

  form.elements.files.addEventListener('change', () => say(msg));
  $('#typeChoices').addEventListener('change', () => {
    renderDetails(currentType());
    history.replaceState(null, '', cleanUrl(currentType()));
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const type = currentType();
    const t = TYPES[type];
    const f = form.elements;
    const email = f.email.value.trim().toLowerCase();
    if (!EMAIL_OK.test(email)) return say(msg, MSG.email, 'bad');
    const files = [...f.files.files];
    const fileProblem = checkFiles(files);
    if (fileProblem) return say(msg, fileProblem, 'bad');
    let amount = null;
    if (t.amount) {
      amount = Number(f.amount.value.replace(/[^0-9]/g, ''));
      if (!amount || amount > 100000000) return say(msg, MSG.amount, 'bad');
    }
    const details = {};
    for (const field of t.fields) {
      const el = f[`d_${field.key}`];
      const v = field.kind === 'check' ? (el.checked ? el.value : '') : String(el.value || '').trim();
      if (v) details[field.key] = v;
    }

    const button = $('#submitBtn');
    button.disabled = true;
    try {
      const { db, fs } = await firestore();
      const ref = fs.doc(fs.collection(db, 'applications'));
      // 파일 자리를 신청서에 먼저 적어요. Storage는 여기 적힌 경로·크기와 같은 파일만 받아요
      const declared = files.map((file, i) => ({
        name: file.name.slice(0, 200),
        path: `applications/${ref.id}/${i + 1}-${file.name.replace(/[\\/#?[\]*\u0000-\u001f]/g, '_').slice(-100)}`,
        size: file.size,
      }));
      const app = {
        email, type,
        name: f.name.value.trim(), position: f.position.value.trim(), dept: f.dept.value.trim(), phone: f.phone.value.trim(),
        details, memo: f.memo.value.trim(), files: declared,
        status: 'submitted', createdAt: fs.serverTimestamp(),
      };
      if (t.amount) app.amount = amount;
      say(msg, MSG.saving);
      await fs.setDoc(ref, app);
      if (files.length) {
        const { storage: s, st } = await storage();
        for (const [i, file] of files.entries()) {
          say(msg, bi(`파일을 올리는 중… (${i + 1}/${files.length})`, `Uploading files… (${i + 1}/${files.length})`));
          await st.uploadBytes(st.ref(s, declared[i].path), file, { contentType: file.type || 'application/octet-stream' });
        }
      }
      // 알림 메일은 못 써도 신청은 된 거예요
      fs.setDoc(fs.doc(db, 'mail', ref.id), { to: 'cmri@knu.ac.kr', message: noticeMessage(app), applicationId: ref.id, createdAt: fs.serverTimestamp() })
        .catch(err => console.error(err));
      // 신청자 칸은 두고 나머지만 비워서 이어서 낼 수 있게 해요
      renderDetails(type);
      f.memo.value = '';
      f.files.value = '';
      f.amount.value = '';
      say(msg, MSG.done, 'ok');
    } catch (err) {
      console.error(err);
      say(msg, MSG.submitFailed, 'bad');
    }
    button.disabled = false;
  });
}
