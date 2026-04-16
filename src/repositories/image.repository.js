const store = require('./store');
const { supabase, hasSupabase, throwIfSupabaseError } = require('./supabase.helpers');

async function createImages(orderId, images = [], category) {
  if (hasSupabase()) {
    if (!images.length) return [];
    const rows = images.map((imageUrl) => ({ order_id: orderId, image_url: imageUrl, category }));
    const { data, error } = await supabase
      .from('order_images')
      .insert(rows)
      .select('*');
    throwIfSupabaseError(error);
    return data || [];
  }

  return Promise.all(images.map((imageUrl) => store.insert('order_images', { order_id: orderId, image_url: imageUrl, category })));
}

module.exports = { createImages };
