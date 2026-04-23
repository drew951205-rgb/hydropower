const userRepository = require('../repositories/user.repository');

async function roleRouter(req, res, next) {
  const lineUserId = req.query.line_user_id || req.body?.line_user_id;

  if (!lineUserId) {
    req.userRole = 'customer';
    return next();
  }

  try {
    const user = await userRepository.findByLineUserId(lineUserId);
    if (user && user.role === 'technician') {
      req.userRole = 'technician';
      req.userId = user.id;
    } else {
      req.userRole = 'customer';
      req.userId = user?.id;
    }
  } catch (error) {
    console.warn('[role-router:error]', error.message);
    req.userRole = 'customer';
  }

  next();
}

module.exports = { roleRouter };
