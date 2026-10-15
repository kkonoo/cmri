// Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹)에서 복사한 값을 넣어요.
// null이면 홈페이지는 예시 글을 보여 주고, 관리자 페이지는 설정 안내만 보여 줘요.
export const firebaseConfig = {
  apiKey: 'AIzaSyCNa1EHaL5u7e-tcKQzI559SUR94XhCGhc',
  authDomain: 'cmri-knumed.firebaseapp.com',
  projectId: 'cmri-knumed',
  storageBucket: 'cmri-knumed.firebasestorage.app',
  messagingSenderId: '1021990360649',
  appId: '1:1021990360649:web:26b44b92ee82d927371198',
};

// 로컬 에뮬레이터로 시험할 때만 씀. 예: { auth: 'http://127.0.0.1:9099', firestore: ['127.0.0.1', 8080] }
export const emulator = null;
