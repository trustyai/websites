/**
 * V槽 CMS — 后端服务
 * 负责：静态资源托管 / 登录鉴权 / 内容读写 API / 文件上传
 * 数据全部存放在 data/ 与 public/uploads/，无需数据库。
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const DEFAULT_CONTENT_FILE = path.join(DATA_DIR, 'content.default.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// 询盘跟进状态
const LEAD_STATUSES = ['new', 'following', 'replied', 'won', 'closed'];
const LEAD_STATUS_LABEL = { new: '未处理', following: '跟进中', replied: '已回复', won: '已成交', closed: '已关闭' };

const DEFAULT_USER = 'admin';
const DEFAULT_PASS = 'admin123';

const STATS_FILE = path.join(DATA_DIR, 'stats.json');

// 图片压缩库（可选，装不上也不影响上传）
let Jimp = null;
try { Jimp = require('jimp'); } catch (e) { /* 未安装则跳过压缩 */ }
// 邮件库（可选，装不上也不影响其它功能）
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (e) { /* 未安装则跳过邮件 */ }

// ---------- 初始化数据文件 ----------
function ensureDirs() {
  [DATA_DIR, UPLOAD_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

function initContent() {
  if (!fs.existsSync(CONTENT_FILE)) {
    const def = readJson(DEFAULT_CONTENT_FILE, {});
    writeJson(CONTENT_FILE, def);
  }
}

function defaultAdmin() {
  return { id: 'u_admin', username: DEFAULT_USER, name: '管理员', role: 'admin', status: 'active', passwordHash: bcrypt.hashSync(DEFAULT_PASS, 10), createdAt: Date.now() };
}
function initConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    writeJson(CONFIG_FILE, { users: [defaultAdmin()] });
    return;
  }
  // 迁移旧的单账号格式 -> users 数组
  const cfg = readJson(CONFIG_FILE, {});
  if (!Array.isArray(cfg.users)) {
    cfg.users = [{ id: 'u_admin', username: cfg.username || DEFAULT_USER, name: '管理员', role: 'admin', status: 'active', passwordHash: cfg.passwordHash || bcrypt.hashSync(DEFAULT_PASS, 10), createdAt: Date.now() }];
    delete cfg.username; delete cfg.passwordHash;
    writeJson(CONFIG_FILE, cfg);
  }
}
function readUsers() { const c = readJson(CONFIG_FILE, {}); return Array.isArray(c.users) ? c.users : []; }
function writeUsers(users) { const c = readJson(CONFIG_FILE, {}); c.users = users; writeJson(CONFIG_FILE, c); }

ensureDirs();
initContent();
initConfig();

// ---------- 会话（内存 token） ----------
const sessions = new Map(); // token -> { exp, user }
const SESSION_TTL = 1000 * 60 * 60 * 12; // 12 小时

function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { exp: Date.now() + SESSION_TTL, user });
  return token;
}
function getSession(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.exp) { sessions.delete(token); return null; }
  return s;
}
function isValidSession(token) { return !!getSession(token); }
function sessionUser(req) { const s = getSession(req.cookies && req.cookies.vg_token); return s ? s.user : null; }

function requireAuth(req, res, next) {
  const u = sessionUser(req);
  if (u) { req.user = u; return next(); }
  return res.status(401).json({ error: '未登录或登录已过期' });
}
function requireAdmin(req, res, next) {
  const u = sessionUser(req);
  if (u && u.role === 'admin') { req.user = u; return next(); }
  return res.status(403).json({ error: '需要管理员权限' });
}

// ---------- 中间件 ----------
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// ---------- 上传 ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});
const ALLOWED = /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov)$/i;
const upload = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 }, // 300MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.test(file.originalname)) cb(null, true);
    else cb(new Error('不支持的文件类型'));
  },
});

// ---------- 认证 API ----------
function pubUser(u) { return { id: u.id, username: u.username, name: u.name, role: u.role, status: u.status, createdAt: u.createdAt }; }

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const users = readUsers();
  const u = users.find((x) => x.username === username);
  if (!u || u.status === 'disabled' || !bcrypt.compareSync(String(password || ''), u.passwordHash || '')) {
    return res.status(401).json({ error: '账号或密码错误（或已停用）' });
  }
  const su = { id: u.id, username: u.username, name: u.name, role: u.role };
  const token = createSession(su);
  res.cookie('vg_token', token, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_TTL });
  res.json({ ok: true, user: su });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies && req.cookies.vg_token;
  if (token) sessions.delete(token);
  res.clearCookie('vg_token');
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  const u = sessionUser(req);
  res.json({ authed: !!u, user: u || null });
});

app.post('/api/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  const users = readUsers();
  const u = users.find((x) => x.id === req.user.id);
  if (!u || !bcrypt.compareSync(String(current || ''), u.passwordHash || '')) {
    return res.status(400).json({ error: '当前密码不正确' });
  }
  if (!next || String(next).length < 6) return res.status(400).json({ error: '新密码至少 6 位' });
  u.passwordHash = bcrypt.hashSync(String(next), 10);
  writeUsers(users);
  res.json({ ok: true });
});

// ---------- 账号管理 API（仅管理员） ----------
app.get('/api/users', requireAdmin, (req, res) => {
  res.json({ users: readUsers().map(pubUser) });
});
app.post('/api/users', requireAdmin, (req, res) => {
  const b = req.body || {};
  const users = readUsers();
  const username = String(b.username || '').trim();
  const role = ['admin', 'sales', 'editor'].indexOf(b.role) > -1 ? b.role : 'sales';
  if (!username) return res.status(400).json({ error: '请填写账号名（邮箱）' });
  let u = b.id ? users.find((x) => x.id === b.id) : null;
  if (users.find((x) => x.username === username && (!u || x.id !== u.id))) return res.status(400).json({ error: '账号名已存在' });
  if (u) {
    u.username = username; u.name = String(b.name || '').trim() || username; u.role = role; u.status = b.status === 'disabled' ? 'disabled' : 'active';
    if (b.password) { if (String(b.password).length < 6) return res.status(400).json({ error: '密码至少 6 位' }); u.passwordHash = bcrypt.hashSync(String(b.password), 10); }
  } else {
    if (!b.password || String(b.password).length < 6) return res.status(400).json({ error: '新账号密码至少 6 位' });
    u = { id: 'u_' + crypto.randomBytes(5).toString('hex'), username, name: String(b.name || '').trim() || username, role, status: b.status === 'disabled' ? 'disabled' : 'active', passwordHash: bcrypt.hashSync(String(b.password), 10), createdAt: Date.now() };
    users.push(u);
  }
  writeUsers(users);
  res.json({ ok: true, user: pubUser(u) });
});
app.delete('/api/users', requireAdmin, (req, res) => {
  const id = req.body && req.body.id;
  let users = readUsers();
  const u = users.find((x) => x.id === id);
  if (!u) return res.status(404).json({ error: '账号不存在' });
  if (u.id === req.user.id) return res.status(400).json({ error: '不能删除当前登录账号' });
  if (u.role === 'admin' && users.filter((x) => x.role === 'admin').length <= 1) return res.status(400).json({ error: '至少保留一个管理员' });
  users = users.filter((x) => x.id !== id);
  writeUsers(users);
  res.json({ ok: true });
});

// ---------- 内容 API ----------
// 公开接口：剥离 settings（含 Webhook/SMTP 密码等敏感信息），前台用不到
app.get('/api/content', (req, res) => {
  const c = JSON.parse(JSON.stringify(readJson(CONTENT_FILE, {})));
  delete c.settings;
  // 前台不展示已软删除的产品
  Object.values(c.i18n || {}).forEach((L) => { if (Array.isArray(L.products)) L.products = L.products.filter((p) => !p.deleted); });
  res.json(c);
});

// 业务员只能看到/编辑自己负责的产品；管理员与制作员看全部
function isSales(user) { return user && user.role === 'sales'; }
function filterContentForUser(content, user) {
  if (!isSales(user)) return content;
  const c = JSON.parse(JSON.stringify(content || {}));
  Object.values(c.i18n || {}).forEach((L) => {
    if (Array.isArray(L.products)) L.products = L.products.filter((p) => p.owner === user.id);
  });
  return c;
}
function mergeContentFromUser(stored, incoming, user) {
  if (!isSales(user)) return incoming; // 管理员/制作员：整体保存
  // 业务员：仅合并本人产品，其他人产品与全局内容保持不变
  const result = JSON.parse(JSON.stringify(stored || {}));
  result.i18n = result.i18n || {};
  Object.keys((incoming && incoming.i18n) || {}).forEach((code) => {
    const inL = incoming.i18n[code] || {};
    const stL = result.i18n[code] = result.i18n[code] || {};
    const others = (stL.products || []).filter((p) => p.owner !== user.id);
    const otherIds = new Set(others.map((p) => p.id));
    const mine = (inL.products || []).filter((p) => !otherIds.has(p.id)).map((p) => Object.assign({}, p, { owner: user.id }));
    stL.products = others.concat(mine);
  });
  return result;
}

// 后台接口：返回完整内容（含 settings），需登录；业务员仅返回自己的产品
app.get('/api/admin/content', requireAuth, (req, res) => {
  res.json(filterContentForUser(readJson(CONTENT_FILE, {}), req.user));
});

app.post('/api/content', requireAuth, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: '数据格式错误' });
  }
  const merged = mergeContentFromUser(readJson(CONTENT_FILE, {}), body, req.user);
  writeJson(CONTENT_FILE, merged);
  res.json({ ok: true });
});

// 图片压缩/限宽（超过 1600px 缩小，jpg/png 重新编码；失败则保留原图）
const MAX_W = 1600;
async function compressImage(filePath, ext) {
  if (!Jimp || !/\.(jpg|jpeg|png)$/i.test(ext)) return;
  try {
    const img = await Jimp.read(filePath);
    let changed = false;
    if (img.bitmap.width > MAX_W) {
      // 兼容 jimp v0.x 与 v1.x 两种 resize 签名
      try { img.resize(MAX_W, Jimp.AUTO); } catch (e) { img.resize({ w: MAX_W }); }
      changed = true;
    }
    if (typeof img.quality === 'function') img.quality(82);
    if (changed || /\.(jpg|jpeg)$/i.test(ext)) {
      if (typeof img.writeAsync === 'function') await img.writeAsync(filePath);
      else await img.write(filePath);
    }
  } catch (e) { /* 压缩失败保留原文件 */ }
}

// ---------- 文件上传 API ----------
app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: '未收到文件' });
    const ext = path.extname(req.file.filename).toLowerCase();
    const type = /\.(mp4|webm|mov)$/i.test(ext) ? 'video' : 'image';
    if (type === 'image') await compressImage(path.join(UPLOAD_DIR, req.file.filename), ext);
    res.json({ ok: true, url: `/uploads/${req.file.filename}`, type });
  });
});

// ---------- 媒体库 ----------
app.get('/api/uploads', requireAuth, (req, res) => {
  let files = [];
  try {
    files = fs.readdirSync(UPLOAD_DIR)
      .filter((f) => !f.startsWith('.'))
      .map((f) => {
        const st = fs.statSync(path.join(UPLOAD_DIR, f));
        const ext = path.extname(f).toLowerCase();
        return {
          name: f,
          url: '/uploads/' + f,
          type: /\.(mp4|webm|mov)$/i.test(ext) ? 'video' : 'image',
          size: st.size,
          mtime: st.mtimeMs,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
  } catch (e) { /* 目录不存在时返回空 */ }
  res.json({ files });
});

app.delete('/api/uploads', requireAuth, (req, res) => {
  const name = req.body && req.body.name;
  if (!name || name.indexOf('/') > -1 || name.indexOf('..') > -1) {
    return res.status(400).json({ error: '非法文件名' });
  }
  const p = path.join(UPLOAD_DIR, name);
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '删除失败' });
  }
});

// ---------- 询价线索 API ----------
function readLeads() { return readJson(LEADS_FILE, []); }
const leadRate = new Map(); // ip -> [timestamps]
function rateOk(ip) {
  const now = Date.now();
  const arr = (leadRate.get(ip) || []).filter((t) => now - t < 60000);
  if (arr.length >= 5) return false;
  arr.push(now); leadRate.set(ip, arr); return true;
}
async function notifyWebhook(lead) {
  const settings = (readJson(CONTENT_FILE, {}).settings) || {};
  const url = settings.notifyWebhook;
  if (!url || typeof fetch !== 'function') return;
  const text = `【新询价】\n姓名：${lead.name || '-'}\n邮箱：${lead.email || '-'}\n公司：${lead.company || '-'}\n语言：${lead.lang || '-'}\n内容：${lead.message || '-'}`;
  const payloads = [
    { msgtype: 'text', text: { content: text } }, // 企业微信/钉钉群机器人
    { text }, // Slack/飞书 简单格式
  ];
  try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloads[0]) }); }
  catch (e) { /* 通知失败不影响主流程 */ }
}
function smtpSettings() {
  return ((readJson(CONTENT_FILE, {}).settings) || {}).smtp || {};
}
function createMailer() {
  if (!nodemailer) return null;
  const s = smtpSettings();
  if (!s.host) return null;
  return {
    settings: s,
    transporter: nodemailer.createTransport({
      host: s.host, port: Number(s.port) || 465, secure: s.secure !== false && Number(s.port) !== 587,
      auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    }),
  };
}
async function sendLeadEmail(lead) {
  const mail = createMailer();
  if (!mail || !mail.settings.to) return;
  try {
    const html = `<h3>新的询价 / 留言</h3><ul>
      <li>姓名：${escHtml(lead.name)}</li><li>邮箱：${escHtml(lead.email)}</li>
      <li>公司：${escHtml(lead.company)}</li><li>语言：${escHtml(lead.lang)}</li>
      <li>页面：${escHtml(lead.page)}</li></ul><p>${escHtml(lead.message).replace(/\n/g, '<br>')}</p>`;
    await mail.transporter.sendMail({
      from: mail.settings.from || mail.settings.user, to: mail.settings.to,
      subject: '【网站询价】' + (lead.name || lead.email || '新留言'),
      replyTo: lead.email || undefined, html,
    });
  } catch (e) { /* 邮件失败不影响主流程 */ }
}
/** 业务员回复买家：发到询盘邮箱，Reply-To 为 SMTP 收件邮箱便于买家继续回复 */
async function sendLeadReplyEmail(lead, replyText, agentName) {
  const mail = createMailer();
  if (!mail) return { ok: false, error: '未安装 nodemailer 或未配置 SMTP' };
  if (!lead.email) return { ok: false, error: '该询盘没有买家邮箱' };
  try {
    const brand = (((readJson(CONTENT_FILE, {}).i18n || {}).zh || {}).brandName) || 'V槽PRO';
    const html = `<p>${escHtml(agentName || '客服')} 回复了您的询盘：</p>
      <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#333">${escHtml(replyText).replace(/\n/g, '<br>')}</blockquote>
      <hr><p style="color:#888;font-size:12px">原始留言：${escHtml(lead.message || '').replace(/\n/g, '<br>')}</p>
      <p style="color:#888;font-size:12px">— ${escHtml(brand)}</p>`;
    await mail.transporter.sendMail({
      from: mail.settings.from || mail.settings.user,
      to: lead.email,
      replyTo: mail.settings.to || mail.settings.from || mail.settings.user,
      subject: 'Re: 【' + brand + '】' + (lead.product ? lead.product + ' - ' : '') + '询盘回复',
      html,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) || '发送失败' };
  }
}
function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function userNameById(id) {
  if (!id) return '';
  const u = readUsers().find((x) => x.id === id);
  return u ? (u.name || u.username) : '';
}
const LEAD_SOURCES = { form: '表单询盘', chat: '智能询盘', product: '产品询盘' };
const LANG_REGION = { zh: '中国/中文', en: 'English', es: 'Español', ko: '한국어', ar: 'العربية', tr: 'Türkçe' };

function resolveProductMeta(page, lang, hint) {
  const content = readJson(CONTENT_FILE, {});
  let slug = String((hint && hint.productSlug) || '');
  if (!slug) {
    const m = String(page || '').match(/\/products\/([^/?#]+)/);
    if (m) slug = decodeURIComponent(m[1]).replace(/\.html?$/i, '');
  }
  if (!slug) {
    return {
      owner: '', product: String((hint && hint.productName) || ''), productSlug: '',
      productImage: String((hint && hint.productImage) || ''), productPrice: String((hint && hint.productPrice) || ''),
    };
  }
  const codes = [lang, content.defaultLang || 'zh'].concat(Object.keys(content.i18n || {}));
  for (const code of codes) {
    const p = (((content.i18n || {})[code] || {}).products || []).find((x) => (x.slug || x.id) === slug);
    if (p) {
      let img = '';
      if (p.cardImage) img = p.cardImage;
      else if (p.gallery && p.gallery[0] && p.gallery[0].src) img = p.gallery[0].src;
      return {
        owner: p.owner || '',
        product: p.name || slug,
        productSlug: slug,
        productImage: img,
        productPrice: (p.price && (p.price.main || p.price.usd)) || '',
      };
    }
  }
  return {
    owner: '', product: String((hint && hint.productName) || slug), productSlug: slug,
    productImage: String((hint && hint.productImage) || ''), productPrice: String((hint && hint.productPrice) || ''),
  };
}

app.post('/api/leads', (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // 蜜罐：机器人填了隐藏字段，静默丢弃
  const ip = (req.ip || '').replace(/^::ffff:/, '');
  if (!rateOk(ip)) return res.status(429).json({ error: '提交过于频繁，请稍后再试' });
  const name = String(b.name || '').slice(0, 100).trim();
  const message = String(b.message || '').slice(0, 3000).trim();
  if (!name && !b.email && !b.phone) return res.status(400).json({ error: '请至少填写姓名、邮箱或电话' });
  const lang = String(b.lang || '').slice(0, 8);
  const page = String(b.page || '').slice(0, 300);
  const meta = resolveProductMeta(page, lang, b);
  const source = ['form', 'chat', 'product'].indexOf(b.source) > -1 ? b.source : (meta.productSlug ? 'product' : 'form');
  const lead = {
    id: crypto.randomBytes(8).toString('hex'),
    source,
    title: String(b.title || (meta.product ? ('询盘：' + meta.product) : '网站询盘')).slice(0, 200),
    name, email: String(b.email || '').slice(0, 160).trim(),
    phone: String(b.phone || '').slice(0, 40).trim(),
    company: String(b.company || '').slice(0, 160).trim(),
    country: String(b.country || LANG_REGION[lang] || lang || '').slice(0, 80),
    message, lang, page,
    owner: meta.owner, product: meta.product, productSlug: meta.productSlug,
    productImage: meta.productImage, productPrice: meta.productPrice,
    chatId: '', sessionId: '',
    time: Date.now(), read: false, ip,
    status: 'new', replies: [], note: '', lastReplyAt: 0, updatedAt: Date.now(),
  };
  const leads = readLeads(); leads.unshift(lead); writeJson(LEADS_FILE, leads);
  notifyWebhook(lead);
  sendLeadEmail(lead);
  res.json({ ok: true, id: lead.id });
});
// 询盘可见性：管理员全部；业务员仅自己负责；制作员无（只发布产品）
function leadsForUser(user) {
  const leads = readLeads();
  if (user.role === 'admin') return leads;
  if (user.role === 'sales') return leads.filter((l) => l.owner === user.id);
  return []; // editor / 其它
}
function canTouchLead(user, lead) {
  if (!lead) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'sales') return lead.owner === user.id;
  return false;
}
function normalizeLead(l) {
  if (!l) return l;
  if (!l.status || LEAD_STATUSES.indexOf(l.status) < 0) l.status = l.read ? 'following' : 'new';
  if (!Array.isArray(l.replies)) l.replies = [];
  if (l.note == null) l.note = '';
  if (!l.lastReplyAt) l.lastReplyAt = 0;
  if (!l.updatedAt) l.updatedAt = l.time || Date.now();
  if (!l.source) l.source = l.sessionId || l.chatId ? 'chat' : (l.productSlug || (l.page || '').indexOf('/products/') > -1 ? 'product' : 'form');
  if (!l.title) {
    if (l.source === 'chat') l.title = l.product ? ('Chat about ' + l.product) : '在线客服咨询';
    else l.title = l.product ? ('询盘：' + l.product) : ((l.message || '').slice(0, 40) || '网站询盘');
  }
  if (l.phone == null) l.phone = '';
  if (l.country == null) l.country = LANG_REGION[l.lang] || l.lang || '';
  if (l.productImage == null) l.productImage = '';
  if (l.productPrice == null) l.productPrice = '';
  if (l.chatId == null) l.chatId = '';
  if (l.sessionId == null) l.sessionId = '';
  l.sourceLabel = LEAD_SOURCES[l.source] || l.source;
  return l;
}
app.get('/api/leads', requireAuth, (req, res) => {
  res.json({ leads: leadsForUser(req.user).map(normalizeLead), statuses: LEAD_STATUS_LABEL, sources: LEAD_SOURCES });
});
app.post('/api/leads/read', requireAuth, (req, res) => {
  const leads = readLeads();
  const it = leads.find((l) => l.id === (req.body && req.body.id));
  if (it && canTouchLead(req.user, it)) { it.read = !!(req.body.read); it.updatedAt = Date.now(); writeJson(LEADS_FILE, leads); }
  res.json({ ok: true });
});
app.post('/api/leads/status', requireAuth, (req, res) => {
  const leads = readLeads();
  const it = leads.find((l) => l.id === (req.body && req.body.id));
  if (!it || !canTouchLead(req.user, it)) return res.status(403).json({ error: '无权限' });
  const st = String((req.body && req.body.status) || '');
  if (LEAD_STATUSES.indexOf(st) < 0) return res.status(400).json({ error: '无效状态' });
  it.status = st;
  if (st !== 'new') it.read = true;
  if (req.body && typeof req.body.note === 'string') it.note = String(req.body.note).slice(0, 2000);
  it.updatedAt = Date.now();
  writeJson(LEADS_FILE, leads);
  res.json({ ok: true, lead: normalizeLead(it) });
});
app.post('/api/leads/reply', requireAuth, async (req, res) => {
  const leads = readLeads();
  const it = leads.find((l) => l.id === (req.body && req.body.id));
  if (!it || !canTouchLead(req.user, it)) return res.status(403).json({ error: '无权限' });
  const text = String((req.body && req.body.text) || '').trim().slice(0, 5000);
  if (!text) return res.status(400).json({ error: '请填写回复内容' });
  const sendEmail = !!(req.body && req.body.sendEmail);
  const reply = {
    id: crypto.randomBytes(6).toString('hex'),
    text, by: req.user.id, byName: req.user.name || req.user.username,
    time: Date.now(), emailed: false, emailError: '',
  };
  if (sendEmail) {
    const r = await sendLeadReplyEmail(it, text, reply.byName);
    reply.emailed = !!r.ok;
    reply.emailError = r.ok ? '' : (r.error || '发送失败');
  }
  normalizeLead(it);
  it.replies.push(reply);
  it.lastReplyAt = reply.time;
  it.updatedAt = reply.time;
  it.read = true;
  if (it.status === 'new' || it.status === 'following') it.status = 'replied';
  writeJson(LEADS_FILE, leads);
  res.json({ ok: true, lead: it, reply, emailSent: reply.emailed, emailError: reply.emailError || undefined });
});
app.post('/api/leads/assign', requireAdmin, (req, res) => {
  const leads = readLeads();
  const it = leads.find((l) => l.id === (req.body && req.body.id));
  if (it) { it.owner = String((req.body && req.body.owner) || ''); it.updatedAt = Date.now(); writeJson(LEADS_FILE, leads); }
  res.json({ ok: true });
});
app.delete('/api/leads', requireAuth, (req, res) => {
  let leads = readLeads();
  if (req.body && req.body.all) { if (req.user.role !== 'admin') return res.status(403).json({ error: '无权限' }); leads = []; }
  else { const it = leads.find((l) => l.id === (req.body && req.body.id)); if (it && !canTouchLead(req.user, it)) return res.status(403).json({ error: '无权限' }); leads = leads.filter((l) => l.id !== (req.body && req.body.id)); }
  writeJson(LEADS_FILE, leads); res.json({ ok: true });
});
/** 业务员维度商机统计（管理员看全部，业务员只看自己） */
app.get('/api/leads/stats', requireAuth, (req, res) => {
  if (req.user.role === 'editor') return res.status(403).json({ error: '无权限' });
  const leads = leadsForUser(req.user).map(normalizeLead);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const ms = monthStart.getTime();
  const bucket = {};
  function ensure(id) {
    const key = id || '_unassigned';
    if (!bucket[key]) {
      bucket[key] = {
        ownerId: id || '', ownerName: id ? (userNameById(id) || id) : '未分配',
        total: 0, unread: 0, thisMonth: 0, replied: 0, won: 0,
        byStatus: { new: 0, following: 0, replied: 0, won: 0, closed: 0 },
      };
    }
    return bucket[key];
  }
  leads.forEach((l) => {
    const b = ensure(l.owner || '');
    b.total += 1;
    if (!l.read) b.unread += 1;
    if ((l.time || 0) >= ms) b.thisMonth += 1;
    const st = l.status || 'new';
    if (b.byStatus[st] != null) b.byStatus[st] += 1;
    if (st === 'replied' || (l.replies && l.replies.length)) b.replied += 1;
    if (st === 'won') b.won += 1;
  });
  // 管理员额外列出尚无询盘的业务员，便于对照
  if (req.user.role === 'admin') {
    readUsers().filter((u) => u.role === 'sales' || u.role === 'admin').forEach((u) => ensure(u.id));
  }
  const byOwner = Object.values(bucket).sort((a, b) => b.total - a.total || a.ownerName.localeCompare(b.ownerName, 'zh'));
  const totals = byOwner.reduce((acc, x) => {
    acc.total += x.total; acc.unread += x.unread; acc.thisMonth += x.thisMonth; acc.won += x.won;
    Object.keys(acc.byStatus).forEach((k) => { acc.byStatus[k] += x.byStatus[k] || 0; });
    return acc;
  }, { total: 0, unread: 0, thisMonth: 0, won: 0, byStatus: { new: 0, following: 0, replied: 0, won: 0, closed: 0 } });
  res.json({ byOwner, totals, statuses: LEAD_STATUS_LABEL });
});

/** 单条商机详情（含关联 AI 聊天记录）——须放在 /stats 之后，避免 :id 吃掉 stats */
app.get('/api/leads/:id', requireAuth, (req, res) => {
  const leads = readLeads();
  const it = leads.find((l) => l.id === req.params.id);
  if (!it || !canTouchLead(req.user, it)) return res.status(404).json({ error: '不存在或无权限' });
  const lead = normalizeLead(Object.assign({}, it));
  let chat = null;
  if (lead.chatId || lead.sessionId) {
    chat = readChats().find((c) => c.id === lead.chatId || c.sessionId === lead.sessionId) || null;
  }
  res.json({ lead, chat });
});

// ---------- 前台 AI 客服聊天记录 ----------
function readChats() { return readJson(CHATS_FILE, []); }
function writeChats(list) { writeJson(CHATS_FILE, list); }
const chatRate = new Map();
function chatRateOk(ip) {
  const now = Date.now();
  const arr = (chatRate.get(ip) || []).filter((t) => now - t < 60000);
  if (arr.length >= 40) return false;
  arr.push(now); chatRate.set(ip, arr); return true;
}
/** 聊天会话自动同步为「智能询盘」商机 */
function upsertLeadFromChat(chat, extra) {
  const userMsgs = (chat.messages || []).filter((m) => m.role === 'user');
  if (!userMsgs.length) return null;
  const leads = readLeads();
  let lead = leads.find((l) => l.sessionId === chat.sessionId || (chat.id && l.chatId === chat.id));
  const meta = resolveProductMeta(chat.page, chat.lang, extra || {});
  const preview = userMsgs.slice(-3).map((m) => m.text).join(' / ').slice(0, 500);
  const now = Date.now();
  if (!lead) {
    lead = {
      id: crypto.randomBytes(8).toString('hex'),
      source: 'chat',
      title: meta.product ? ('Chat about ' + meta.product) : '在线客服咨询',
      name: String((extra && extra.name) || '').slice(0, 100),
      email: String((extra && extra.email) || '').slice(0, 160),
      phone: String((extra && extra.phone) || '').slice(0, 40),
      company: String((extra && extra.company) || '').slice(0, 160),
      country: String((extra && extra.country) || LANG_REGION[chat.lang] || chat.lang || '').slice(0, 80),
      message: preview,
      lang: chat.lang || '', page: chat.page || '',
      owner: meta.owner, product: meta.product, productSlug: meta.productSlug,
      productImage: meta.productImage, productPrice: meta.productPrice,
      chatId: chat.id, sessionId: chat.sessionId,
      time: chat.createdAt || now, read: false, ip: chat.ip || '',
      status: 'new', replies: [], note: '', lastReplyAt: 0, updatedAt: now,
      messageCount: (chat.messages || []).length,
    };
    leads.unshift(lead);
  } else {
    lead.chatId = chat.id;
    lead.sessionId = chat.sessionId;
    lead.message = preview;
    lead.updatedAt = now;
    lead.messageCount = (chat.messages || []).length;
    if (meta.product) { lead.product = meta.product; lead.title = 'Chat about ' + meta.product; }
    if (meta.productImage) lead.productImage = meta.productImage;
    if (meta.productPrice) lead.productPrice = meta.productPrice;
    if (meta.owner && !lead.owner) lead.owner = meta.owner;
    if (meta.productSlug) lead.productSlug = meta.productSlug;
    if (chat.page) lead.page = chat.page;
    if (extra) {
      if (extra.name) lead.name = String(extra.name).slice(0, 100);
      if (extra.email) lead.email = String(extra.email).slice(0, 160);
      if (extra.phone) lead.phone = String(extra.phone).slice(0, 40);
      if (extra.company) lead.company = String(extra.company).slice(0, 160);
      if (extra.country) lead.country = String(extra.country).slice(0, 80);
    }
    // 有新用户消息时重新标未读，便于业务员跟进
    if (userMsgs.length) lead.read = false;
  }
  writeJson(LEADS_FILE, leads);
  return lead;
}
/** 前台上报：创建或追加会话消息（按 sessionId 合并） */
app.post('/api/chats', (req, res) => {
  const b = req.body || {};
  const ip = (req.ip || '').replace(/^::ffff:/, '');
  if (!chatRateOk(ip)) return res.status(429).json({ error: '过于频繁' });
  const sessionId = String(b.sessionId || '').slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sessionId || sessionId.length < 8) return res.status(400).json({ error: '无效会话' });
  const incoming = Array.isArray(b.messages) ? b.messages : [];
  const msgs = incoming.slice(-80).map((m) => ({
    role: m && m.role === 'agent' ? 'agent' : 'user',
    text: String((m && m.text) || '').slice(0, 2000),
    time: Number((m && m.time) || Date.now()) || Date.now(),
  })).filter((m) => m.text);
  if (!msgs.length && !b.append) return res.status(400).json({ error: '无消息' });
  const chats = readChats();
  let chat = chats.find((c) => c.sessionId === sessionId);
  const now = Date.now();
  if (!chat) {
    chat = {
      id: crypto.randomBytes(8).toString('hex'),
      sessionId, lang: String(b.lang || '').slice(0, 8),
      page: String(b.page || '').slice(0, 300),
      productSlug: String(b.productSlug || '').slice(0, 80),
      productName: String(b.productName || '').slice(0, 160),
      productImage: String(b.productImage || '').slice(0, 300),
      productPrice: String(b.productPrice || '').slice(0, 80),
      visitor: {},
      messages: [], createdAt: now, updatedAt: now, ip,
      ua: String((req.headers['user-agent'] || '')).slice(0, 240),
    };
    chats.unshift(chat);
  }
  if (b.lang) chat.lang = String(b.lang).slice(0, 8);
  if (b.page) chat.page = String(b.page).slice(0, 300);
  if (b.productSlug) chat.productSlug = String(b.productSlug).slice(0, 80);
  if (b.productName) chat.productName = String(b.productName).slice(0, 160);
  if (b.productImage) chat.productImage = String(b.productImage).slice(0, 300);
  if (b.productPrice) chat.productPrice = String(b.productPrice).slice(0, 80);
  // append=true 时只追加新消息；否则用完整列表覆盖（前端一般增量追加）
  if (b.append) chat.messages = (chat.messages || []).concat(msgs);
  else if (msgs.length) chat.messages = msgs;
  if (chat.messages.length > 120) chat.messages = chat.messages.slice(-120);
  chat.updatedAt = now;
  // 最多保留 500 个会话
  while (chats.length > 500) chats.pop();
  writeChats(chats);
  const lead = upsertLeadFromChat(chat, Object.assign({}, chat.visitor || {}, {
    productSlug: chat.productSlug, productName: chat.productName,
    productImage: chat.productImage, productPrice: chat.productPrice,
  }));
  res.json({ ok: true, id: chat.id, leadId: lead && lead.id });
});
/** 访客在聊天中留下联系方式 → 写入会话与对应商机 */
app.post('/api/chats/profile', (req, res) => {
  const b = req.body || {};
  const sessionId = String(b.sessionId || '').slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sessionId) return res.status(400).json({ error: '无效会话' });
  const chats = readChats();
  const chat = chats.find((c) => c.sessionId === sessionId);
  if (!chat) return res.status(404).json({ error: '会话不存在，请先发送一条消息' });
  chat.visitor = chat.visitor || {};
  ['name', 'email', 'phone', 'company', 'country'].forEach((k) => {
    if (b[k] != null && String(b[k]).trim()) chat.visitor[k] = String(b[k]).trim().slice(0, k === 'email' ? 160 : 100);
  });
  writeChats(chats);
  const lead = upsertLeadFromChat(chat, Object.assign({}, chat.visitor, {
    productSlug: chat.productSlug, productName: chat.productName,
    productImage: chat.productImage, productPrice: chat.productPrice,
  }));
  res.json({ ok: true, leadId: lead && lead.id });
});
function canViewChats(user) {
  return user && (user.role === 'admin' || user.role === 'sales');
}
app.get('/api/chats', requireAuth, (req, res) => {
  if (!canViewChats(req.user)) return res.status(403).json({ error: '无权限' });
  const list = readChats().map((c) => ({
    id: c.id, sessionId: c.sessionId, lang: c.lang, page: c.page,
    productName: c.productName, productSlug: c.productSlug,
    visitor: c.visitor || {},
    createdAt: c.createdAt, updatedAt: c.updatedAt, ip: c.ip,
    messageCount: (c.messages || []).length,
    preview: ((c.messages || []).filter((m) => m.role === 'user').slice(-1)[0] || {}).text || '',
  }));
  res.json({ chats: list });
});
app.get('/api/chats/:id', requireAuth, (req, res) => {
  if (!canViewChats(req.user)) return res.status(403).json({ error: '无权限' });
  const chat = readChats().find((c) => c.id === req.params.id);
  if (!chat) return res.status(404).json({ error: '不存在' });
  res.json({ chat });
});
app.delete('/api/chats', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '无权限' });
  let chats = readChats();
  if (req.body && req.body.all) chats = [];
  else chats = chats.filter((c) => c.id !== (req.body && req.body.id));
  writeChats(chats);
  res.json({ ok: true });
});

// ---------- 客服回复：关键词话术 + 可选大模型 AI ----------
function aiChatSettings() {
  const s = ((readJson(CONTENT_FILE, {}).settings) || {}).aiChat || {};
  return {
    enabled: !!s.enabled,
    apiUrl: String(s.apiUrl || 'https://api.openai.com/v1').replace(/\/$/, ''),
    apiKey: String(s.apiKey || ''),
    model: String(s.model || 'gpt-4o-mini'),
    systemPrompt: String(s.systemPrompt || ''),
  };
}
function keywordReply(lang, message) {
  const content = readJson(CONTENT_FILE, {});
  const L = (content.i18n && content.i18n[lang]) || (content.i18n && content.i18n[content.defaultLang || 'zh']) || {};
  const chat = L.chat || {};
  const t = String(message || '').toLowerCase();
  const hit = (chat.replies || []).find((r) => (r.keywords || []).some((k) => k && t.indexOf(String(k).toLowerCase()) > -1));
  if (hit && hit.text) return { text: String(hit.text), source: 'keyword' };
  const fb = chat.fallback || chat.greeting || '';
  return { text: String(fb), source: 'fallback' };
}
function productBrief(lang) {
  const content = readJson(CONTENT_FILE, {});
  const L = (content.i18n && content.i18n[lang]) || {};
  const brand = L.brandName || 'V槽PRO';
  const products = (L.products || []).filter((p) => !p.deleted).slice(0, 12).map((p) => {
    const price = (p.price && (p.price.main || p.price.usd)) || '';
    return `- ${p.name}${price ? '（参考价 ' + price + '）' : ''}：${p.subtitle || p.cardDesc || ''}`;
  }).join('\n');
  return { brand, products };
}
async function callAiChat(ai, lang, message, history) {
  const brief = productBrief(lang);
  const sys = (ai.systemPrompt && ai.systemPrompt.trim()) || (
    `你是 ${brief.brand} 官网的售前客服，用简洁、专业、友好的中文（若用户用其它语言则跟用户语言）回答。\n` +
    `只围绕 V 槽开槽设备的选型、价格区间、交期、售后作答；不确定的价格请引导用户留联系方式或提交询盘，不要编造精确库存。\n` +
    `产品概览：\n${brief.products || '（暂无产品列表）'}`
  );
  const messages = [{ role: 'system', content: sys }];
  (Array.isArray(history) ? history : []).slice(-8).forEach((m) => {
    if (!m || !m.text) return;
    messages.push({ role: m.role === 'agent' ? 'assistant' : 'user', content: String(m.text).slice(0, 1000) });
  });
  messages.push({ role: 'user', content: String(message).slice(0, 2000) });
  const url = ai.apiUrl + '/chat/completions';
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ai.apiKey },
    body: JSON.stringify({ model: ai.model, temperature: 0.6, max_tokens: 500, messages }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = (data && data.error && (data.error.message || data.error)) || ('AI HTTP ' + resp.status);
    throw new Error(typeof err === 'string' ? err : JSON.stringify(err));
  }
  const text = (((data.choices || [])[0] || {}).message || {}).content;
  if (!text) throw new Error('AI 无返回内容');
  return String(text).trim().slice(0, 4000);
}
app.get('/api/chat/config', (req, res) => {
  const ai = aiChatSettings();
  res.json({ aiEnabled: !!(ai.enabled && ai.apiKey), mode: (ai.enabled && ai.apiKey) ? 'ai' : 'keyword' });
});
app.post('/api/chat/reply', async (req, res) => {
  const b = req.body || {};
  const ip = (req.ip || '').replace(/^::ffff:/, '');
  if (!chatRateOk(ip)) return res.status(429).json({ error: '过于频繁' });
  const message = String(b.message || '').trim().slice(0, 2000);
  if (!message) return res.status(400).json({ error: '请输入消息' });
  const lang = String(b.lang || 'zh').slice(0, 8);
  const ai = aiChatSettings();
  // 先关键词（有命中则直接用，省钱且可控）；无命中且开启 AI 再走大模型
  const kw = keywordReply(lang, message);
  if (kw.source === 'keyword') return res.json({ ok: true, text: kw.text, source: 'keyword' });
  if (ai.enabled && ai.apiKey) {
    try {
      const text = await callAiChat(ai, lang, message, b.history);
      return res.json({ ok: true, text, source: 'ai' });
    } catch (e) {
      return res.json({ ok: true, text: kw.text, source: 'fallback', aiError: (e && e.message) || 'AI 失败' });
    }
  }
  res.json({ ok: true, text: kw.text, source: kw.source });
});

// ---------- 访问统计 ----------
let stats = readJson(STATS_FILE, null) || { total: 0, days: {}, paths: {}, langs: {} };
let statsDirty = false;
let statsTimer = null;
function flushStats() { if (statsDirty) { writeJson(STATS_FILE, stats); statsDirty = false; } }
function recordView(type, slug, lang) {
  const key = type === 'product' ? 'product:' + slug : type;
  const day = new Date().toISOString().slice(0, 10);
  stats.total = (stats.total || 0) + 1;
  stats.days[day] = (stats.days[day] || 0) + 1;
  stats.paths[key] = (stats.paths[key] || 0) + 1;
  if (lang) stats.langs[lang] = (stats.langs[lang] || 0) + 1;
  // 仅保留最近 60 天
  const days = Object.keys(stats.days).sort();
  while (days.length > 60) delete stats.days[days.shift()];
  statsDirty = true;
  if (!statsTimer) statsTimer = setTimeout(() => { statsTimer = null; flushStats(); }, 3000);
}
app.get('/api/stats', requireAuth, (req, res) => {
  const days = Object.keys(stats.days).sort();
  const last30 = days.slice(-30).map((d) => ({ date: d, count: stats.days[d] }));
  const today = new Date().toISOString().slice(0, 10);
  const topPaths = Object.entries(stats.paths).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => ({ key: k, count: v }));
  res.json({ total: stats.total || 0, today: stats.days[today] || 0, last30, topPaths, langs: stats.langs || {} });
});

// ---------- SEO：服务端注入 title / description / og / hreflang ----------
function escAttr(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function baseUrl(req, content) {
  const s = (content.settings && content.settings.siteUrl || '').replace(/\/$/, '');
  if (s) return s;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return proto + '://' + req.headers.host;
}
function pathFor(content, code, type, slug) {
  const def = content.defaultLang || 'zh';
  const pre = code === def ? '' : '/' + code;
  if (type === 'product') return pre + '/products/' + slug;
  if (type === 'contact') return pre + '/contact';
  return pre === '' ? '/' : pre;
}
function firstMediaSrc(p) {
  if (p && p.gallery && p.gallery[0] && p.gallery[0].src) return p.gallery[0].src;
  if (p && p.cardImage) return p.cardImage;
  return '';
}
function buildSeo(req, type, langParam, slug) {
  const content = readJson(CONTENT_FILE, {});
  const def = content.defaultLang || 'zh';
  const langs = content.langs || [{ code: def, dir: 'ltr' }];
  const lang = langParam || def;
  const L = (content.i18n && content.i18n[lang]) || {};
  const brand = L.brandName || 'V槽PRO';
  const base = baseUrl(req, content);
  let title = brand, desc = '', image = (content.brand && content.brand.logo) || '';
  if (type === 'home') { title = (L.meta && L.meta.title) || brand; desc = (L.meta && L.meta.description) || (L.hero && L.hero.subtitle) || ''; }
  else if (type === 'contact') { title = ((L.contact && L.contact.title) || '联系我们') + ' | ' + brand; desc = (L.contact && L.contact.subtitle) || ''; }
  else if (type === 'product') {
    const p = (L.products || []).find((x) => (x.slug || x.id) === slug);
    if (p) { title = p.name + ' | ' + brand; desc = p.subtitle || p.cardDesc || ''; if (firstMediaSrc(p)) image = firstMediaSrc(p); }
  }
  const canonical = base + pathFor(content, lang, type, slug);
  const absImg = image ? (/^https?:/i.test(image) ? image : base + image) : '';
  const dirMeta = (langs.find((l) => l.code === lang) || {}).dir || 'ltr';
  let tags = '<title>' + escAttr(title) + '</title>\n';
  tags += '<meta name="description" content="' + escAttr(desc) + '">\n';
  tags += '<link rel="canonical" href="' + escAttr(canonical) + '">\n';
  langs.forEach((l) => { tags += '<link rel="alternate" hreflang="' + escAttr(l.code === 'zh' ? 'zh-CN' : l.code) + '" href="' + escAttr(base + pathFor(content, l.code, type, slug)) + '">\n'; });
  tags += '<link rel="alternate" hreflang="x-default" href="' + escAttr(base + pathFor(content, def, type, slug)) + '">\n';
  tags += '<meta property="og:type" content="website">\n<meta property="og:title" content="' + escAttr(title) + '">\n<meta property="og:description" content="' + escAttr(desc) + '">\n<meta property="og:url" content="' + escAttr(canonical) + '">\n';
  if (absImg) tags += '<meta property="og:image" content="' + escAttr(absImg) + '">\n';
  tags += '<meta name="twitter:card" content="' + (absImg ? 'summary_large_image' : 'summary') + '">\n';
  return { tags, lang: lang === 'zh' ? 'zh-CN' : lang, dir: dirMeta };
}
const shellCache = {}; // file -> { mtime, html }，文件变更后自动重读，避免更新静态页后仍吐旧 HTML
function readShell(file) {
  const fp = path.join(PUBLIC_DIR, file);
  const mtime = fs.statSync(fp).mtimeMs;
  const cached = shellCache[file];
  if (cached && cached.mtime === mtime) return cached.html;
  const html = fs.readFileSync(fp, 'utf8');
  shellCache[file] = { mtime, html };
  return html;
}
// 内联 CTA 保险脚本：即使浏览器缓存了旧 common.js，产品页按钮也能打开客服/下载参数
const CTA_GUARD = `<script>(function(){function O(){var w=document.getElementById('chatWindow'),f=document.getElementById('chatFab');if(!w||!f)return;w.classList.add('open');f.textContent='🛑';f.style.background='#E60012';}document.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('.cta-primary,.nav-btn,[data-open-chat],a[onclick*="openChat"],button[onclick*="openChat"]');if(!t)return;e.preventDefault();e.stopImmediatePropagation();O();},true);document.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('.cta-secondary');if(!t)return;e.preventDefault();e.stopImmediatePropagation();var title=(document.querySelector('.product-title')||{}).textContent||'product';var rows=[].map.call(document.querySelectorAll('.spec-table tr'),function(tr){var td=tr.querySelectorAll('td');return td.length>=2?(td[0].textContent+': '+td[1].textContent):'';}).filter(Boolean);var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\\ufeff'+title+'\\n\\n'+rows.join('\\n')+'\\n\\n'+location.href],{type:'text/plain;charset=utf-8'}));a.download='specs.txt';document.body.appendChild(a);a.click();a.remove();},true);})();</script>`;
function renderShell(file, req, res, type, slug) {
  const content = readJson(CONTENT_FILE, {});
  const seo = buildSeo(req, type, req.params.lang, slug);
  const headHtml = (content.settings && content.settings.headHtml) || '';
  let html = readShell(file);
  html = html.replace(/<html[^>]*>/, '<html lang="' + seo.lang + '" dir="' + seo.dir + '">');
  html = html.replace(/<title>[\s\S]*?<\/title>/, seo.tags + (headHtml ? '\n' + headHtml + '\n' : '') + '\n' + CTA_GUARD + '\n');
  recordView(type, slug || '', req.params.lang || (content.defaultLang || 'zh'));
  res.set('Content-Type', 'text/html; charset=utf-8').send(html);
}

// ---------- 多语言前台路由（带 SEO 注入，需在 static 之前）----------
const LANG = ':lang([a-z]{2})';
app.get(['/', '/index.html', '/' + LANG, '/' + LANG + '/', '/' + LANG + '/index.html'], (req, res) => renderShell('index.html', req, res, 'home'));
app.get(['/contact', '/contact.html', '/' + LANG + '/contact', '/' + LANG + '/contact.html'], (req, res) => renderShell('contact.html', req, res, 'contact'));
app.get(['/products/:slug', '/' + LANG + '/products/:slug'], (req, res) => renderShell('product.html', req, res, 'product', String(req.params.slug || '').replace(/\.html?$/i, '')));

// ---------- 站点地图 / robots ----------
app.get('/sitemap.xml', (req, res) => {
  const content = readJson(CONTENT_FILE, {});
  const base = baseUrl(req, content);
  const langs = content.langs || [];
  const urls = [];
  langs.forEach((l) => {
    const L = (content.i18n && content.i18n[l.code]) || {};
    urls.push(base + pathFor(content, l.code, 'home'));
    urls.push(base + pathFor(content, l.code, 'contact'));
    (L.products || []).filter((p) => !p.deleted).forEach((p) => urls.push(base + pathFor(content, l.code, 'product', p.slug || p.id)));
  });
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => '  <url><loc>' + escAttr(u) + '</loc></url>').join('\n') + '\n</urlset>';
  res.set('Content-Type', 'application/xml').send(xml);
});
app.get('/robots.txt', (req, res) => {
  const content = readJson(CONTENT_FILE, {});
  res.set('Content-Type', 'text/plain').send('User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ' + baseUrl(req, content) + '/sitemap.xml\n');
});

// ---------- 静态资源 ----------
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(PUBLIC_DIR, { index: false }));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// ---------- 兜底：其余未匹配的非 API 地址跳回首页，避免 404 ----------
app.get(/^\/(?!api\/).*/, (req, res) => res.redirect('/'));

['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => { flushStats(); process.exit(0); }));

// 部署校验：curl /api/build 应看到本文件里的 buildId
const BUILD_ID = '20260716g-admin-modules';
app.get('/api/build', (req, res) => {
  res.json({
    ok: true,
    buildId: BUILD_ID,
    hasChatFix: true,
    time: Date.now(),
    cwd: process.cwd(),
  });
});

app.listen(PORT, () => {
  console.log('====================================');
  console.log(`  前台：  http://localhost:${PORT}`);
  console.log(`  后台：  http://localhost:${PORT}/admin`);
  console.log(`  构建：  ${BUILD_ID}`);
  console.log(`  默认账号： ${DEFAULT_USER}   密码： ${DEFAULT_PASS}`);
  console.log('====================================');
});
