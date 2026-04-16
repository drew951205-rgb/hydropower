const crypto = require('crypto');
const { env } = require('../config/env');

function verifyLineSignature(req, res, next) {
  if (env.skipLineSignature) return next();

  const signature = req.header('x-line-signature');
  if (!signature || !env.lineChannelSecret) {
    return res.status(401).json({ error: 'Missing LINE signature configuration' });
  }

  const digest = crypto.createHmac('sha256', env.lineChannelSecret).update(req.rawBody || '').digest('base64');
  const signatureBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);

  if (signatureBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(signatureBuffer, digestBuffer)) {
    return res.status(401).json({ error: 'Invalid LINE signature' });
  }

  next();
}

module.exports = { verifyLineSignature };
