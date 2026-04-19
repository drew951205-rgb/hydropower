const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config();

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function lineFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`LINE API ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function main() {
  if (!token) {
    throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN in .env');
  }

  const configPath = process.argv[2] || 'line-rich-menu/customer-rich-menu.json';
  const imagePath = process.argv[3] || 'line-rich-menu/customer-rich-menu.png';

  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const image = await fs.readFile(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

  const created = await lineFetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  const richMenuId = created.richMenuId;
  await lineFetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: image,
  });

  await lineFetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
  });

  console.log(`Created and set default rich menu: ${richMenuId}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
