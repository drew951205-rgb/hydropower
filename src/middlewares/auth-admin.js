const { env } = require('../config/env');

function authAdmin(req, res, next) {
  if (req.header('x-admin-api-key') !== env.adminApiKey) return res.status(401).json({ error: 'Unauthorized admin API request' });
  next();
}

module.exports = { authAdmin };
