const assignmentRepository = require('../repositories/assignment.repository');
const orderRepository = require('../repositories/order.repository');
const orderService = require('../services/order.service');
const { ORDER_STATUS } = require('../utils/order-status');

async function runDispatchTimeoutJob() {
  console.log('[job] Running dispatch timeout job...');

  try {
    // 查詢超過5分鐘的pending assignments
    const timeoutMs = 5 * 60 * 1000; // 5分鐘
    const cutoffTime = new Date(Date.now() - timeoutMs);

    const staleAssignments = await assignmentRepository.listAssignments({
      status: 'pending',
      created_before: cutoffTime,
    });

    for (const assignment of staleAssignments) {
      // 將assignment標記為expired
      await assignmentRepository.updateAssignment(assignment.id, {
        status: 'expired',
      });

      // 檢查order是否還有其他pending assignments
      const order = await orderRepository.findById(assignment.order_id);
      if (order) {
        const activeAssignments = await assignmentRepository.listAssignments({
          order_id: order.id,
          status: 'pending',
        });

        if (activeAssignments.length === 0) {
          // 如果沒有其他pending assignments，將order設為pending_dispatch重新派單
          await orderService.updateOrderStatus(
            order.id,
            ORDER_STATUS.PENDING_DISPATCH,
            { role: 'system', id: null },
            'No technicians accepted within timeout'
          );
        }
      }
    }

    console.log(`[job] Expired ${staleAssignments.length} stale assignments`);
  } catch (error) {
    console.error('[job] Dispatch timeout job failed:', error);
  }
}

module.exports = { runDispatchTimeoutJob };
