function validateCustomerDispute(payload = {}) {
  if (!payload.reason) return '請提供爭議原因。';
  return null;
}

module.exports = { validateCustomerDispute };
