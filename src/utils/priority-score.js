function calculatePriorityScore(payload = {}) {
  let score = 50;
  const text = `${payload.service_type || ''} ${payload.issue_description || ''}`;
  if (/漏水|淹水|停電|漏電|堵塞/.test(text)) score += 25;
  if (/緊急|現在|馬上|今天/.test(text)) score += 20;
  if (payload.service_mode === 'urgent') score += 10;
  if (/越快|馬上|立即|急|現在|今天/.test(payload.preferred_time_text || ''))
    score += 10;
  return Math.min(score, 100);
}

module.exports = { calculatePriorityScore };
