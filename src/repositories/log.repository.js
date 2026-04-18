const store = require('./store');
const {
  supabase,
  hasSupabase,
  cleanPayload,
  throwIfSupabaseError,
} = require('./supabase.helpers');

async function createLog(payload) {
  if (hasSupabase()) {
    const { data, error } = await supabase
      .from('order_logs')
      .insert(cleanPayload(payload))
      .select('*')
      .single();
    throwIfSupabaseError(error);
    return data;
  }

  return store.insert('order_logs', payload);
}

module.exports = { createLog };
