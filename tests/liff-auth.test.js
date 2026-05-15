const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.LINE_AUTH_SECRET = 'test-line-auth-secret';

const {
  buildSignedLineAuth,
  verifySignedLineAuth,
} = require('../src/services/liff-auth.service');

test('signed LIFF auth verifies the same LINE user id', () => {
  const lineUserId = 'U-test-liff-auth-1';
  const auth = buildSignedLineAuth(lineUserId, Date.now());

  assert.equal(
    verifySignedLineAuth(lineUserId, auth.auth_ts, auth.auth_sig),
    true
  );
});

test('signed LIFF auth rejects a different LINE user id', () => {
  const auth = buildSignedLineAuth('U-test-liff-auth-2', Date.now());

  assert.equal(
    verifySignedLineAuth('U-test-liff-auth-other', auth.auth_ts, auth.auth_sig),
    false
  );
});
