const userRepository = require('../repositories/user.repository');
const assignmentRepository = require('../repositories/assignment.repository');

async function createTechnician(req, res, next) {
  try {
    if (!req.body.line_user_id)
      return res.status(400).json({ error: 'line_user_id is required' });
    if (!req.body.name)
      return res.status(400).json({ error: 'name is required' });

    const data = await userRepository.createUser({
      line_user_id: req.body.line_user_id,
      role: 'technician',
      name: req.body.name,
      phone: req.body.phone,
      status: req.body.status || 'active',
      available: req.body.available ?? true,
      service_areas: req.body.service_areas || [],
      service_types: req.body.service_types || [],
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

async function listTechnicians(req, res, next) {
  try {
    const data = await userRepository.listUsers({
      role: 'technician',
      status: req.query.status,
      available: req.query.available,
    });
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function toggleAvailability(req, res, next) {
  try {
    const updated = await userRepository.updateUser(req.params.id, {
      available: Boolean(req.body.available),
      service_areas: req.body.service_areas || [],
      service_types: req.body.service_types || [],
    });
    if (!updated)
      return res.status(404).json({ error: 'Technician not found' });
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}

async function listAssignments(req, res, next) {
  try {
    res.json({
      data: await assignmentRepository.findForTechnician(req.params.id),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTechnician,
  listTechnicians,
  toggleAvailability,
  listAssignments,
};
