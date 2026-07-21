'use strict';
/**
 * 代理商价目表生成器 · 云端后端
 * 单文件 Express 服务：提供账号注册/登录 + 价目表云端存取，并托管前端。
 *
 * 环境变量（均可选，见 .env.example）：
 *   PORT                监听端口（默认 3000）
 *   JWT_SECRET          登录令牌签名密钥（生产环境务必设置为随机长字符串）
 *   ALLOW_REGISTRATION  是否允许任何人自助注册：'true'（默认）| 'false'（仅管理员开户）
 *   DB_PATH             SQLite 文件路径（默认 ./data/app.db；云平台请指向持久化磁盘）
 *   MAX_BODY           请求体上限，默认 '25mb'（价目表含 base64 图片会偏大）
 */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const ALLOW_REGISTRATION = (process.env.ALLOW_REGISTRATION || 'true') !== 'false';
const MAX_BODY = process.env.MAX_BODY || '25mb';

if (!process.env.JWT_SECRET) {
  console.warn('[警告] 未设置 JWT_SECRET，已生成临时密钥。重启后所有登录将失效，生产环境请在环境变量中固定 JWT_SECRET。');
}

const app = express();
app.use(express.json({ limit: MAX_BODY }));

/* ---------- 预编译 SQL ---------- */
const Q = {
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userById:    db.prepare('SELECT id, email, display_name, role, created_at FROM users WHERE id = ?'),
  countUsers:  db.prepare('SELECT COUNT(*) AS n FROM users'),
  insertUser:  db.prepare('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)'),
  listsByUser: db.prepare('SELECT id, title, created_at, updated_at FROM price_lists WHERE user_id = ? ORDER BY updated_at DESC'),
  listById:    db.prepare('SELECT * FROM price_lists WHERE id = ? AND user_id = ?'),
  insertList:  db.prepare('INSERT INTO price_lists (user_id, title, data) VALUES (?, ?, ?)'),
  updateList:  db.prepare("UPDATE price_lists SET title = ?, data = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"),
  deleteList:  db.prepare('DELETE FROM price_lists WHERE id = ? AND user_id = ?'),
  delPagesByList: db.prepare('DELETE FROM product_pages WHERE list_id = ?'),
  upsertPage: db.prepare(`
    INSERT INTO product_pages (id, user_id, list_id, data, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      list_id = excluded.list_id,
      data = excluded.data,
      updated_at = datetime('now')
  `),
  pageById: db.prepare('SELECT id, data, updated_at FROM product_pages WHERE id = ?'),
};

/** 云端保存时同步公开商品详情页（供 PDF/Excel 链接跳转） */
function syncProductPages(userId, listId, data) {
  let parsed = data;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch (e) { parsed = null; }
  }
  if (!parsed || !Array.isArray(parsed.products)) {
    Q.delPagesByList.run(listId);
    return;
  }
  const company = parsed.company || {};
  const keep = new Set();
  const sync = db.transaction(() => {
    for (const p of parsed.products) {
      const id = (p && p.publicId) ? String(p.publicId).trim() : '';
      if (!id || !/^[a-zA-Z0-9_-]{8,32}$/.test(id)) continue;
      keep.add(id);
      const snapshot = {
        name: p.name || '',
        link: p.link || '',
        variants: (p.variants || []).map((v) => ({
          model: v.model || '',
          img: v.img || null,
          wsMax: v.wsMax || '',
          wsMin: v.wsMin || '',
          speed: v.speed || '',
          desc: v.desc || '',
          pack: v.pack || '',
          agentTax: v.agentTax || '',
          agentNo: v.agentNo || '',
          mktTax: v.mktTax || '',
          mktNo: v.mktNo || '',
          remark: v.remark || '',
        })),
        company: {
          name: company.name || '',
          nameEn: company.nameEn || '',
          sub: company.sub || '',
          contact: company.contact || '',
        },
        currency: parsed.currency || 'CNY',
        logo: parsed.logo || null,
        hideTax: !!parsed.hideTax,
        taxRate: parsed.taxRate,
        mode: parsed.mode || 'cn',
      };
      Q.upsertPage.run(id, userId, listId, JSON.stringify(snapshot));
    }
    // 移除本价目表中已删除产品的公开页
    const existing = db.prepare('SELECT id FROM product_pages WHERE list_id = ?').all(listId);
    const delOne = db.prepare('DELETE FROM product_pages WHERE id = ? AND list_id = ?');
    for (const row of existing) {
      if (!keep.has(row.id)) delOne.run(row.id, listId);
    }
  });
  sync();
}

/* ---------- 工具 ---------- */
function signToken(user) {
  return jwt.sign({ uid: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '60d' });
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}
const emailOk = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/* ---------- 健康检查 ---------- */
app.get('/api/health', (req, res) => res.json({ ok: true, allowRegistration: ALLOW_REGISTRATION }));

/* ---------- 注册 ---------- */
app.post('/api/register', (req, res) => {
  const { email, password, displayName } = req.body || {};
  // 第一个注册的用户自动成为管理员；之后是否允许注册由 ALLOW_REGISTRATION 控制
  const isFirst = Q.countUsers.get().n === 0;
  if (!ALLOW_REGISTRATION && !isFirst) {
    return res.status(403).json({ error: '本系统未开放自助注册，请联系管理员开通账号' });
  }
  if (!emailOk(email)) return res.status(400).json({ error: '邮箱格式不正确' });
  if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  if (Q.userByEmail.get(email)) return res.status(409).json({ error: '该邮箱已注册' });

  const hash = bcrypt.hashSync(password, 10);
  const role = isFirst ? 'admin' : 'user';
  const info = Q.insertUser.run(email, hash, (displayName || '').slice(0, 60), role);
  const user = { id: info.lastInsertRowid, email, role };
  res.json({ token: signToken(user), user: { id: user.id, email, displayName: displayName || '', role } });
});

/* ---------- 登录 ---------- */
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = Q.userByEmail.get(email || '');
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }
  res.json({ token: signToken(u), user: { id: u.id, email: u.email, displayName: u.display_name, role: u.role } });
});

/* ---------- 当前用户 ---------- */
app.get('/api/me', auth, (req, res) => {
  const u = Q.userById.get(req.user.uid);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  res.json({ user: { id: u.id, email: u.email, displayName: u.display_name, role: u.role } });
});

/* ---------- 价目表列表 ---------- */
app.get('/api/lists', auth, (req, res) => {
  res.json({ lists: Q.listsByUser.all(req.user.uid) });
});

/* ---------- 读取单个价目表 ---------- */
app.get('/api/lists/:id', auth, (req, res) => {
  const row = Q.listById.get(Number(req.params.id), req.user.uid);
  if (!row) return res.status(404).json({ error: '未找到该价目表' });
  let data;
  try { data = JSON.parse(row.data); } catch (e) { data = null; }
  res.json({ id: row.id, title: row.title, data, createdAt: row.created_at, updatedAt: row.updated_at });
});

/* ---------- 新建价目表 ---------- */
app.post('/api/lists', auth, (req, res) => {
  const { title, data } = req.body || {};
  if (data == null) return res.status(400).json({ error: '缺少 data' });
  const info = Q.insertList.run(req.user.uid, (title || '未命名价目表').slice(0, 120), JSON.stringify(data));
  const row = Q.listById.get(info.lastInsertRowid, req.user.uid);
  try { syncProductPages(req.user.uid, row.id, data); } catch (e) { console.error('syncProductPages', e); }
  res.json({ id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at });
});

/* ---------- 更新价目表 ---------- */
app.put('/api/lists/:id', auth, (req, res) => {
  const { title, data } = req.body || {};
  if (data == null) return res.status(400).json({ error: '缺少 data' });
  const info = Q.updateList.run((title || '未命名价目表').slice(0, 120), JSON.stringify(data), Number(req.params.id), req.user.uid);
  if (info.changes === 0) return res.status(404).json({ error: '未找到该价目表' });
  const row = Q.listById.get(Number(req.params.id), req.user.uid);
  try { syncProductPages(req.user.uid, row.id, data); } catch (e) { console.error('syncProductPages', e); }
  res.json({ id: row.id, title: row.title, updatedAt: row.updated_at });
});

/* ---------- 删除价目表 ---------- */
app.delete('/api/lists/:id', auth, (req, res) => {
  const listId = Number(req.params.id);
  const info = Q.deleteList.run(listId, req.user.uid);
  if (info.changes === 0) return res.status(404).json({ error: '未找到该价目表' });
  Q.delPagesByList.run(listId);
  res.json({ ok: true });
});

/* ---------- 公开商品详情（无需登录，供导出链接跳转） ---------- */
app.get('/api/public/p/:id', (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!/^[a-zA-Z0-9_-]{8,32}$/.test(id)) return res.status(400).json({ error: '无效的商品链接' });
  const row = Q.pageById.get(id);
  if (!row) return res.status(404).json({ error: '商品不存在或尚未发布（请先云端保存价目表）' });
  let data;
  try { data = JSON.parse(row.data); } catch (e) { return res.status(500).json({ error: '数据损坏' }); }
  res.json({ id: row.id, updatedAt: row.updated_at, data });
});

/* ---------- 托管前端 ---------- */
app.use(express.static(path.join(__dirname, 'public')));
app.get(['/p/:id', '/p/:id/*'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n代理商价目表生成器（云端版）已启动：http://localhost:${PORT}`);
  console.log(`自助注册：${ALLOW_REGISTRATION ? '已开放' : '已关闭（仅管理员开户）'}`);
});
