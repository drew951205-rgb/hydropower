const express = require('express');
const adminController = require('../controllers/admin.controller');
const { authAdmin } = require('../middlewares/auth-admin');

const router = express.Router();
router.get('/', authAdmin, adminController.adminHome);
router.get('/customers', authAdmin, adminController.listCustomers);
router.get('/customers/:id', authAdmin, adminController.getCustomer);

module.exports = router;
