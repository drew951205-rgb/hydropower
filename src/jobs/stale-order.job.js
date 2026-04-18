const orderRepository = require('../repositories/order.repository');
const logRepository = require('../repositories/log.repository');
const { ORDER_STATUS } = require('../utils/order-status');

async function runStaleOrderJob() {
  console.log('[job] Running stale order job...');

  try {
    // 查詢非terminal狀態且超過24小時未更新的orders
    const staleHours = 24;
    const cutoffTime = new Date(Date.now() - staleHours * 60 * 60 * 1000);

    const terminalStatuses = [
      ORDER_STATUS.CLOSED,
      ORDER_STATUS.CUSTOMER_CANCELLED,
      ORDER_STATUS.TECHNICIAN_CANCELLED,
      ORDER_STATUS.PLATFORM_CANCELLED,
    ];

    const staleOrders = await orderRepository.listOrders({
      status_not_in: terminalStatuses,
      updated_before: cutoffTime,
    });

    for (const order of staleOrders) {
      // 記錄stale log
      await logRepository.createLog({
        order_id: order.id,
        from_status: order.status,
        to_status: order.status,
        action: 'stale_check',
        operator_role: 'system',
        operator_id: null,
        note: `Order has been stale for ${staleHours} hours`,
      });

      console.log(`[job] Marked order ${order.order_no} as stale`);
    }

    console.log(`[job] Checked ${staleOrders.length} stale orders`);
  } catch (error) {
    console.error('[job] Stale order job failed:', error);
  }
}

module.exports = { runStaleOrderJob };
