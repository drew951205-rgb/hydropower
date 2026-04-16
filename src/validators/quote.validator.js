function validateQuote(payload = {}) {
  if (!Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0) return 'amount must be greater than 0';
  return null;
}

module.exports = { validateQuote };
