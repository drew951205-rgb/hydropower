const ORDER_STATUS = Object.freeze({
  PENDING_REVIEW: 'pending_review',
  WAITING_CUSTOMER_INFO: 'waiting_customer_info',
  PENDING_DISPATCH: 'pending_dispatch',
  DISPATCHING: 'dispatching',
  ASSIGNED: 'assigned',
  ARRIVED: 'arrived',
  QUOTED: 'quoted',
  IN_PROGRESS: 'in_progress',
  COMPLETED_PENDING_CUSTOMER: 'completed_pending_customer',
  CLOSED: 'closed',
  CUSTOMER_CANCELLED: 'customer_cancelled',
  TECHNICIAN_CANCELLED: 'technician_cancelled',
  PLATFORM_CANCELLED: 'platform_cancelled',
  PLATFORM_REVIEW: 'platform_review',
  DISPUTE_REVIEW: 'dispute_review',
});

module.exports = { ORDER_STATUS };
