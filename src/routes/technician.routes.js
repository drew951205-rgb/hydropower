const express = require('express');
const technicianController = require('../controllers/technician.controller');
const { authAdmin } = require('../middlewares/auth-admin');

const router = express.Router();
router.get('/', authAdmin, technicianController.listTechnicians);
router.post('/', authAdmin, technicianController.createTechnician);
router.post('/:id/toggle-availability', authAdmin, technicianController.toggleAvailability);
router.get('/:id/assignments', authAdmin, technicianController.listAssignments);

module.exports = router;
