const store = require('./store');
const {
  supabase,
  hasSupabase,
  cleanPayload,
  throwIfSupabaseError,
  singleOrNull,
} = require('./supabase.helpers');

async function createTicket(payload) {
  if (hasSupabase()) {
    const { data, error } = await supabase
      .from('support_tickets')
      .insert(cleanPayload(payload))
      .select('*')
      .single();
    throwIfSupabaseError(error);
    return data;
  }

  return store.insert('support_tickets', payload);
}

async function findById(id) {
  if (hasSupabase()) {
    return singleOrNull(supabase.from('support_tickets').select('*').eq('id', id));
  }

  return store.find('support_tickets', (ticket) => String(ticket.id) === String(id));
}

async function listTickets(filters = {}) {
  if (hasSupabase()) {
    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (filters.user_id) query = query.eq('user_id', filters.user_id);
    if (filters.order_id) query = query.eq('order_id', filters.order_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.type) query = query.eq('type', filters.type);

    const { data, error } = await query;
    throwIfSupabaseError(error);
    return data || [];
  }

  return store.filter('support_tickets', (ticket) => {
    if (filters.user_id && String(ticket.user_id) !== String(filters.user_id)) return false;
    if (filters.order_id && String(ticket.order_id) !== String(filters.order_id)) return false;
    if (filters.status && ticket.status !== filters.status) return false;
    if (filters.type && ticket.type !== filters.type) return false;
    return true;
  });
}

async function updateTicket(id, changes) {
  if (hasSupabase()) {
    const { data, error } = await supabase
      .from('support_tickets')
      .update(cleanPayload(changes))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    throwIfSupabaseError(error);
    return data || null;
  }

  return store.update('support_tickets', id, changes);
}

module.exports = {
  createTicket,
  findById,
  listTickets,
  updateTicket,
};
