const { supabase } = require('../config/supabase');

function hasSupabase() {
  return Boolean(supabase);
}

function cleanPayload(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
}

function throwIfSupabaseError(error) {
  if (!error) return;
  const wrapped = new Error(error.message || 'Supabase request failed');
  wrapped.statusCode = 500;
  wrapped.details = error;
  throw wrapped;
}

function isNoRows(error) {
  return error?.code === 'PGRST116';
}

async function singleOrNull(query) {
  const { data, error } = await query.maybeSingle();
  if (error && !isNoRows(error)) throwIfSupabaseError(error);
  return data || null;
}

module.exports = {
  supabase,
  hasSupabase,
  cleanPayload,
  throwIfSupabaseError,
  singleOrNull,
};
