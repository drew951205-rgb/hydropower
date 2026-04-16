function calculateRiskScore(payload = {}) {
  let score = 0;
  const text = `${payload.issue_description || ''} ${payload.address || ''}`;
  if (text.length < 12) score += 20;
  if (/漏電|火花|燒焦|冒煙/.test(text)) score += 40;
  if (!payload.contact_phone) score += 15;
  return Math.min(score, 100);
}

module.exports = { calculateRiskScore };
