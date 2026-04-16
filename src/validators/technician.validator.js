function validateAvailability(payload = {}) {
  if (typeof payload.available !== 'boolean') return 'available 必須是 boolean。';
  return null;
}

module.exports = { validateAvailability };
