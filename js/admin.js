// 관리자 페이지: 로그인, 탭, 관리자 목록
import { enabled, auth, firestore } from './firebase.js';
import { esc } from './posts.js';
import { initPosts } from './admin-posts.js';
import { initMail } from './admin-mail.js';
import { initFaculty } from './admin-faculty.js';

const $ = s => document.querySelector(s);
const gate = $('#gate');
const app = $('#app');

let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2800);
}

function showGate(html) {
  gate.innerHTML = `<div class="gate-box">${html}</div>`;
  gate.hidden = false;
  app.hidden = true;
}

function openTab(name) {
  document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => (p.hidden = p.dataset.panel !== name));
}

$('.admin-tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]');
  if (b) openTab(b.dataset.tab);
});

if (!enabled) {
  showGate(`<h1>Firebase 설정이 필요해요</h1>
    <p>README의 ‘처음 설정’대로 <code>js/firebase-config.js</code>를 채우면 이 화면에서 로그인할 수 있어요.</p>`);
} else {
  start().catch(err => {
    console.error(err);
    showGate('<h1>관리자 페이지를 열지 못했어요</h1><p>잠시 후 새로 고침해 주세요.</p>');
  });
}

async function start() {
  const [{ auth: a, fa }, { db, fs }] = await Promise.all([auth(), firestore()]);
  // 로그아웃하면 새로 고쳐서 이전 계정의 화면이 남지 않게 해요
  $('#logoutBtn').addEventListener('click', () => fa.signOut(a).then(() => location.reload()));

  let started = false;
  fa.onAuthStateChanged(a, async user => {
    $('#account').hidden = !user;
    if (!user) {
      showGate(`<h1>관리자 로그인</h1>
        <p>관리자로 등록된 구글 계정으로 로그인해 주세요.</p>
        <button class="btn-s primary big" type="button" id="loginBtn">구글 계정으로 로그인</button>`);
      $('#loginBtn').addEventListener('click', () => {
        fa.signInWithPopup(a, new fa.GoogleAuthProvider()).catch(err => {
          if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code)) {
            console.error(err);
            toast('로그인하지 못했어요. 다시 시도해 주세요.');
          }
        });
      });
      return;
    }

    const email = user.email.toLowerCase();
    $('#accountEmail').textContent = email;
    let admin = false;
    try {
      admin = (await fs.getDoc(fs.doc(db, 'admins', email))).exists();
    } catch (err) {
      console.error(err);
    }
    if (!admin) {
      showGate(`<h1>관리자로 등록되지 않은 계정이에요</h1>
        <p>${esc(email)} 계정은 아직 관리자가 아니에요. 다른 관리자에게 관리자 탭에서 추가해 달라고 부탁해 주세요.</p>`);
      return;
    }

    gate.hidden = true;
    app.hidden = false;
    if (started) return;
    started = true;
    const ctx = { db, fs, email, toast, openTab };
    initMail(ctx);   // ctx.composeMail을 만들어 둬요
    initPosts(ctx);
    initFaculty(ctx);
    initAdmins(ctx);
  });
}

function initAdmins({ db, fs, email, toast }) {
  const list = $('#adminList');
  const form = $('#adminForm');

  async function load() {
    try {
      const snap = await fs.getDocs(fs.collection(db, 'admins'));
      list.innerHTML = snap.docs.map(d => `<li>
        <span>${esc(d.id)}${d.id === email ? ' <small>(나)</small>' : ''}</span>
        ${d.id === email ? '' : `<button class="btn-s danger" type="button" data-remove="${esc(d.id)}">빼기</button>`}
      </li>`).join('');
    } catch (err) {
      console.error(err);
      list.innerHTML = '<li class="msg">관리자 목록을 불러오지 못했어요.</li>';
    }
  }

  list.addEventListener('click', async e => {
    const b = e.target.closest('[data-remove]');
    if (!b || !confirm(`${b.dataset.remove} 계정을 관리자에서 뺄까요?`)) return;
    try {
      await fs.deleteDoc(fs.doc(db, 'admins', b.dataset.remove));
      toast('관리자에서 뺐어요.');
      load();
    } catch (err) {
      console.error(err);
      toast('빼지 못했어요. 다시 시도해 주세요.');
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const add = form.elements.email.value.trim().toLowerCase();
    try {
      await fs.setDoc(fs.doc(db, 'admins', add), { addedBy: email, addedAt: fs.serverTimestamp() });
      form.reset();
      toast('관리자를 추가했어요.');
      load();
    } catch (err) {
      console.error(err);
      toast('추가하지 못했어요. 다시 시도해 주세요.');
    }
  });

  load();
}
