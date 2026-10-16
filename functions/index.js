// mail 컬렉션에 새 문서가 생기면 학교 메일 서버(msvr.knu.ac.kr)로 cmri@knu.ac.kr 이름으로 보내요.
// Firebase 'Trigger Email' 확장 프로그램 대신 쓰는 함수예요 (확장 프로그램은 2027년 3월에 서비스 종료).
// 누가 어떤 메일 문서를 쓸 수 있는지는 firestore.rules가 정해요. 보내는 주소는 여기서 고정해요.
// 결과는 확장 프로그램과 같은 모양으로 문서의 delivery 칸에 남겨요 (관리자 페이지 '보낸 기록'이 읽어요).
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');

initializeApp();

// 비밀번호는 Secret Manager에 둬요: firebase functions:secrets:set SMTP_PASSWORD
const SMTP_PASSWORD = defineSecret('SMTP_PASSWORD');
// 보내는 계정·서버는 기본이 학교 메일이에요. 다른 계정(예: Gmail)으로 시험할 때만
// functions/.env 파일에 SMTP_USER, SMTP_HOST를 적고 배포해요 (README '메일 발송' 참고).
const USER = process.env.SMTP_USER || 'cmri@knu.ac.kr';
const HOST = process.env.SMTP_HOST || 'msvr.knu.ac.kr';
const PORT = Number(process.env.SMTP_PORT || 465);
const FROM = `경북대학교 세포·기질연구소 <${USER}>`;

exports.sendMail = onDocumentCreated(
  { document: 'mail/{id}', region: 'asia-northeast3', secrets: [SMTP_PASSWORD], retry: false },
  async event => {
    const ref = event.data?.ref;
    if (!ref) return;

    // 같은 문서를 두 번 받아도 한 번만 보내요
    const mail = await getFirestore().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.get('delivery')) return null;
      tx.update(ref, { delivery: { state: 'PROCESSING', startTime: FieldValue.serverTimestamp(), attempts: 1 } });
      return snap.data();
    });
    if (!mail) return;

    try {
      const transport = nodemailer.createTransport({
        host: HOST, port: PORT, secure: PORT === 465,
        auth: { user: USER, pass: SMTP_PASSWORD.value() },
      });
      const info = await transport.sendMail({
        from: FROM,
        to: mail.to,
        bcc: mail.bcc,
        subject: mail.message?.subject,
        text: mail.message?.text,
        html: mail.message?.html,
      });
      await ref.update({
        'delivery.state': 'SUCCESS',
        'delivery.endTime': FieldValue.serverTimestamp(),
        'delivery.info': {
          messageId: info.messageId || null,
          accepted: (info.accepted || []).map(String),
          rejected: (info.rejected || []).map(String),
          response: info.response || null,
        },
      });
    } catch (err) {
      console.error('메일을 보내지 못했어요', ref.id, err);
      await ref.update({
        'delivery.state': 'ERROR',
        'delivery.endTime': FieldValue.serverTimestamp(),
        'delivery.error': String(err?.message || err).slice(0, 500),
      });
    }
  },
);
