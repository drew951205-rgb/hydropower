const userRepository = require('../repositories/user.repository');
const { logger } = require('../config/logger');
const { verifySignedLineAuth } = require('../services/liff-auth.service');
const { env } = require('../config/env');

async function roleRouter(req, res, next) {
  const lineUserId = req.query.line_user_id || req.body?.line_user_id;
  const authTs = req.query.auth_ts || req.body?.auth_ts || req.header('x-line-auth-ts');
  const authSig = req.query.auth_sig || req.body?.auth_sig || req.header('x-line-auth-sig');
  const authVerified = verifySignedLineAuth(lineUserId, authTs, authSig);

  req.lineAuthVerified = authVerified;

  if (!lineUserId) {
    req.userRole = 'customer';
    return next();
  }

  try {
    const user = await userRepository.findByLineUserId(lineUserId);
    if (user && user.role === 'technician' && (authVerified || env.nodeEnv !== 'production')) {
      req.userRole = 'technician';
      req.userId = user.id;
    } else {
      req.userRole = 'customer';
      req.userId = user?.id;
    }
  } catch (error) {
    logger.warn('[role-router:error]', error.message);
    req.userRole = 'customer';
  }

  next();
}

module.exports = { roleRouter };
