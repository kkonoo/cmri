// 신청·제출: 학교 메일(@knu.ac.kr)로 받은 링크로 로그인하고, 종류별 신청서와 증빙 파일을 내요.
// 신청은 applications 컬렉션, 파일은 Storage applications/{uid}/{신청 ID}/ 아래에 저장해요.
import { enabled, auth, firestore, storage } from './firebase.js';
import { bi, esc } from './posts.js';
import { GROUPS, TYPES, summary, statusLabel, detailRows, won } from './apply-types.js';

const $ = s => document.querySelector(s);
const EMAIL_KEY = 'cmri-apply-email';   // 링크를 보낸 주소 (돌아왔을 때 로그인에 씀)
const MAX_FILES = 5;
const MAX_SIZE = 20 * 1024 * 1024;
const FILE_OK = /\.(pdf|jpe?g|png|hwpx?|docx?|xlsx?|pptx?)$/i;   // storage.rules와 같게
const isKnu = s => /^[^\s@]+@knu\.ac\.kr$/i.test(s);

const MSG = {
  setup: bi('아직 홈페이지 설정 중이에요. 행정실로 문의해 주세요.', 'The site is still being set up. Please contact the administrative office.'),
  failed: bi('화면을 열지 못했어요. 잠시 후 새로 고침해 주세요.', 'Something went wrong. Please reload the page in a moment.'),
  needKnu: bi('학교 메일(@knu.ac.kr) 주소를 넣어 주세요.', 'Please enter your KNU email address (@knu.ac.kr).'),
  sent: bi('로그인 링크를 보냈어요. 메일의 링크를 누르면 이 화면으로 돌아와요. 메일이 보이지 않으면 스팸함을 확인해 주세요.',
    'We’ve sent a sign-in link. Click the link in the email to come back to this page. If you don’t see it, check your spam folder.'),
  sendFailed: bi('로그인 링크를 보내지 못했어요. 주소를 확인하고 다시 시도해 주세요.', 'We couldn’t send the sign-in link. Please check the address and try again.'),
  notReady: bi('학교 메일 로그인이 아직 준비되지 않았어요. 행정실로 문의해 주세요.', 'KNU email sign-in isn’t available yet. Please contact the administrative office.'),
  confirmEmail: bi('링크를 받은 메일 주소를 한 번 더 넣어 주세요.', 'Please enter the email address the link was sent to.'),
  expired: bi('로그인 링크가 만료되었거나 이미 쓰였어요. 링크를 다시 받아 주세요.', 'This sign-in link has expired or has already been used. Please request a new one.'),
  notKnu: bi('학교 메일(@knu.ac.kr)로 로그인해야 신청할 수 있어요.', 'Please sign in with your KNU email (@knu.ac.kr) to apply.'),
  amount: bi('신청 금액을 숫자로 넣어 주세요.', 'Please enter the amount as a number.'),
  tooMany: bi('파일은 5개까지 올릴 수 있어요.', 'You can attach up to 5 files.'),
  tooBig: bi('20MB가 넘는 파일이 있어요.', 'One of the files is larger than 20 MB.'),
  badFile: bi('올릴 수 없는 파일 형식이에요.', 'This file type can’t be uploaded.'),
  saving: bi('저장하는 중…', 'Saving…'),
  done: bi('제출했어요. 결과는 이 화면과 메일로 알려 드려요. 다른 것도 이어서 제출할 수 있어요.',
    'Submitted. We’ll let you know the result here and by email. You can submit another one right away.'),
  submitFailed: bi('제출하지 못했어요. 잠시 후 다시 시도해 주세요.', 'Couldn’t submit. Please try again in a moment.'),
  empty: bi('아직 신청·제출한 것이 없어요.', 'Nothing submitted yet.'),
};

const gate = $('#applyGate');
const loginForm = $('#loginForm');
const form = $('#applyForm');

function setGate(html) {
  gate.innerHTML = `<p class="msg">${html}</p>`;
  gate.hidden = false;
}
function say(el, html = '', kind = '') {
  el.innerHTML = html;
  el.className = `form-msg ${kind}`;
}

const params = new URLSearchParams(location.search);
const startType = params.get('type') in TYPES ? params.get('type') : 'publication';
// 주소창에는 ?type만 남겨요 (로그인 링크 값은 지움)
const cleanUrl = type => location.pathname + (type ? `?type=${encodeURIComponent(type)}` : '');
const currentType = () => form.elements.type?.value || startType;

if (!enabled) {
  setGate(MSG.setup);
} else {
  start().catch(err => {
    console.error(err);
    setGate(MSG.failed);
  });
}

async function start() {
  const [{ auth: a, fa }, { db, fs }] = await Promise.all([auth(), firestore()]);
  let linkPending = fa.isSignInWithEmailLink(a, location.href) ? location.href : null;

  async function finishLink(email) {
    try {
      await fa.signInWithEmailLink(a, email, linkPending);
      try { localStorage.removeItem(EMAIL_KEY); } catch { /* 없어도 돼요 */ }
    } catch (err) {
      console.error(err);
      say($('#loginMsg'), MSG.expired, 'bad');
    }
    linkPending = null;
    history.replaceState(null, '', cleanUrl(params.get('type')));
  }

  if (linkPending) {
    let saved = null;
    try { saved = localStorage.getItem(EMAIL_KEY); } catch { /* 다른 기기에서 열면 다시 물어요 */ }
    if (saved) await finishLink(saved);
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = loginForm.elements.email.value.trim().toLowerCase();
    if (!isKnu(email)) return say($('#loginMsg'), MSG.needKnu, 'bad');
    if (linkPending) return finishLink(email);
    const button = loginForm.querySelector('button');
    button.disabled = true;
    try {
      const url = new URL(cleanUrl(params.get('type')), location.href).href;
      a.languageCode = document.documentElement.lang === 'en' ? 'en' : 'ko';   // 로그인 메일도 화면 언어로
      await fa.sendSignInLinkToEmail(a, email, { url, handleCodeInApp: true });
      try { localStorage.setItem(EMAIL_KEY, email); } catch { /* 돌아왔을 때 주소를 다시 물어요 */ }
      say($('#loginMsg'), MSG.sent, 'ok');
    } catch (err) {
      console.error(err);
      // 콘솔에서 이메일 링크 로그인을 켜지 않았거나 도메인이 승인되지 않은 경우 (README 처음 설정 3)
      const setup = ['auth/operation-not-allowed', 'auth/unauthorized-continue-uri', 'auth/unauthorized-domain', 'auth/admin-restricted-operation'].includes(err.code);
      say($('#loginMsg'), setup ? MSG.notReady : MSG.sendFailed, 'bad');
    }
    button.disabled = false;
  });

  $('#logoutBtn').addEventListener('click', () => fa.signOut(a).then(() => location.reload()));

  let started = false;
  fa.onAuthStateChanged(a, user => {
    gate.hidden = true;
    loginForm.hidden = !!user;
    $('#applyApp').hidden = !user;
    if (!user) {
      if (linkPending) say($('#loginMsg'), MSG.confirmEmail);
      return;
    }
    const email = user.email.toLowerCase();
    $('#accountEmail').innerHTML = bi(`${esc(email)}로 로그인했어요`, `Signed in as ${esc(email)}`);
    if (!isKnu(email) || !user.emailVerified) {
      form.hidden = true;
      $('#myApps').hidden = true;
      setGate(MSG.notKnu);
      return;
    }
    if (started) return;
    started = true;
    initForm({ db, fs, user, email });
  });
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

function initForm({ db, fs, user, email }) {
  const msg = $('#applyMsg');
  renderTypes(startType);
  renderDetails(startType);

  form.elements.files.addEventListener('change', () => say(msg));
  $('#typeChoices').addEventListener('change', () => {
    renderDetails(currentType());
    history.replaceState(null, '', cleanUrl(currentType()));
  });

  async function loadMine() {
    try {
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'applications'), fs.where('uid', '==', user.uid)));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((x, y) => (y.createdAt?.toMillis() || 0) - (x.createdAt?.toMillis() || 0));
      // 신청자 칸은 가장 최근 신청으로 채워 둬요
      const last = list[0];
      if (last) {
        for (const k of ['name', 'position', 'dept', 'phone']) {
          if (!form.elements[k].value) form.elements[k].value = last[k] || '';
        }
      }
      $('#myApps').hidden = false;
      $('#myAppList').innerHTML = list.length ? list.map(appItem).join('') : `<li class="empty">${MSG.empty}</li>`;
    } catch (err) {
      console.error(err);
    }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const type = currentType();
    const t = TYPES[type];
    const f = form.elements;
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
      const ref = fs.doc(fs.collection(db, 'applications'));
      const uploaded = [];
      if (files.length) {
        const { storage: s, st } = await storage();
        for (const [i, file] of files.entries()) {
          say(msg, bi(`파일을 올리는 중… (${i + 1}/${files.length})`, `Uploading files… (${i + 1}/${files.length})`));
          const path = `applications/${user.uid}/${ref.id}/${i + 1}-${file.name.replace(/[\\/#?[\]*\u0000-\u001f]/g, '_').slice(-100)}`;
          await st.uploadBytes(st.ref(s, path), file, { contentType: file.type || 'application/octet-stream' });
          uploaded.push({ name: file.name.slice(0, 200), path, size: file.size });
        }
      }
      say(msg, MSG.saving);
      const app = {
        uid: user.uid, email, type,
        name: f.name.value.trim(), position: f.position.value.trim(), dept: f.dept.value.trim(), phone: f.phone.value.trim(),
        details, memo: f.memo.value.trim(), files: uploaded,
        status: 'submitted', createdAt: fs.serverTimestamp(),
      };
      if (t.amount) app.amount = amount;
      await fs.setDoc(ref, app);
      // 알림 메일은 못 써도 신청은 된 거예요
      fs.setDoc(fs.doc(db, 'mail', ref.id), { to: 'cmri@knu.ac.kr', message: noticeMessage(app), applicationId: ref.id, createdAt: fs.serverTimestamp() })
        .catch(err => console.error(err));
      // 신청자 칸은 두고 나머지만 비워서 이어서 낼 수 있게 해요
      renderDetails(type);
      f.memo.value = '';
      f.files.value = '';
      f.amount.value = '';
      say(msg, MSG.done, 'ok');
      loadMine();
    } catch (err) {
      console.error(err);
      say(msg, MSG.submitFailed, 'bad');
    }
    button.disabled = false;
  });

  loadMine();
}

function appItem(a) {
  const t = TYPES[a.type];
  const d = a.createdAt?.toDate();
  const when = d ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` : '';
  const [ko, en] = statusLabel(a);
  return `<li>
    <span class="when">${when}</span>
    <span class="what"><b>${t ? bi(esc(t.ko), esc(t.en)) : ''}</b>${esc(summary(a))}</span>
    <span class="tag state-${esc(a.status)}">${bi(esc(ko), esc(en))}</span>
    ${a.note && a.status !== 'submitted' ? `<p class="note">${esc(a.note)}</p>` : ''}
  </li>`;
}
