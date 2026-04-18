const store = require('./store');
const {
  supabase,
  hasSupabase,
  cleanPayload,
  throwIfSupabaseError,
  singleOrNull,
} = require('./supabase.helpers');

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

  const existing = store.find(
    'assignments',
    (assignment) =>
      String(assignment.order_id) === String(payload.order_id) &&
      String(assignment.technician_id) === String(payload.technician_id)
  );
  if (existing) return existing;
  return store.insert('assignments', { status: 'pending', ...payload });
}

async function findById(id) {
  if (hasSupabase()) {
    return await singleOrNull(
      supabase.from('assignments').select('*').eq('id', id)
    );
  }

  return store.find(
    'assignments',
    (assignment) => String(assignment.id) === String(id)
  );
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

  return store.filter(
    'assignments',
    (assignment) => String(assignment.technician_id) === String(technicianId)
  );
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

  return store.filter(
    'assignments',
    (assignment) =>
      String(assignment.order_id) === String(orderId) &&
      assignment.status === 'pending'
  );
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

async function listAssignments(filters = {}) {
  if (hasSupabase()) {
    let query = supabase.from('assignments').select('*');

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.order_id) query = query.eq('order_id', filters.order_id);
    if (filters.technician_id)
      query = query.eq('technician_id', filters.technician_id);
    if (filters.created_before)
      query = query.lt('created_at', filters.created_before.toISOString());

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    throwIfSupabaseError(error);
    return data || [];
  }

  let assignments = store.getAll('assignments') || [];

  if (filters.status) {
    assignments = assignments.filter((a) => a.status === filters.status);
  }
  if (filters.order_id) {
    assignments = assignments.filter(
      (a) => String(a.order_id) === String(filters.order_id)
    );
  }
  if (filters.technician_id) {
    assignments = assignments.filter(
      (a) => String(a.technician_id) === String(filters.technician_id)
    );
  }
  if (filters.created_before) {
    assignments = assignments.filter(
      (a) => new Date(a.created_at) < filters.created_before
    );
  }

  return assignments.sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

module.exports = {
  createAssignment,
  findById,
  findForTechnician,
  findPendingForOrder,
  updateAssignment,
  listAssignments,
};
