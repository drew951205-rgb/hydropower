const assignmentRepository = require('../repositories/assignment.repository');
const orderRepository = require('../repositories/order.repository');
const userRepository = require('../repositories/user.repository');
const orderService = require('./order.service');
const lineMessageService = require('./line-message.service');
const {
  assignmentMessage,
  assignedMessage,
} = require('../templates/technician-messages');
const { assignedCustomerMessage } = require('../templates/customer-messages');
const { ORDER_STATUS } = require('../utils/order-status');

function assertCanDispatch(order) {
  if (
    ![ORDER_STATUS.PENDING_DISPATCH, ORDER_STATUS.DISPATCHING].includes(
      order.status
    )
  ) {
    const error = new Error(
      `Order cannot be dispatched from status: ${order.status}`
    );
    error.statusCode = 409;
    throw error;
  }
}

async function dispatchOrder(
  orderId,
  technicianIds,
  operator = { role: 'admin', id: null }
) {
  const order = await orderRepository.findById(orderId);
  if (!order)
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  assertCanDispatch(order);

  const orderDetail = await orderRepository.getOrderDetail(order.id);
  const assignments = [];
  for (const technicianId of technicianIds.slice(0, 5)) {
    const assignment = await assignmentRepository.createAssignment({
      order_id: order.id,
      technician_id: technicianId,
      status: 'pending',
    });
    assignments.push(assignment);
    const technician = await userRepository.findById(technicianId);
    if (technician?.line_user_id)
      await lineMessageService.pushMessages(
        technician.line_user_id,
        assignmentMessage(orderDetail || order, assignment)
      );
  }

  await orderService.transitionOrder(
    order.id,
    ORDER_STATUS.DISPATCHING,
    'dispatch_order',
    operator.role,
    operator.id,
    `Dispatched to ${assignments.length} technicians`
  );
  return assignments;
}

async function autoDispatchOrder(
  orderId,
  operator = { role: 'admin', id: null }
) {
  const order = await orderRepository.findById(orderId);
  if (!order)
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  assertCanDispatch(order);

  const technicians = await userRepository.listAvailableTechnicians({
    area: order.area,
    serviceType: order.service_type,
  });
  return dispatchOrder(
    order.id,
    technicians.slice(0, 5).map((item) => item.id),
    operator
  );
}

async function acceptAssignment(assignmentId, technicianUser) {
  const assignment = await assignmentRepository.findById(assignmentId);
  if (!assignment || assignment.status !== 'pending')
    throw Object.assign(new Error('Assignment is not available'), {
      statusCode: 409,
    });

  const order = await orderRepository.findById(assignment.order_id);
  if (
    !order ||
    ![ORDER_STATUS.DISPATCHING, ORDER_STATUS.PENDING_DISPATCH].includes(
      order.status
    )
  ) {
    throw Object.assign(new Error('Order is not available'), {
      statusCode: 409,
    });
  }

  await assignmentRepository.updateAssignment(assignment.id, {
    status: 'accepted',
  });
  const pendingAssignments = await assignmentRepository.findPendingForOrder(
    order.id
  );
  await Promise.all(
    pendingAssignments.map((item) =>
      assignmentRepository.updateAssignment(item.id, { status: 'expired' })
    )
  );

  const updated = await orderService.transitionOrder(
    order.id,
    ORDER_STATUS.ASSIGNED,
    'accept_assignment',
    'technician',
    technicianUser.id,
    'Technician accepted assignment',
    {
      technician_id: technicianUser.id,
    }
  );
  const updatedDetail = await orderRepository.getOrderDetail(updated.id);
  await lineMessageService.pushMessages(
    technicianUser.line_user_id,
    assignedMessage(updatedDetail || updated)
  );
  await notifyCustomerAssigned(updated, technicianUser);
  return updated;
}

async function assignOrder(
  orderId,
  technicianId,
  operator = { role: 'admin', id: null }
) {
  const order = await orderRepository.findById(orderId);
  if (!order)
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  assertCanDispatch(order);

  const assignment = await assignmentRepository.createAssignment({
    order_id: orderId,
    technician_id: technicianId,
    status: 'accepted',
  });
  await assignmentRepository.updateAssignment(assignment.id, {
    status: 'accepted',
  });
  const updated = await orderService.transitionOrder(
    orderId,
    ORDER_STATUS.ASSIGNED,
    'manual_assign_order',
    operator.role,
    operator.id,
    'Admin manually assigned technician',
    { technician_id: technicianId }
  );
  const technician = await userRepository.findById(technicianId);
  await notifyCustomerAssigned(updated, technician);
  return updated;
}

async function notifyCustomerAssigned(order, technician) {
  const customer = await userRepository.findById(order.customer_id);
  if (!customer?.line_user_id) {
    console.warn('[dispatch:customer-assigned-push:skip]', JSON.stringify({
      orderId: order.id,
      orderNo: order.order_no,
      customerId: order.customer_id,
      technicianId: technician?.id || order.technician_id,
      reason: 'missing_customer_line_user_id'
    }));
    return { skipped: true };
  }

  console.log('[dispatch:customer-assigned-push]', JSON.stringify({
    orderId: order.id,
    orderNo: order.order_no,
    customerId: customer.id,
    customerLineUserId: customer.line_user_id,
    technicianId: technician?.id || order.technician_id
  }));

  return lineMessageService.pushMessages(
    customer.line_user_id,
    assignedCustomerMessage(order, technician)
  );
}

module.exports = {
  dispatchOrder,
  autoDispatchOrder,
  acceptAssignment,
  assignOrder,
};
