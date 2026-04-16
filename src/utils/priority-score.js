function calculatePriorityScore(payload = {}) {
  let score = 50;
  const text = `${payload.service_type || ''} ${payload.issue_description || ''}`;
  if (/漏水|淹水|停電|漏電|堵塞/.test(text)) score += 25;
  if (/緊急|現在|馬上|今天/.test(text)) score += 20;
  return Math.min(score, 100);
}

module.exports = { calculatePriorityScore };
