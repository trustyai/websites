'use strict';
/**
 * 命令行开户脚本（用于「仅管理员开户」模式，或手动补建账号）。
 * 用法：
 *   node scripts/create-admin.js <邮箱> <密码> [显示名] [角色 user|admin]
 * 例：
 *   node scripts/create-admin.js boss@company.com mypass123 "张经理" admin
 */
const bcrypt = require('bcryptjs');
const db = require('../db');

const [, , email, password, displayName = '', role = 'user'] = process.argv;

if (!email || !password) {
  console.error('用法: node scripts/create-admin.js <邮箱> <密码> [显示名] [user|admin]');
  process.exit(1);
}
if (password.length < 6) { console.error('密码至少 6 位'); process.exit(1); }

const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (exists) { console.error('该邮箱已存在'); process.exit(1); }

const hash = bcrypt.hashSync(password, 10);
const info = db.prepare('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
  .run(email, hash, displayName, role === 'admin' ? 'admin' : 'user');

console.log(`已创建账号 #${info.lastInsertRowid}：${email}（角色：${role}）`);
