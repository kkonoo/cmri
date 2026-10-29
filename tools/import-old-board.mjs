// 옛 홈페이지(cmri.knu.ac.kr) 게시판의 공지·소식·뉴스레터를 새 사이트로 옮겨요.
//   node import-old-board.mjs            미리보기: 옛 글과 파일을 .old-board/에 받아 정리만 해요 (Firebase는 그대로)
//   node import-old-board.mjs --upload   올리기: 파일은 Storage, 글은 Firestore에 넣어요 (service-account.json 필요)
// 옛 서버가 해외 접속을 막아서 국내 인터넷에서 돌려요. 순서는 README의 '옛 홈페이지 글 옮기기'.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { PDFDocument } from 'pdf-lib';

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const UPLOAD = args.includes('--upload');
const SITE = option('--site', 'http://cmri.knu.ac.kr');
const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = option('--key', join(HERE, 'service-account.json'));
// 옛 호스팅은 하루 트래픽 한도가 있어서, 한 번에 이만큼만 받고 멈춰요 (다음 날 다시 돌리면 이어서)
const MAX_MB = Number(option('--max-mb', 300));
const CACHE = join(HERE, '.old-board');
const BUCKET = 'cmri-knumed.firebasestorage.app';   // js/firebase-config.js의 storageBucket
const MAX_LINKS = 10;                               // firestore.rules와 같게

// 옛 게시판(db) → 새 컬렉션. 공지 가운데 [세미나 공지]는 seminars로 가요
const BOARDS = [
  { db: 'notice', page: 'sub01_1', collection: 'notices', label: '공지' },
  { db: 'gallery', page: 'sub01_2', collection: 'news', label: '소식' },
  { db: 'newsletter', page: 'sub06_1', collection: 'newsletters', label: '뉴스레터' },
];

const warnings = [];
const warn = (id, text) => warnings.push(`[${id}] ${text}`);

// ── 옛 서버에서 받기 ──

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const eucKr = new TextDecoder('euc-kr');

// 옛 서버가 막았거나(해외 접속, 트래픽 초과) 받을 양을 다 받으면 더 받지 않아요.
// 그 뒤로는 받아 둔 것만으로 되는 글만 정리해요
class Stop extends Error {}
let stopped = null;
let downloaded = 0;   // 이번에 옛 서버에서 받은 바이트

// 잠깐 끊겨도 세 번까지 다시 받아요
async function get(url, referer = `${SITE}/`) {
  const fromSite = url.startsWith(SITE);
  if (fromSite && stopped) throw stopped;
  if (fromSite && downloaded >= MAX_MB * 1e6) {
    throw (stopped = new Stop(MAX_MB
      ? `이번에 받을 양(${MAX_MB}MB)을 다 받아서 더 받지 않았어요. 옛 홈페이지의 하루 트래픽 한도를 넘지 않게 나눠 받아요.`
      : '옛 서버에서 받지 않고(--max-mb 0) 받아 둔 것만 썼어요.'));
  }
  for (let tries = 1; ; tries++) {
    let status = 0;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer } });
      status = res.status;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (fromSite) downloaded += bytes.length;
      return { type: res.headers.get('content-type') || '', bytes };
    } catch (err) {
      if (tries === 3) {
        const blocked = fromSite && (!status || [403, 429, 503, 509].includes(status));
        if (blocked) throw (stopped = new Stop(`옛 서버가 접속을 막았어요: ${err.message} (${url})`));
        throw new Error(`${err.message} (${url})`);
      }
      await new Promise(r => setTimeout(r, 2000 * tries));
    }
  }
}

// 게시판 화면이 아니면 받은 화면을 .old-board/blocked.html에 두고 멈춰요
async function getBoardPage(url) {
  const html = eucKr.decode((await get(url)).bytes);
  if (!html.includes('bbs-wrap')) {
    writeFileSync(cachePath('blocked.html'), html);
    const text = clean(cheerio.load(html)('body').text()).slice(0, 100);
    throw (stopped = new Stop(`옛 서버가 게시판 대신 다른 화면을 줬어요${text ? `: “${text}”` : ''} (${url})`));
  }
  return html;
}

function cachePath(...parts) {
  const path = join(CACHE, ...parts);
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

async function mapLimit(items, n, fn) {
  const out = [];
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

// 목록을 1쪽부터 넘기며 글 번호를 모아요. 고정 글은 쪽마다 다시 나와서, 새 번호가 없으면 끝이에요.
// 다 모은 목록은 .old-board/lists/에 두고 다음부터는 그것을 써요
async function listPosts(board) {
  const saved = join(CACHE, 'lists', `${board.db}.json`);
  if (existsSync(saved)) {
    const found = new Map(JSON.parse(readFileSync(saved, 'utf8')));
    console.log(`${board.label} 목록 (받아 둔 것), 글 ${found.size}개`);
    return found;
  }
  const found = new Map();   // 옛 번호 → 고정 여부
  for (let page = 1; page <= 200; page++) {
    const $ = cheerio.load(await getBoardPage(`${SITE}/html/${board.page}.html?page=${page}&db=${board.db}`));
    let added = 0;
    $('a[href*="type=read"]').each((_, a) => {
      const id = $(a).attr('href').match(/[?&]id=(\d+)/)?.[1];
      if (!id || found.has(id)) return;
      const pinned = $(a).closest('li').find('.bbs-num').text().includes('[Notice]');
      found.set(id, pinned);
      if (!pinned) added++;
    });
    if (!added) break;
    process.stdout.write(`\r${board.label} 목록 ${page}쪽, 글 ${found.size}개`);
  }
  console.log();
  writeFileSync(cachePath('lists', `${board.db}.json`), JSON.stringify([...found]));
  return found;
}

// ── 글 보기 화면 읽기 ──

const clean = s => s.replace(/\s+/g, ' ').trim();
const BLOCK = new Set(['p', 'div', 'li', 'tr', 'table', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'dl', 'dt', 'dd', 'center', 'section', 'article']);
const CELL = '\u0001';

// 본문 HTML을 새 게시판의 글(줄바꿈 그대로, 빈 줄은 문단)로 바꿔요
function toText($, body) {
  body.find('script, style, .hwp_editor_board_content').remove();   // 한글 편집기가 남긴 데이터
  let out = '';
  const newline = () => { if (out && !out.endsWith('\n')) out += '\n'; };
  const walk = node => {
    if (node.type === 'text') {
      out += node.data.replace(/[ \t\r\n\f]+/g, ' ');
      return;
    }
    if (node.type !== 'tag') return;
    if (node.name === 'br') {
      out += '\n';
      return;
    }
    if (node.name === 'iframe') {   // 동영상 같은 것은 주소만 남겨요
      const src = $(node).attr('src') || '';
      if (/^(https?:)?\/\//.test(src)) out += `\n${src.startsWith('//') ? 'https:' + src : src}\n`;
      return;
    }
    const block = BLOCK.has(node.name);
    if (block) newline();
    node.children.forEach(walk);
    if (node.name === 'a') {
      const href = $(node).attr('href') || '';
      if (/^https?:\/\//i.test(href) && !$(node).text().includes(href)) out += ` (${href})`;
    }
    if (node.name === 'td' || node.name === 'th') out += CELL;
    if (block) out += '\n';
  };
  body.contents().each((_, node) => walk(node));
  return out.replace(/ /g, ' ')
    .split('\n')
    .map(line => line.split(CELL).map(s => s.replace(/ {2,}/g, ' ').trim()).filter(Boolean).join(' | '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseRead(html, db, url) {
  const $ = cheerio.load(html);
  const read = $('.bbs-read');
  if (!read.length) return null;
  const body = read.find('.bbs-read-body');
  // 첨부한 사진은 본문 맨 위에도 보여서(…/notice_file_1723_0.JPG) 첨부 쪽에서만 받아요
  const attachedImage = new RegExp(`/board/data/${db}/${db}_file_\\d+_\\d+\\.`, 'i');
  return {
    title: clean(read.find('.read-title').text()),
    date: read.find('.bbs-read-head').text().match(/\d{4}-\d{2}-\d{2}/)?.[0],
    images: body.find('img').map((_, img) => $(img).attr('src')).get().filter(Boolean)
      .map(src => ({ url: new URL(src, url).href, attached: attachedImage.test(src) })),
    attachments: read.find('.read-file a').map((_, a) => ({ name: clean($(a).text()), url: new URL($(a).attr('href'), url).href })).get(),
    text: toText($, body),
  };
}

// ── 새 게시판에 맞추기 ──

const SEMINAR = /^\[세미나\s*공지\]\s*/;
const HEADS = {
  notices: [[/^\[채용\]\s*/, '채용'], [/^\[기업\s*지원\s*공고\]\s*/, '기업지원'], [/^\[(?:심포지엄|심포지움|셈포지엄)\s*공지\]\s*/, '행사']],
  news: [[/^\[언론\s*보도\]\s*/, '언론 보도'], [/^\[동정\]\s*/, '동정'], [/^\[수상\]\s*/, '수상']],
};

// 제목 머리말을 새 분류로 바꾸고 제목에서는 빼요 (분류 목록은 js/admin-posts.js)
function categorize(collection, title) {
  for (const [re, category] of HEADS[collection] || []) {
    if (re.test(title)) return { category, title: title.replace(re, '') };
  }
  if (collection !== 'notices') return { category: '', title };
  // 공지는 머리말 없는 글이 많아서 제목 낱말로 정해요
  const category = /^\[세포기질연구소\].*(규정|세칙|계획)/.test(title) ? '규정'
    : /수상자 발표|수상작 발표/.test(title) ? '수상'
    : /성료|개최/.test(title) ? '행사'
    : '공지';
  return { category, title };
}

// [세미나 공지] 2026.9.7(월), 김도균 박사(미국 화이자 백신개발부)
// → 날짜는 세미나 날, 본문에서 제목(주제)·장소·시간을 찾아요. 주제를 못 찾으면 연사를 제목으로 써요
function seminar(title, text, postDate) {
  const rest = title.replace(SEMINAR, '');
  const m = rest.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(?:\([^)]*\))?\s*(\d{1,2}:\d{2})?\s*,?\s*(.*)$/);
  const date = m && `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const who = (m?.[5] || rest).trim();
  const line = re => text.match(re)?.[1].trim().slice(0, 200) || '';
  const topic = line(/^[-•·▶■◆○●*\s]*(?:제\s*목|주\s*제|연\s*제|Title)\s*[:：]\s*(.+)$/im);
  const place = line(/^[-•·▶■◆○●*\s]*(?:장\s*소|Place|Venue)\s*[:：]\s*(.+)$/im);
  const time = m?.[4] || text.match(/(?:일\s*시|시\s*간|Time)\s*[:：][^\n]*?(\d{1,2}:\d{2})/i)?.[1] || '';
  const split = who.match(/^([^(),]+?)\s*\(([^()]+)\)$/);   // 김도균 박사(소속) 꼴일 때만 나눠요
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : postDate,
    title: topic || who,
    speaker: topic ? (split ? split[1] : who) : '',
    affiliation: topic && split ? split[2] : '',
    time,
    place,
  };
}

// ── 첨부·사진 ──

const TYPES = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.hwp': 'application/x-hwp', '.hwpx': 'application/hwp+zip', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip', '.txt': 'text/plain',
};
const typeOf = path => TYPES[extname(path).toLowerCase()] || 'application/octet-stream';
function imageExt(url) {
  const ext = url.startsWith('data:')
    ? `.${url.slice(11, url.indexOf(';')).replace('jpeg', 'jpg')}`
    : extname(new URL(url).pathname).toLowerCase();
  return /^\.(jpe?g|png|gif|bmp|webp)$/.test(ext) ? ext : '.jpg';
}

// 파일 하나를 .old-board/files/에 받아 둬요. 못 받으면 null
async function download(id, key, url, referer) {
  const path = cachePath('files', id, key);
  if (existsSync(path)) return path;
  try {
    let bytes;
    if (url.startsWith('data:')) {
      bytes = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    } else {
      const res = await get(url, referer);
      // 파일이 없으면 옛 서버가 오류 웹페이지를 돌려줘요. 서버가 막힌 것이면 목록도 안 열려서 멈춰요
      if (res.type.includes('text/html')) {
        if (url.startsWith(SITE)) await getBoardPage(`${SITE}/html/${BOARDS[0].page}.html?db=${BOARDS[0].db}`);
        throw new Error('파일 대신 웹페이지가 왔어요');
      }
      bytes = res.bytes;
    }
    if (!bytes.length) throw new Error('빈 파일이에요');
    writeFileSync(path, bytes);
    return path;
  } catch (err) {
    if (err instanceof Stop) throw err;
    warn(id, `파일을 받지 못했어요: ${err.message}`);
    return null;
  }
}

// 사진을 A4 너비 쪽에 한 장씩 넣어요. 같은 사진이 두 번 있으면 한 번만
async function imagesToPdf(id, key, paths) {
  const pdf = await PDFDocument.create();
  const seen = new Set();
  for (const path of paths) {
    const bytes = readFileSync(path);
    const hash = createHash('sha1').update(bytes).digest('hex');
    if (seen.has(hash)) continue;
    seen.add(hash);
    let image;
    try {
      image = bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    } catch {
      warn(id, `PDF에 넣지 못한 사진이 있어요 (JPG·PNG만 돼요): ${relative(CACHE, path)}`);
      continue;
    }
    const width = 595;
    const height = (width * image.height) / image.width;
    pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  }
  if (!pdf.getPageCount()) return null;
  const out = cachePath('files', id, key);
  writeFileSync(out, await pdf.save());
  return out;
}

// 공지·소식: 첨부는 그대로, 본문에만 있는 사진도 첨부로 붙여요. 합쳐서 10개가 넘으면 사진을 PDF 하나로 묶어요
async function postFiles(id, read, referer) {
  const files = [];
  for (const [i, a] of read.attachments.entries()) {
    const path = await download(id, `a${i}${extname(a.name).toLowerCase()}`, a.url, referer);
    files.push(path ? { label: a.name, path } : { label: a.name, url: a.url });
  }
  const images = [];
  for (const [i, img] of read.images.filter(img => !img.attached).entries()) {
    const ext = imageExt(img.url);
    const path = await download(id, `i${i}${ext}`, img.url, referer);
    images.push(path ? { label: `본문 이미지 ${i + 1}${ext}`, path } : { label: `본문 이미지 ${i + 1}`, url: img.url });
  }
  if (files.length + images.length <= MAX_LINKS) return [...files, ...images];
  const pdf = await imagesToPdf(id, 'images.pdf', images.filter(f => f.path).map(f => f.path));
  const room = pdf ? MAX_LINKS - 1 : MAX_LINKS;
  if (files.length > room) warn(id, `첨부가 ${files.length}개라 앞의 ${room}개만 옮겨요`);
  return [...files.slice(0, room), ...(pdf ? [{ label: '본문 이미지 모음.pdf', path: pdf }] : [])];
}

// 뉴스레터: 본문의 쪽 이미지를 차례대로 PDF 하나로 묶어요 (새 사이트는 뉴스레터를 누르면 첫 첨부(PDF)를 바로 열어요)
async function newsletterFiles(id, read, referer, title) {
  const attachedPdf = read.attachments.find(a => /\.pdf$/i.test(a.name));
  if (attachedPdf) {
    const path = await download(id, 'a.pdf', attachedPdf.url, referer);
    if (path) return [{ label: attachedPdf.name, path }];
  }
  const pages = [];
  for (const [i, img] of read.images.entries()) {
    const path = await download(id, `i${i}${imageExt(img.url)}`, img.url, referer);
    if (path) pages.push(path);
  }
  const pdf = await imagesToPdf(id, 'newsletter.pdf', pages);
  if (pdf) return [{ label: `${title}.pdf`, path: pdf }];
  warn(id, '뉴스레터 쪽 이미지가 없어서 첨부만 옮겨요');
  return postFiles(id, read, referer);
}

async function preparePost(board, oldId, pinned) {
  const id = `old-${oldId}`;
  const url = `${SITE}/html/${board.page}.html?id=${oldId}&type=read&db=${board.db}`;
  const pagePath = cachePath('pages', `${board.db}-${oldId}.html`);
  let html = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';
  if (!html.includes('bbs-read')) {   // 처음이거나, 지난번에 글 대신 다른 화면을 받아 둔 것
    html = await getBoardPage(url);
    writeFileSync(pagePath, html);
  }
  const read = parseRead(html, board.db, url);
  if (!read?.title || !read.date) {
    warn(id, `글을 읽지 못해서 건너뛰어요 (${url})`);
    return null;
  }
  let collection = board.collection;
  let data = { title: read.title, category: '', date: read.date, body: read.text, pinned: false };
  if (board.db === 'notice' && SEMINAR.test(read.title)) {
    collection = 'seminars';
    data = { ...data, ...seminar(read.title, read.text, read.date) };
  } else {
    data = { ...data, ...categorize(collection, read.title), pinned: collection === 'notices' && pinned };
  }
  data.title = data.title.slice(0, 200);
  data.body = data.body.slice(0, 50000);
  const files = board.db === 'newsletter' ? await newsletterFiles(id, read, url, data.title) : await postFiles(id, read, url);
  return { id, collection, source: url, data, files };
}

// ── 새 사이트에 올리기 ──

// Storage에 올리고 누구나 열 수 있는 주소(다운로드 토큰)를 돌려줘요. 같은 크기 파일이 이미 있으면 다시 올리지 않아요
async function put(bucket, dest, f) {
  const file = bucket.file(dest);
  const [exists] = await file.exists();
  let token;
  if (exists) {
    const [meta] = await file.getMetadata();
    if (Number(meta.size) === statSync(f.path).size) token = meta.metadata?.firebaseStorageDownloadTokens?.split(',')[0];
  }
  if (!token) {
    token = randomUUID();
    await bucket.upload(f.path, {
      destination: dest,
      metadata: {
        contentType: typeOf(f.path),
        contentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(f.label)}`,
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
  }
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(dest)}?alt=media&token=${token}`;
}

async function upload(posts) {
  if (!existsSync(KEY)) throw new Error(`서비스 계정 키가 없어요: ${KEY}\nREADME의 '옛 홈페이지 글 옮기기'를 봐 주세요.`);
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const { getStorage } = await import('firebase-admin/storage');
  initializeApp({ credential: cert(JSON.parse(readFileSync(KEY, 'utf8'))), storageBucket: BUCKET });
  const db = getFirestore();
  const bucket = getStorage().bucket();

  // 관리자가 이미 손으로 올린 글(날짜·제목이 같은 글)은 건너뛰어요
  const existing = new Set();
  for (const collection of new Set(posts.map(p => p.collection))) {
    const snap = await db.collection(collection).get();
    snap.docs.filter(d => !d.id.startsWith('old-')).forEach(d => existing.add(`${collection}|${d.get('date')}|${d.get('title')}`));
  }
  let done = 0;
  let skipped = 0;
  await mapLimit(posts, 4, async post => {
    if (existing.has(`${post.collection}|${post.data.date}|${post.data.title}`)) {
      skipped++;
      warn(post.id, `새 사이트에 이미 있는 글이라 건너뛰었어요: ${post.data.title}`);
      return;
    }
    const links = [];
    for (const [i, f] of post.files.entries()) {
      links.push({ label: f.label, url: f.path ? await put(bucket, `old-board/${post.id}/${i}${extname(f.path)}`, f) : f.url });
    }
    await db.collection(post.collection).doc(post.id).set({
      ...post.data, links, updatedAt: FieldValue.serverTimestamp(), updatedBy: 'cmri.knu.ac.kr에서 옮김',
    });
    process.stdout.write(`\r올리는 중 ${++done + skipped}/${posts.length}`);
  });
  console.log(`\n올렸어요. 글 ${done}개${skipped ? `, 이미 있어서 건너뛴 글 ${skipped}개` : ''}.`);
}

// ── 실행 ──

const NAMES = { notices: '공지사항', seminars: '세미나', news: '연구소 소식', newsletters: '뉴스레터' };

function summary(posts) {
  console.log('\n옮길 글');
  for (const [collection, name] of Object.entries(NAMES)) {
    const list = posts.filter(p => p.collection === collection);
    if (!list.length) continue;
    const tally = new Map();
    list.forEach(p => tally.set(p.data.category || '분류 없음', (tally.get(p.data.category || '분류 없음') || 0) + 1));
    const detail = collection === 'seminars'
      ? `주제를 찾은 글 ${list.filter(p => p.data.speaker).length}개`
      : collection === 'newsletters' ? ''
      : [...tally].map(([c, n]) => `${c} ${n}`).join(' · ');
    const pinned = list.filter(p => p.data.pinned).length;
    console.log(`  ${name} ${list.length}개${detail ? ` — ${detail}` : ''}${pinned ? ` (고정 ${pinned})` : ''}`);
  }
  const files = posts.flatMap(p => p.files.filter(f => f.path));
  const mb = files.reduce((n, f) => n + statSync(f.path).size, 0) / 1e6;
  console.log(`  파일 ${files.length}개, 모두 ${mb.toFixed(1)}MB`);
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const posts = [];
  let waiting = 0;        // 더 받아야 해서 다음으로 미룬 글
  const unlisted = [];    // 목록을 못 받은 게시판
  for (const board of BOARDS) {
    const ids = await listPosts(board).catch(err => {
      if (err instanceof Stop) return null;
      throw err;
    });
    if (!ids) {
      unlisted.push(board.label);
      continue;
    }
    let done = 0;
    const prepared = await mapLimit([...ids], 2, async ([oldId, pinned]) => {
      const post = await preparePost(board, oldId, pinned).catch(err => {
        if (err instanceof Stop) waiting++;
        else warn(`old-${oldId}`, err.message);
        return null;
      });
      process.stdout.write(`\r${board.label} 글 ${++done}/${ids.size}`);
      return post;
    });
    console.log();
    posts.push(...prepared.filter(Boolean));
  }
  if (stopped) {
    console.log(`\n${stopped.message}
받아 둔 것만으로 되는 글까지 정리했어요. 남은 것(${[waiting && `글 ${waiting}개`, ...unlisted.map(b => `${b} 목록`)].filter(Boolean).join(', ')})은 다음 날 다시 돌리면 이어서 받아요.
(옛 서버가 막혔으면 브라우저로 http://cmri.knu.ac.kr 이 열릴 때 다시 돌려요. 해외 인터넷이면 국내 인터넷에서 돌려야 해요.)`);
  }
  writeFileSync(join(CACHE, 'preview.json'), JSON.stringify(posts.map(p => ({
    ...p, files: p.files.map(f => ({ label: f.label, ...(f.path ? { file: relative(CACHE, f.path) } : { url: f.url }) })),
  })), null, 2));
  summary(posts);
  console.log(`  이번에 옛 서버에서 받은 양 ${(downloaded / 1e6).toFixed(1)}MB`);
  if (UPLOAD && !posts.length) throw new Error('옮길 글이 하나도 없어서 올리지 않았어요.');
  if (UPLOAD) await upload(posts);
  else console.log('\n미리보기만 했어요. tools/.old-board/preview.json을 확인하고, 괜찮으면 --upload를 붙여 다시 돌려요.');
  saveWarnings();
}

function saveWarnings() {
  if (!warnings.length) return;
  writeFileSync(join(CACHE, 'warnings.txt'), warnings.join('\n') + '\n');
  console.log(`확인할 것 ${warnings.length}개 → tools/.old-board/warnings.txt`);
}

main().catch(err => {
  console.error(`\n${err.message}`);
  saveWarnings();
  process.exit(1);
});
