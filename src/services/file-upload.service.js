const { supabase, hasSupabase } = require('../repositories/supabase.helpers');
const { env } = require('../config/env');

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = Number(env.uploadMaxFileSize || 5242880);
const maxFiles = Number(env.uploadMaxFiles || 3);

function validateImages(files = []) {
  if (files.length > maxFiles) return `每次最多上傳 ${maxFiles} 張圖片。`;
  for (const file of files) {
    if (!allowedMimeTypes.has(file.mimetype))
      return '圖片格式只支援 jpg、png、webp。';
    if (file.size > maxBytes)
      return `單張圖片不可超過 ${maxBytes / 1024 / 1024}MB。`;
  }
  return null;
}

async function uploadImages(files, category = 'general') {
  if (!hasSupabase())
    throw new Error('Supabase not configured for file upload');

  const uploaded = [];
  for (const file of files) {
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${file.mimetype.split('/')[1]}`;
    const filePath = `uploads/${category}/${fileName}`;

    const { error } = await supabase.storage
      .from('images')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    uploaded.push({
      url: publicUrl.publicUrl,
      path: filePath,
      size: file.size,
      mimetype: file.mimetype,
    });
  }

  return uploaded;
}

module.exports = { validateImages, uploadImages };
