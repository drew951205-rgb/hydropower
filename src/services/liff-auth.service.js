const crypto = require('crypto');
const { env } = require('../config/env');
const { logger } = require('../config/logger');

function authSecret() {
  return env.lineAuthSecret || env.lineChannelSecret || env.adminApiKey;
}

function signPayload(lineUserId, authTs) {
  return crypto
    .createHmac('sha256', authSecret())
    .update(`${lineUserId}.${authTs}`)
    .digest('hex');
}

function buildSignedLineAuth(lineUserId, issuedAt = Date.now()) {
  const authTs = String(issuedAt);
  const authSig = signPayload(lineUserId, authTs);

  return {
    auth_ts: authTs,
    auth_sig: authSig,
  };
}

function verifySignedLineAuth(lineUserId, authTs, authSig) {
  if (!lineUserId || !authTs || !authSig) return false;

  const issuedAt = Number(authTs);
  if (!Number.isFinite(issuedAt)) return false;

  const age = Date.now() - issuedAt;
  if (age < 0 || age > env.lineAuthTtlMs) return false;

  const expected = signPayload(lineUserId, authTs);
  const actualBuffer = Buffer.from(String(authSig));
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

async function fetchLineProfileByAccessToken(accessToken) {
  if (!accessToken) return null;

  try {
    const response = await fetch('https://api.line.me/v2/profile', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.text();
    if (!response.ok) {
      logger.warn(
        '[liff-auth:profile-verify:failed]',
        JSON.stringify({ status: response.status, body: body || null })
      );
      return null;
    }

    return body ? JSON.parse(body) : null;
  } catch (error) {
    logger.warn(
      '[liff-auth:profile-verify:error]',
      JSON.stringify({ message: error.message })
    );
    return null;
  }
}

module.exports = {
  buildSignedLineAuth,
  verifySignedLineAuth,
  fetchLineProfileByAccessToken,
};
