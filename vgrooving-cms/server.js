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
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const DEFAULT_CONTENT_FILE = path.join(DATA_DIR, 'content.default.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const DEFAULT_USER = 'admin';
const DEFAULT_PASS = 'admin123';

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
app.get('/api/content', (req, res) => {
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

// ---------- 文件上传 API ----------
app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: '未收到文件' });
    const ext = path.extname(req.file.filename).toLowerCase();
    const type = /\.(mp4|webm|mov)$/i.test(ext) ? 'video' : 'image';
    res.json({ ok: true, url: `/uploads/${req.file.filename}`, type });
  });
});

// ---------- 静态资源 ----------
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.listen(PORT, () => {
  console.log('====================================');
  console.log(`  前台：  http://localhost:${PORT}`);
  console.log(`  后台：  http://localhost:${PORT}/admin`);
  console.log(`  默认账号： ${DEFAULT_USER}   密码： ${DEFAULT_PASS}`);
  console.log('====================================');
});
