// Firebase SDK를 필요할 때만 불러와요. 공개 페이지는 Firestore만, 관리자 페이지는 로그인과 파일 저장소, 신청 페이지는 파일 저장소까지 씀.
import { firebaseConfig, emulator } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';

export const enabled = !!firebaseConfig;

let appP, dbP, authP, stP;

function app() {
  return appP ??= import(`${SDK}/firebase-app.js`).then(m => m.initializeApp(firebaseConfig));
}

// { db, fs } — fs는 firebase-firestore 모듈 (collection, query 등)
export function firestore() {
  return dbP ??= Promise.all([app(), import(`${SDK}/firebase-firestore.js`)]).then(([a, fs]) => {
    const db = fs.getFirestore(a);
    if (emulator) fs.connectFirestoreEmulator(db, ...emulator.firestore);
    return { db, fs };
  });
}

// { auth, fa } — fa는 firebase-auth 모듈
export function auth() {
  return authP ??= Promise.all([app(), import(`${SDK}/firebase-auth.js`)]).then(([a, fa]) => {
    const auth = fa.getAuth(a);
    if (emulator) fa.connectAuthEmulator(auth, emulator.auth, { disableWarnings: true });
    return { auth, fa };
  });
}

// { storage, st } — st는 firebase-storage 모듈 (연구비 신청 증빙 파일)
export function storage() {
  return stP ??= Promise.all([app(), import(`${SDK}/firebase-storage.js`)]).then(([a, st]) => {
    const storage = st.getStorage(a);
    if (emulator) st.connectStorageEmulator(storage, ...emulator.storage);
    return { storage, st };
  });
}
