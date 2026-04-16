function validateCancel(payload = {}) {
  if (!payload.cancelled_by) return 'cancelled_by is required';
  if (!payload.reason_code) return 'reason_code is required';
  return null;
}

module.exports = { validateCancel };
