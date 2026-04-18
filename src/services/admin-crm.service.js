const userRepository = require('../repositories/user.repository');
const orderRepository = require('../repositories/order.repository');

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

  return {
    ...customer,
    order_count: customerOrders.length,
    closed_order_count: closedOrders.length,
    cancelled_order_count: cancelledOrders.length,
    total_amount: totalAmount,
    last_order_at: latestDate(customerOrders.map((order) => order.created_at)),
    last_interaction_at: latestDate([
      customer.updated_at,
      ...customerOrders.map((order) => order.updated_at || order.created_at)
    ])
  };
}

async function listCustomers() {
  const [customers, orders] = await Promise.all([
    userRepository.listUsers({ role: 'customer' }),
    orderRepository.listOrders({})
  ]);

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
  const summary = summarizeCustomer(customer, orders);

  return {
    ...summary,
    orders
  };
}

module.exports = { listCustomers, getCustomerDetail, summarizeCustomer };
