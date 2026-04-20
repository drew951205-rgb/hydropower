const userRepository = require('../repositories/user.repository');
const orderRepository = require('../repositories/order.repository');
const supportTicketRepository = require('../repositories/support-ticket.repository');
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

async function listSupportTickets(filters = {}) {
  const [tickets, users, orders] = await Promise.all([
    supportTicketRepository.listTickets(filters),
    userRepository.listUsers({}),
    orderRepository.listOrders({}),
  ]);
  const usersById = new Map(users.map((user) => [String(user.id), user]));
  const ordersById = new Map(orders.map((order) => [String(order.id), order]));

  return tickets.map((ticket) => {
    const order = ticket.order_id ? ordersById.get(String(ticket.order_id)) || null : null;
    const reporter = ticket.user_id ? usersById.get(String(ticket.user_id)) || null : null;
    const customer = order?.customer_id
      ? usersById.get(String(order.customer_id)) || reporter
      : reporter;
    return {
      ...ticket,
      reporter,
      customer,
      order,
    };
  });
}

async function updateSupportTicket(ticketId, payload = {}) {
  const status = String(payload.status || '').trim();
  const replyMessage = String(payload.reply_message || '').trim();
  const allowed = new Set(['open', 'in_progress', 'resolved', 'closed']);
  if (status && !allowed.has(status)) {
    const error = new Error('Invalid support ticket status');
    error.statusCode = 400;
    throw error;
  }

  if (!status && !replyMessage) {
    const error = new Error('Support ticket update is required');
    error.statusCode = 400;
    throw error;
  }

  const ticket = await supportTicketRepository.findById(ticketId);
  if (!ticket) {
    const error = new Error('Support ticket not found');
    error.statusCode = 404;
    throw error;
  }

  const changes = {
    status: status || (replyMessage ? 'in_progress' : ticket.status),
  };

  if (status) {
    changes.resolved_at = ['resolved', 'closed'].includes(status)
      ? new Date().toISOString()
      : null;
  }

  if (replyMessage) {
    changes.admin_reply = replyMessage;
    changes.admin_replied_at = new Date().toISOString();
    changes.admin_replied_by = String(payload.admin_name || 'admin').trim() || 'admin';
  }

  const updated = await supportTicketRepository.updateTicket(ticketId, changes);
  if (!updated) {
    const error = new Error('Support ticket not found');
    error.statusCode = 404;
    throw error;
  }

  if (replyMessage) {
    const order = ticket.order_id ? await orderRepository.findById(ticket.order_id) : null;
    const recipientId =
      ticket.type === 'technician_cancel' && order?.customer_id
        ? order.customer_id
        : ticket.user_id;
    const recipient = recipientId ? await userRepository.findById(recipientId) : null;
    if (recipient?.line_user_id) {
      const orderLine = order?.order_no ? `案件編號：${order.order_no}\n` : '';
      await lineMessageService.pushMessages(
        recipient.line_user_id,
        `【師傅抵嘉客服回覆】\n${orderLine}${replyMessage}`
      );
    }
  }

  return updated;
}

module.exports = {
  listCustomers,
  getCustomerDetail,
  summarizeCustomer,
  broadcastToMembers,
  listSupportTickets,
  updateSupportTicket,
};
