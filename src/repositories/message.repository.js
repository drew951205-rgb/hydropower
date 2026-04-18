const store = require('./store');
const {
  supabase,
  hasSupabase,
  cleanPayload,
  throwIfSupabaseError,
} = require('./supabase.helpers');

async function createMessage(payload) {
  if (hasSupabase()) {
    const { data, error } = await supabase
      .from('order_messages')
      .insert(cleanPayload(payload))
      .select('*')
      .single();
    throwIfSupabaseError(error);
    return data;
  }

  return store.insert('order_messages', payload);
}

module.exports = { createMessage };
