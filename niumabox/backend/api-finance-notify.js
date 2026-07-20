/* =====================================================================
 * Niumabox · 付款水单邮件通知财务  (src/api-finance-notify.js)
 * ---------------------------------------------------------------------
 * 由 payment_proofs INSERT 触发(pg_net → POST /api/finance/notify-proof):
 *   水单 → owner_id 所在团队里 role='finance' 的成员 → 发信。
 * 复用询盘通知同一套 SMTP(.env 已配好的 SMTP_* / SUPABASE_*).
 * ===================================================================== */
'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_URL || 'https://niumabox.com';

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sbRest(pathQuery) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + pathQuery, {
    headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }
  });
  if (!r.ok) throw new Error('supabase rest ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 150));
  return r.json();
}

async function adminGetUserEmail(userId) {
  if (!userId) return '';
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + userId, {
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }
    });
    if (!r.ok) return '';
    const u = await r.json();
    return (u && u.email) || '';
  } catch (e) { return ''; }
}

/** 找 owner 所在团队里所有 active finance 成员的邮箱 */
async function resolveFinanceEmails(ownerId) {
  if (!ownerId) return [];
  // 1) owner 所在团队
  const mems = await sbRest(
    'team_members?member_id=eq.' + encodeURIComponent(ownerId) +
    '&status=eq.active&select=team_id'
  );
  const teamIds = [...new Set((mems || []).map(m => m.team_id).filter(Boolean))];
  if (!teamIds.length) return [];

  // 2) 这些团队里的 finance
  const finances = await sbRest(
    'team_members?team_id=in.(' + teamIds.join(',') + ')' +
    '&role=eq.finance&status=eq.active&select=member_id,member_email'
  );
  const emails = [];
  for (const f of (finances || [])) {
    let em = (f.member_email || '').trim();
    if (!em && f.member_id) em = await adminGetUserEmail(f.member_id);
    if (em) emails.push(em);
  }
  return [...new Set(emails)];
}

async function loadCustomer(customerId) {
  if (!customerId) return null;
  const rows = await sbRest(
    'customers?id=eq.' + encodeURIComponent(customerId) +
    '&select=id,label,company,email,phone,user_id'
  );
  return (rows && rows[0]) || null;
}

function buildEmail(record, customer, uploaderEmail) {
  const company = (customer && (customer.company || customer.label)) || '';
  const amountStr = (record.amount != null && record.amount !== '')
    ? ((record.currency || 'USD') + ' ' + record.amount)
    : '—';
  const subject = '💰 新付款水单' + (company ? ' · ' + company : '') + (amountStr !== '—' ? ' · ' + amountStr : '');

  const text = [
    '团队有新的付款水单上传：', '',
    '客户：' + (company || '-'),
    '金额：' + amountStr,
    '备注：' + (record.note || '-'),
    '文件：' + (record.file_name || '-'),
    '上传人：' + (uploaderEmail || record.user_id || '-'),
    '时间：' + (record.created_at || ''),
    '',
    '查看文件：' + (record.file_url || '-'),
    '打开 Niumabox：' + APP_URL
  ].join('\n');

  const row = (k, v) => '<tr><td style="padding:2px 12px 2px 0;color:#6b7280">' + k + '</td><td style="padding:2px 0;color:#111827">' + escapeHtml(v || '-') + '</td></tr>';
  const html = '<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.7;color:#1f2937;max-width:560px">'
    + '<p style="font-size:16px;font-weight:700;margin:0 0 12px">💰 新付款水单' + (company ? ' · ' + escapeHtml(company) : '') + '</p>'
    + '<table style="border-collapse:collapse">'
    + row('客户', company)
    + row('金额', amountStr)
    + row('备注', record.note)
    + row('文件', record.file_name)
    + row('上传人', uploaderEmail || record.user_id)
    + row('时间', record.created_at)
    + '</table>'
    + (record.file_url
      ? '<p style="margin-top:16px"><a href="' + escapeHtml(record.file_url) + '" style="background:#1f8a4c;color:#fff;text-decoration:none;padding:9px 18px;border-radius:8px;display:inline-block">打开水单文件</a></p>'
      : '')
    + '<p style="margin-top:12px"><a href="' + APP_URL + '" style="color:#2563eb">打开 Niumabox</a></p>'
    + '</div>';

  return { subject, text, html };
}

let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE != null ? (String(process.env.SMTP_SECURE) === 'true') : (port === 465);
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return _transporter;
}

async function notifyPaymentProof(record) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 未配置');
  if (!record || !record.id) throw new Error('no record');

  const [finEmails, customer, uploaderEmail] = await Promise.all([
    resolveFinanceEmails(record.owner_id),
    loadCustomer(record.customer_id),
    adminGetUserEmail(record.user_id)
  ]);

  if (!finEmails.length) {
    console.warn('[finance/notify-proof] 团队无财务成员, owner_id=', record.owner_id);
    return { skipped: true, reason: 'no_finance' };
  }

  const { subject, text, html } = buildEmail(record, customer, uploaderEmail);
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const bcc = process.env.NOTIFY_BCC || undefined;
  await getTransporter().sendMail({
    from, to: finEmails.join(','), bcc, subject, text, html
  });
  return { to: finEmails };
}

module.exports = {
  notifyPaymentProof, buildEmail, resolveFinanceEmails,
  loadCustomer, escapeHtml
};
