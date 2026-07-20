/* =====================================================================
 * Niumabox · 阿里云 OSS PostObject 签名  (src/api-oss-sign.js)
 * ---------------------------------------------------------------------
 * 给浏览器直传用:后端用 RAM AccessKey 签 policy,前端 FormData POST 到 OSS。
 * 零 npm 依赖(只用 Node crypto)。
 *
 * 需要的环境变量(.env):
 *   OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET
 *   OSS_BUCKET=niumabox
 *   OSS_REGION=oss-cn-shenzhen          # 或 cn-shenzhen(自动补 oss-)
 *   OSS_DIR=payment-proofs             # 对象前缀,可选
 *   OSS_MAX_SIZE_MB=10                 # 单文件上限,可选
 *   OSS_PUBLIC_BASE                    # 可选;不填则拼 https://{bucket}.{region}.aliyuncs.com
 * ===================================================================== */
'use strict';

const crypto = require('crypto');

function regionHost(region) {
  let r = String(region || 'oss-cn-shenzhen').trim();
  if (!r.startsWith('oss-')) r = 'oss-' + r;
  return r;
}

function cfg() {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID || '';
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET || '';
  const bucket = process.env.OSS_BUCKET || 'niumabox';
  const region = regionHost(process.env.OSS_REGION || 'oss-cn-shenzhen');
  const dir = String(process.env.OSS_DIR || 'payment-proofs').replace(/^\/+|\/+$/g, '');
  const maxMb = Number(process.env.OSS_MAX_SIZE_MB || 10);
  const publicBase = (process.env.OSS_PUBLIC_BASE || ('https://' + bucket + '.' + region + '.aliyuncs.com')).replace(/\/$/, '');
  return { accessKeyId, accessKeySecret, bucket, region, dir, maxMb, publicBase, host: publicBase };
}

function safeName(name) {
  return String(name || 'file')
    .replace(/[^\w.\-\u4e00-\u9fff]+/g, '_')
    .slice(0, 80) || 'file';
}

/**
 * @param {{ userId: string, fileName: string, contentType?: string }} opts
 * @returns {{ host, key, policy, signature, accessKeyId, success_action_status, publicUrl, expireAt, maxSize }}
 */
function signPaymentProofUpload(opts) {
  const c = cfg();
  if (!c.accessKeyId || !c.accessKeySecret) {
    const err = new Error('OSS_NOT_CONFIGURED');
    err.code = 'OSS_NOT_CONFIGURED';
    throw err;
  }
  const uid = String((opts && opts.userId) || 'anon').replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 40) || 'anon';
  const fname = safeName(opts && opts.fileName);
  const key = c.dir + '/' + uid + '/' + Date.now() + '_' + fname;
  const maxSize = Math.max(1, c.maxMb) * 1024 * 1024;
  const expireAt = new Date(Date.now() + 15 * 60 * 1000);
  const policyObj = {
    expiration: expireAt.toISOString(),
    conditions: [
      { bucket: c.bucket },
      ['eq', '$key', key],
      ['content-length-range', 0, maxSize],
      ['starts-with', '$Content-Type', '']
    ]
  };
  const policy = Buffer.from(JSON.stringify(policyObj)).toString('base64');
  const signature = crypto.createHmac('sha1', c.accessKeySecret).update(policy).digest('base64');
  return {
    host: c.host,
    bucket: c.bucket,
    region: c.region,
    key,
    policy,
    signature,
    accessKeyId: c.accessKeyId,
    success_action_status: '200',
    publicUrl: c.publicBase + '/' + key,
    expireAt: expireAt.toISOString(),
    maxSize
  };
}

module.exports = { signPaymentProofUpload, cfg, safeName, regionHost };
