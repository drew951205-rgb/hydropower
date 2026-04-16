function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) console.error(error);
  res.status(statusCode).json({ error: error.message || 'Internal server error' });
}

module.exports = { notFound, errorHandler };
