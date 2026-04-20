const express = require('express');
const adminController = require('../controllers/admin.controller');
const { authAdmin } = require('../middlewares/auth-admin');

const router = express.Router();
router.get('/', authAdmin, adminController.adminHome);
router.get('/customers', authAdmin, adminController.listCustomers);
router.get('/customers/:id', authAdmin, adminController.getCustomer);
router.get('/support-tickets', authAdmin, adminController.listSupportTickets);
router.patch('/support-tickets/:id', authAdmin, adminController.updateSupportTicket);
router.post('/broadcasts/members', authAdmin, adminController.broadcastMembers);

module.exports = router;
