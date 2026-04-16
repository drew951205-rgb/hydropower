const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 5 * 1024 * 1024;
const maxFiles = 3;

function validateImages(files = []) {
  if (files.length > maxFiles) return `每次最多上傳 ${maxFiles} 張圖片。`;
  for (const file of files) {
    if (!allowedMimeTypes.has(file.mimetype)) return '圖片格式只支援 jpg、png、webp。';
    if (file.size > maxBytes) return '單張圖片不可超過 5MB。';
  }
  return null;
}

module.exports = { validateImages };
