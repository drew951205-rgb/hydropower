const store = require('./store');
const {
  supabase,
  hasSupabase,
  cleanPayload,
  throwIfSupabaseError,
  singleOrNull,
} = require('./supabase.helpers');

async function findByUserId(userId) {
  if (hasSupabase()) {
    return singleOrNull(
      supabase.from('customer_sessions').select('*').eq('user_id', userId)
    );
  }

  return store.find(
    'customer_sessions',
    (session) => String(session.user_id) === String(userId)
  );
}

async function upsertForUser(userId, payload) {
  if (hasSupabase()) {
    const row = cleanPayload({
      user_id: userId,
      flow_type: payload.flow_type || null,
      current_step: payload.current_step || null,
      temp_payload: payload.temp_payload || {},
    });

    const { data, error } = await supabase
      .from('customer_sessions')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();
    throwIfSupabaseError(error);
    return data;
  }

  const existing = await findByUserId(userId);
  if (existing) return store.update('customer_sessions', existing.id, payload);
  return store.insert('customer_sessions', {
    user_id: userId,
    flow_type: payload.flow_type || null,
    current_step: payload.current_step || null,
    temp_payload: payload.temp_payload || {},
  });
}

async function clearForUser(userId) {
  if (hasSupabase()) {
    const { error } = await supabase
      .from('customer_sessions')
      .delete()
      .eq('user_id', userId);
    throwIfSupabaseError(error);
    return;
  }

  store.removeWhere(
    'customer_sessions',
    (session) => String(session.user_id) === String(userId)
  );
}

module.exports = { findByUserId, upsertForUser, clearForUser };
