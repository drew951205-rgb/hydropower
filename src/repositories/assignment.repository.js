const store = require('./store');
const { supabase, hasSupabase, cleanPayload, throwIfSupabaseError, singleOrNull } = require('./supabase.helpers');

async function createAssignment(payload) {
  if (hasSupabase()) {
    const row = cleanPayload({ status: 'pending', ...payload });
    const { data, error } = await supabase
      .from('assignments')
      .upsert(row, { onConflict: 'order_id,technician_id' })
      .select('*')
      .single();
    throwIfSupabaseError(error);
    return data;
  }

  const existing = store.find('assignments', (assignment) => (
    String(assignment.order_id) === String(payload.order_id) &&
    String(assignment.technician_id) === String(payload.technician_id)
  ));
  if (existing) return existing;
  return store.insert('assignments', { status: 'pending', ...payload });
}

async function findById(id) {
  if (hasSupabase()) {
    return singleOrNull(supabase.from('assignments').select('*').eq('id', id));
  }

  return store.find('assignments', (assignment) => String(assignment.id) === String(id));
}

async function findForTechnician(technicianId) {
  if (hasSupabase()) {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false });
    throwIfSupabaseError(error);
    return data || [];
  }

  return store.filter('assignments', (assignment) => String(assignment.technician_id) === String(technicianId));
}

async function findPendingForOrder(orderId) {
  if (hasSupabase()) {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'pending');
    throwIfSupabaseError(error);
    return data || [];
  }

  return store.filter('assignments', (assignment) => String(assignment.order_id) === String(orderId) && assignment.status === 'pending');
}

async function updateAssignment(id, changes) {
  if (hasSupabase()) {
    const { data, error } = await supabase
      .from('assignments')
      .update(cleanPayload(changes))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    throwIfSupabaseError(error);
    return data || null;
  }

  return store.update('assignments', id, changes);
}

module.exports = { createAssignment, findById, findForTechnician, findPendingForOrder, updateAssignment };
