/* =====================================================================
 * Niumabox · 财务路由  (src/routes/finance.js)
 * ---------------------------------------------------------------------
 * 挂载(在 src/index.js):
 *   app.use('/api/finance', require('./routes/finance'));
 *
 * POST /api/finance/oss-sign        ← 登录用户拿 OSS 直传签名(requireUser)
 * POST /api/finance/notify-proof    ← pg_net webhook(x-webhook-secret)
 * ===================================================================== */
'use strict';

const express = require('express');
const router = express.Router();
const { verifyUserJwt } = require('../services/supabase');
const { signPaymentProofUpload } = require('../api-oss-sign');
const { notifyPaymentProof } = require('../api-finance-notify');

router.use(express.json({ limit: '256kb' }));

async function requireUser(req, res, next) {
  try {
    const user = await verifyUserJwt(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'NOT_AUTHED' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'NOT_AUTHED' });
  }
}

// POST /api/finance/oss-sign  { fileName, contentType }
router.post('/oss-sign', requireUser, async (req, res) => {
  try {
    const fileName = (req.body && req.body.fileName) || '';
    const contentType = (req.body && req.body.contentType) || '';
    if (!fileName) return res.status(400).json({ error: 'fileName required' });
    // 只允许图片 / PDF
    const mime = String(contentType || '').toLowerCase();
    const okMime = !mime || /^(image\/(jpeg|jpg|png|webp|gif)|application\/pdf)$/.test(mime);
    if (!okMime) return res.status(400).json({ error: '仅支持图片或 PDF' });
    const lower = fileName.toLowerCase();
    if (!/\.(jpe?g|png|webp|gif|pdf)$/.test(lower)) {
      return res.status(400).json({ error: '文件扩展名须为 jpg/png/webp/gif/pdf' });
    }
    const signed = signPaymentProofUpload({
      userId: req.user.id,
      fileName,
      contentType: mime
    });
    res.json({ ok: true, ...signed });
  } catch (e) {
    if (e && e.code === 'OSS_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'OSS_NOT_CONFIGURED', message: '服务器未配置 OSS AccessKey' });
    }
    console.error('[finance/oss-sign]', e && e.message);
    res.status(500).json({ error: (e && e.message) || 'sign failed' });
  }
});

// POST /api/finance/notify-proof  ← pg_net / webhook
router.post('/notify-proof', async (req, res) => {
  const secret = process.env.FINANCE_WEBHOOK_SECRET || process.env.INQUIRY_WEBHOOK_SECRET;
  if (!secret || req.headers['x-webhook-secret'] !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const record = req.body && (req.body.record || req.body);
  if (!record || !record.id) return res.status(400).json({ error: 'no record' });
  try {
    const r = await notifyPaymentProof(record);
    res.json({ ok: true, result: r });
  } catch (e) {
    console.error('[finance/notify-proof]', e && e.message);
    // 返回 200 避免 pg_net/webhook 反复重试导致重复发信
    res.status(200).json({ ok: false, error: (e && e.message) || 'failed' });
  }
});

module.exports = router;
