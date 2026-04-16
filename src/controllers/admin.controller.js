async function adminHome(req, res) {
  res.json({
    name: '師傅抵嘉 Admin API',
    endpoints: ['GET /api/orders', 'POST /api/orders/:id/review', 'POST /api/orders/:id/dispatch']
  });
}

module.exports = { adminHome };
