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
const PUBLIC_DIR = path.join(__dirname, 'public');

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

function initConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    writeJson(CONFIG_FILE, {
      username: DEFAULT_USER,
      passwordHash: bcrypt.hashSync(DEFAULT_PASS, 10),
    });
  }
}

ensureDirs();
initContent();
initConfig();

// ---------- 会话（内存 token） ----------
const sessions = new Map(); // token -> expires(ms)
const SESSION_TTL = 1000 * 60 * 60 * 12; // 12 小时

function createSession() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAuth(req, res, next) {
  if (isValidSession(req.cookies && req.cookies.vg_token)) return next();
  return res.status(401).json({ error: '未登录或登录已过期' });
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
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const cfg = readJson(CONFIG_FILE, {});
  const ok =
    username === cfg.username && bcrypt.compareSync(String(password || ''), cfg.passwordHash || '');
  if (!ok) return res.status(401).json({ error: '账号或密码错误' });
  const token = createSession();
  res.cookie('vg_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL,
  });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies && req.cookies.vg_token;
  if (token) sessions.delete(token);
  res.clearCookie('vg_token');
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  res.json({ authed: isValidSession(req.cookies && req.cookies.vg_token) });
});

app.post('/api/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  const cfg = readJson(CONFIG_FILE, {});
  if (!bcrypt.compareSync(String(current || ''), cfg.passwordHash || '')) {
    return res.status(400).json({ error: '当前密码不正确' });
  }
  if (!next || String(next).length < 6) {
    return res.status(400).json({ error: '新密码至少 6 位' });
  }
  cfg.passwordHash = bcrypt.hashSync(String(next), 10);
  writeJson(CONFIG_FILE, cfg);
  res.json({ ok: true });
});

// ---------- 内容 API ----------
// 公开接口：剥离 settings（含 Webhook/SMTP 密码等敏感信息），前台用不到
app.get('/api/content', (req, res) => {
  const c = readJson(CONTENT_FILE, {});
  const pub = Object.assign({}, c);
  delete pub.settings;
  res.json(pub);
});

// 后台接口：返回完整内容（含 settings），需登录
app.get('/api/admin/content', requireAuth, (req, res) => {
  res.json(readJson(CONTENT_FILE, {}));
});

app.post('/api/content', requireAuth, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: '数据格式错误' });
  }
  writeJson(CONTENT_FILE, body);
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
async function sendLeadEmail(lead) {
  if (!nodemailer) return;
  const s = ((readJson(CONTENT_FILE, {}).settings) || {}).smtp || {};
  if (!s.host || !s.to) return;
  try {
    const transporter = nodemailer.createTransport({
      host: s.host, port: Number(s.port) || 465, secure: s.secure !== false && Number(s.port) !== 587,
      auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    });
    const html = `<h3>新的询价 / 留言</h3><ul>
      <li>姓名：${escHtml(lead.name)}</li><li>邮箱：${escHtml(lead.email)}</li>
      <li>公司：${escHtml(lead.company)}</li><li>语言：${escHtml(lead.lang)}</li>
      <li>页面：${escHtml(lead.page)}</li></ul><p>${escHtml(lead.message).replace(/\n/g, '<br>')}</p>`;
    await transporter.sendMail({
      from: s.from || s.user, to: s.to, subject: '【网站询价】' + (lead.name || lead.email || '新留言'),
      replyTo: lead.email || undefined, html,
    });
  } catch (e) { /* 邮件失败不影响主流程 */ }
}
function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
app.post('/api/leads', (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // 蜜罐：机器人填了隐藏字段，静默丢弃
  const ip = (req.ip || '').replace(/^::ffff:/, '');
  if (!rateOk(ip)) return res.status(429).json({ error: '提交过于频繁，请稍后再试' });
  const name = String(b.name || '').slice(0, 100).trim();
  const message = String(b.message || '').slice(0, 3000).trim();
  if (!name && !b.email) return res.status(400).json({ error: '请至少填写姓名或邮箱' });
  const lead = {
    id: crypto.randomBytes(8).toString('hex'),
    name, email: String(b.email || '').slice(0, 160).trim(),
    company: String(b.company || '').slice(0, 160).trim(),
    message, lang: String(b.lang || '').slice(0, 8), page: String(b.page || '').slice(0, 300),
    time: Date.now(), read: false, ip,
  };
  const leads = readLeads(); leads.unshift(lead); writeJson(LEADS_FILE, leads);
  notifyWebhook(lead);
  sendLeadEmail(lead);
  res.json({ ok: true });
});
app.get('/api/leads', requireAuth, (req, res) => res.json({ leads: readLeads() }));
app.post('/api/leads/read', requireAuth, (req, res) => {
  const id = req.body && req.body.id; const leads = readLeads();
  const it = leads.find((l) => l.id === id); if (it) it.read = !!(req.body.read);
  writeJson(LEADS_FILE, leads); res.json({ ok: true });
});
app.delete('/api/leads', requireAuth, (req, res) => {
  const id = req.body && req.body.id; let leads = readLeads();
  if (req.body && req.body.all) leads = []; else leads = leads.filter((l) => l.id !== id);
  writeJson(LEADS_FILE, leads); res.json({ ok: true });
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
const shellCache = {};
function renderShell(file, req, res, type, slug) {
  const content = readJson(CONTENT_FILE, {});
  const seo = buildSeo(req, type, req.params.lang, slug);
  const headHtml = (content.settings && content.settings.headHtml) || '';
  let html = shellCache[file] || (shellCache[file] = fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8'));
  html = html.replace(/<html[^>]*>/, '<html lang="' + seo.lang + '" dir="' + seo.dir + '">');
  html = html.replace(/<title>[\s\S]*?<\/title>/, seo.tags + (headHtml ? '\n' + headHtml + '\n' : ''));
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
    (L.products || []).forEach((p) => urls.push(base + pathFor(content, l.code, 'product', p.slug || p.id)));
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

app.listen(PORT, () => {
  console.log('====================================');
  console.log(`  前台：  http://localhost:${PORT}`);
  console.log(`  后台：  http://localhost:${PORT}/admin`);
  console.log(`  默认账号： ${DEFAULT_USER}   密码： ${DEFAULT_PASS}`);
  console.log('====================================');
});
