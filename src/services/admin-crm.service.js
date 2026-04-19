const userRepository = require('../repositories/user.repository');
const orderRepository = require('../repositories/order.repository');
const lineMessageService = require('./line-message.service');

function latestDate(values) {
  return values.filter(Boolean).sort().at(-1) || null;
}

function summarizeCustomer(customer, orders) {
  const customerOrders = orders.filter((order) => String(order.customer_id) === String(customer.id));
  const closedOrders = customerOrders.filter((order) => order.status === 'closed');
  const cancelledOrders = customerOrders.filter((order) => String(order.status || '').includes('cancelled'));
  const totalAmount = customerOrders.reduce((sum, order) => {
    const amount = Number(order.paid_amount || order.final_amount || order.quote_amount || 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const ratedOrders = customerOrders.filter((order) => Number(order.rating));
  const averageRating = ratedOrders.length
    ? ratedOrders.reduce((sum, order) => sum + Number(order.rating), 0) / ratedOrders.length
    : null;

  return {
    ...customer,
    order_count: customerOrders.length,
    closed_order_count: closedOrders.length,
    cancelled_order_count: cancelledOrders.length,
    total_amount: totalAmount,
    average_rating: averageRating,
    last_order_at: latestDate(customerOrders.map((order) => order.created_at)),
    last_interaction_at: latestDate([
      customer.updated_at,
      ...customerOrders.map((order) => order.updated_at || order.created_at)
    ])
  };
}

async function listCustomers() {
  const [users, orders] = await Promise.all([
    userRepository.listUsers({}),
    orderRepository.listOrders({})
  ]);
  const customerIds = new Set(orders.map((order) => String(order.customer_id)));
  const customers = users.filter((user) => {
    if (user.role === 'admin') return false;
    if (user.role === 'customer') return true;
    if (customerIds.has(String(user.id))) return true;
    return Boolean(user.phone || user.default_address || user.line_display_name);
  });

  return customers
    .map((customer) => summarizeCustomer(customer, orders))
    .sort((a, b) => new Date(b.last_interaction_at || b.created_at) - new Date(a.last_interaction_at || a.created_at));
}

async function getCustomerDetail(customerId) {
  const customer = await userRepository.findById(customerId);
  if (!customer || customer.role !== 'customer') {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    throw error;
  }

  const orders = await orderRepository.listOrders({ customer_id: customer.id });
  const orderDetails = await Promise.all(
    orders.map((order) => orderRepository.getOrderDetail(order.id))
  );
  const ordersWithCounts = orderDetails.map((order) => ({
    ...order,
    image_count: order.images?.length || 0,
    message_count: order.messages?.length || 0,
  }));
  const summary = summarizeCustomer(customer, ordersWithCounts);

  return {
    ...summary,
    orders: ordersWithCounts
  };
}

function isBroadcastMember(user) {
  if (user.role !== 'customer') return false;
  if (user.status && user.status !== 'active') return false;
  if (!user.line_user_id) return false;
  return Boolean(user.is_member || user.member_terms_accepted_at);
}

async function broadcastToMembers(payload) {
  const title = String(payload.title || '').trim();
  const message = String(payload.message || '').trim();
  if (!title) {
    const error = new Error('Broadcast title is required');
    error.statusCode = 400;
    throw error;
  }
  if (!message) {
    const error = new Error('Broadcast message is required');
    error.statusCode = 400;
    throw error;
  }

  const users = await userRepository.listUsers({ role: 'customer' });
  const members = users.filter(isBroadcastMember);
  const text = [`【師傅抵嘉】${title}`, '', message].join('\n');
  const results = [];

  for (const member of members) {
    const result = await lineMessageService.pushMessages(member.line_user_id, text);
    results.push({
      user_id: member.id,
      line_user_id: member.line_user_id,
      ok: result.ok !== false,
      dry_run: Boolean(result.dryRun),
      status: result.status || null,
    });
  }

  return {
    target_count: members.length,
    sent_count: results.filter((item) => item.ok).length,
    results,
  };
}

module.exports = {
  listCustomers,
  getCustomerDetail,
  summarizeCustomer,
  broadcastToMembers,
};
