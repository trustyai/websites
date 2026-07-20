/* 本地冒烟: node niumabox/backend/test-finance-unit.js */
'use strict';

process.env.OSS_ACCESS_KEY_ID = 'LTAI_TEST_KEY';
process.env.OSS_ACCESS_KEY_SECRET = 'test_secret_abc';
process.env.OSS_BUCKET = 'niumabox';
process.env.OSS_REGION = 'oss-cn-shenzhen';

const assert = require('assert');
const { signPaymentProofUpload, safeName, regionHost } = require('./api-oss-sign');
const { buildEmail, escapeHtml } = require('./api-finance-notify');

assert.strictEqual(regionHost('cn-shenzhen'), 'oss-cn-shenzhen');
assert.strictEqual(regionHost('oss-cn-shenzhen'), 'oss-cn-shenzhen');
assert.ok(safeName('a b/c.pdf').indexOf('/') === -1);

const signed = signPaymentProofUpload({ userId: 'u-123', fileName: '水单.pdf', contentType: 'application/pdf' });
assert.ok(signed.host.includes('niumabox.oss-cn-shenzhen.aliyuncs.com'));
assert.ok(signed.key.startsWith('payment-proofs/'));
assert.ok(signed.policy && signed.signature && signed.accessKeyId);
assert.ok(signed.publicUrl.endsWith(signed.key));

const mail = buildEmail(
  { amount: 1200, currency: 'USD', note: 'deposit', file_name: 'a.pdf', file_url: 'https://x/a.pdf', created_at: '2026-07-20', user_id: 'u1' },
  { company: 'Acme GmbH' },
  'seller@example.com'
);
assert.ok(mail.subject.includes('新付款水单'));
assert.ok(mail.subject.includes('Acme'));
assert.ok(mail.html.includes('Acme GmbH'));
assert.ok(mail.text.includes('seller@example.com'));
assert.strictEqual(escapeHtml('<b>'), '&lt;b&gt;');

console.log('OK finance unit tests passed');
