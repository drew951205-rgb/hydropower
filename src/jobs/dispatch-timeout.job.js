const assignmentRepository = require('../repositories/assignment.repository');
const orderRepository = require('../repositories/order.repository');
const logRepository = require('../repositories/log.repository');
const userRepository = require('../repositories/user.repository');
const lineMessageService = require('../services/line-message.service');
const { dispatchTimeoutMessage } = require('../templates/customer-messages');
const { ORDER_STATUS } = require('../utils/order-status');
const { env } = require('../config/env');

async function runDispatchTimeoutJob() {
  console.log('[job] Running dispatch timeout job...');

  try {
    const timeoutMs = Math.max(1, env.dispatchTimeoutMinutes) * 60 * 1000;
    const cutoffTime = new Date(Date.now() - timeoutMs);

    const staleAssignments = await assignmentRepository.listAssignments({
      status: 'pending',
      created_before: cutoffTime
    });

    for (const assignment of staleAssignments) {
      await assignmentRepository.updateAssignment(assignment.id, {
        status: 'expired'
      });

      const order = await orderRepository.findById(assignment.order_id);
      if (!order || order.status !== ORDER_STATUS.DISPATCHING) continue;

      const activeAssignments = await assignmentRepository.listAssignments({
        order_id: order.id,
        status: 'pending'
      });

      if (activeAssignments.length === 0) {
        const updated = await orderRepository.updateOrder(order.id, {
          status: ORDER_STATUS.PENDING_DISPATCH
        });

        await logRepository.createLog({
          order_id: order.id,
          from_status: order.status,
          to_status: updated.status,
          action: 'dispatch_timeout',
          operator_role: 'system',
          operator_id: null,
          note: `No technicians accepted within ${env.dispatchTimeoutMinutes} minutes`
        });

        await notifyCustomerDispatchTimeout(updated);
      }
    }

    console.log(`[job] Expired ${staleAssignments.length} stale assignments`);
  } catch (error) {
    console.error('[job] Dispatch timeout job failed:', error);
  }
}

async function notifyCustomerDispatchTimeout(order) {
  const customer = await userRepository.findById(order.customer_id);
  if (!customer?.line_user_id) {
    console.warn('[dispatch-timeout:customer-push:skip]', JSON.stringify({
      orderId: order.id,
      orderNo: order.order_no,
      customerId: order.customer_id,
      reason: 'missing_customer_line_user_id',
    }));
    return { skipped: true };
  }

  console.log('[dispatch-timeout:customer-push]', JSON.stringify({
    orderId: order.id,
    orderNo: order.order_no,
    customerId: customer.id,
    customerLineUserId: customer.line_user_id,
  }));

  return lineMessageService.pushMessages(
    customer.line_user_id,
    dispatchTimeoutMessage(order)
  );
}

module.exports = { runDispatchTimeoutJob };
