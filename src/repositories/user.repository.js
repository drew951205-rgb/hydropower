const store = require('./store');
const {
  supabase,
  hasSupabase,
  cleanPayload,
  throwIfSupabaseError,
  singleOrNull,
} = require('./supabase.helpers');

async function findByLineUserId(lineUserId) {
  if (hasSupabase()) {
    return await singleOrNull(
      supabase.from('users').select('*').eq('line_user_id', lineUserId)
    );
  }

  return store.find('users', (user) => user.line_user_id === lineUserId);
}

async function findById(id) {
  if (hasSupabase()) {
    return await singleOrNull(supabase.from('users').select('*').eq('id', id));
  }

  return store.find('users', (user) => String(user.id) === String(id));
}

async function findOrCreateByLineUserId(lineUserId, defaults = {}) {
  const existing = await findByLineUserId(lineUserId);
  if (existing) return existing;

  const payload = {
    line_user_id: lineUserId,
    role: defaults.role || 'customer',
    name: defaults.name || null,
    phone: defaults.phone || null,
    trust_score: 0,
    status: 'active',
    available: false,
    service_areas: [],
    service_types: [],
  };

  if (hasSupabase()) {
    const { data, error } = await supabase
      .from('users')
      .insert(payload)
      .select('*')
      .single();
    if (error && error.code === '23505') return findByLineUserId(lineUserId);
    throwIfSupabaseError(error);
    return data;
  }

  return store.insert('users', payload);
}

async function updateUser(id, changes) {
  if (hasSupabase()) {
    const { data, error } = await supabase
      .from('users')
      .update(cleanPayload(changes))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    throwIfSupabaseError(error);
    return data || null;
  }

  return store.update('users', id, changes);
}

async function createUser(payload) {
  const row = {
    line_user_id: payload.line_user_id || null,
    role: payload.role || 'customer',
    name: payload.name || null,
    phone: payload.phone || null,
    trust_score: payload.trust_score ?? 0,
    status: payload.status || 'active',
    available: Boolean(payload.available),
    service_areas: payload.service_areas || [],
    service_types: payload.service_types || [],
  };

  if (hasSupabase()) {
    const { data, error } = await supabase
      .from('users')
      .insert(cleanPayload(row))
      .select('*')
      .single();
    throwIfSupabaseError(error);
    return data;
  }

  return store.insert('users', row);
}

async function listUsers(filters = {}) {
  if (hasSupabase()) {
    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (filters.role) query = query.eq('role', filters.role);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.available !== undefined)
      query = query.eq(
        'available',
        filters.available === true || filters.available === 'true'
      );

    const { data, error } = await query;
    throwIfSupabaseError(error);
    return data || [];
  }

  return store.filter('users', (user) => {
    if (filters.role && user.role !== filters.role) return false;
    if (filters.status && user.status !== filters.status) return false;
    if (
      filters.available !== undefined &&
      user.available !==
        (filters.available === true || filters.available === 'true')
    )
      return false;
    return true;
  });
}

async function listAvailableTechnicians({ area, serviceType } = {}) {
  if (hasSupabase()) {
    let query = supabase
      .from('users')
      .select('*')
      .eq('role', 'technician')
      .eq('status', 'active')
      .eq('available', true);

    const { data, error } = await query;
    throwIfSupabaseError(error);

    return (data || []).filter((user) => {
      const areaMatch =
        !area ||
        !user.service_areas?.length ||
        user.service_areas.includes(area);
      const typeMatch =
        !serviceType ||
        !user.service_types?.length ||
        user.service_types.includes(serviceType);
      return areaMatch && typeMatch;
    });
  }

  return store.filter('users', (user) => {
    if (
      user.role !== 'technician' ||
      user.status !== 'active' ||
      !user.available
    )
      return false;
    const areaMatch =
      !area || !user.service_areas?.length || user.service_areas.includes(area);
    const typeMatch =
      !serviceType ||
      !user.service_types?.length ||
      user.service_types.includes(serviceType);
    return areaMatch && typeMatch;
  });
}

module.exports = {
  findByLineUserId,
  findById,
  findOrCreateByLineUserId,
  updateUser,
  createUser,
  listUsers,
  listAvailableTechnicians,
};
