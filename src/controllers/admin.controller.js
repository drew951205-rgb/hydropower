const adminCrmService = require('../services/admin-crm.service');

async function adminHome(req, res) {
  res.json({
    name: '師傅抵嘉 Admin API',
    endpoints: [
      'GET /api/orders',
      'GET /api/admin/customers',
      'GET /api/admin/customers/:id',
      'POST /api/orders/:id/review',
      'POST /api/orders/:id/dispatch'
    ]
  });
}

async function listCustomers(req, res, next) {
  try {
    res.json({ data: await adminCrmService.listCustomers() });
  } catch (error) {
    next(error);
  }
}

async function getCustomer(req, res, next) {
  try {
    res.json({ data: await adminCrmService.getCustomerDetail(req.params.id) });
  } catch (error) {
    next(error);
  }
}

module.exports = { adminHome, listCustomers, getCustomer };
