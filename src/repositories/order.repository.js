const store = require('./store');
const {
  supabase,
  hasSupabase,
  cleanPayload,
  throwIfSupabaseError,
  singleOrNull,
} = require('./supabase.helpers');

async function createOrder(payload) {
  if (hasSupabase()) {
    let { data, error } = await supabase
      .from('orders')
      .insert(cleanPayload(payload))
      .select('*')
      .single();

    if (
      error &&
      payload.contact_name !== undefined &&
      String(error.message || '').includes("'contact_name' column")
    ) {
      const { contact_name, ...fallbackPayload } = payload;
      ({ data, error } = await supabase
        .from('orders')
        .insert(cleanPayload(fallbackPayload))
        .select('*')
        .single());
    }

    throwIfSupabaseError(error);
    return data;
  }

  return store.insert('orders', payload);
}

async function findById(id) {
  if (hasSupabase()) {
    return await singleOrNull(supabase.from('orders').select('*').eq('id', id));
  }

  return store.find('orders', (order) => String(order.id) === String(id));
}

async function listOrders(filters = {}) {
  if (hasSupabase()) {
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.status_not_in)
      query = query.not('status', 'in', `(${filters.status_not_in.join(',')})`);
    if (filters.technician_id)
      query = query.eq('technician_id', filters.technician_id);
    if (filters.customer_id) query = query.eq('customer_id', filters.customer_id);
    if (filters.area) query = query.eq('area', filters.area);
    if (filters.service_type)
      query = query.eq('service_type', filters.service_type);
    if (filters.date_from) query = query.gte('created_at', filters.date_from);
    if (filters.date_to) query = query.lte('created_at', filters.date_to);
    if (filters.updated_before)
      query = query.lt('updated_at', filters.updated_before.toISOString());
    if (filters.risk_level === 'high') query = query.gte('risk_score', 70);

    const { data, error } = await query;
    throwIfSupabaseError(error);
    return data || [];
  }

  return store.filter('orders', (order) => {
    if (filters.status && order.status !== filters.status) return false;
    if (filters.status_not_in && filters.status_not_in.includes(order.status))
      return false;
    if (
      filters.technician_id &&
      String(order.technician_id) !== String(filters.technician_id)
    )
      return false;
    if (
      filters.customer_id &&
      String(order.customer_id) !== String(filters.customer_id)
    )
      return false;
    if (filters.area && order.area !== filters.area) return false;
    if (filters.service_type && order.service_type !== filters.service_type)
      return false;
    if (
      filters.updated_before &&
      new Date(order.updated_at) >= filters.updated_before
    )
      return false;
    return true;
  });
}

async function updateOrder(id, changes) {
  if (hasSupabase()) {
    const { data, error } = await supabase
      .from('orders')
      .update(cleanPayload(changes))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    throwIfSupabaseError(error);
    return data || null;
  }

  return store.update('orders', id, changes);
}

async function getOrderDetail(id) {
  const order = await findById(id);
  if (!order) return null;

  if (hasSupabase()) {
    const [messages, images, logs, assignments, supportTickets] = await Promise.all([
      supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('order_images')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('order_logs')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('assignments')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('support_tickets')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
    ]);

    [messages, images, logs, assignments, supportTickets].forEach((result) =>
      throwIfSupabaseError(result.error)
    );

    return {
      ...order,
      messages: messages.data || [],
      images: images.data || [],
      logs: logs.data || [],
      assignments: assignments.data || [],
      support_tickets: supportTickets.data || [],
    };
  }

  return {
    ...order,
    messages: store.filter(
      'order_messages',
      (item) => String(item.order_id) === String(id)
    ),
    images: store.filter(
      'order_images',
      (item) => String(item.order_id) === String(id)
    ),
    logs: store.filter(
      'order_logs',
      (item) => String(item.order_id) === String(id)
    ),
    assignments: store.filter(
      'assignments',
      (item) => String(item.order_id) === String(id)
    ),
    support_tickets: store.filter(
      'support_tickets',
      (item) => String(item.order_id) === String(id)
    ),
  };
}

module.exports = {
  createOrder,
  findById,
  listOrders,
  updateOrder,
  getOrderDetail,
};
