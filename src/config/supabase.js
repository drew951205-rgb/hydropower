const { createClient } = require('@supabase/supabase-js');
const { env } = require('./env');

function createSupabaseClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null;
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

module.exports = { supabase: createSupabaseClient() };
