const userRepository = require('../repositories/user.repository');
const orderRepository = require('../repositories/order.repository');
const assignmentRepository = require('../repositories/assignment.repository');

const activeOrderStatuses = new Set([
  'assigned',
  'quoted',
  'in_progress',
  'arrived',
  'completed_pending_customer',
  'platform_review',
]);

const todayOrderStatuses = new Set([
  'assigned',
  'quoted',
  'in_progress',
  'arrived',
  'completed_pending_customer',
  'closed',
]);

const DEFAULT_DAILY_JOB_LIMIT = 3;
const DEFAULT_ACTIVE_JOB_LIMIT = 1;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function includesValue(values, value) {
  if (!value) return true;
  if (!Array.isArray(values) || values.length === 0) return true;
  return values.includes(value);
}

function countTechnicianOrders(orders, technicianId, predicate) {
  return orders.filter((order) =>
    String(order.technician_id) === String(technicianId) && predicate(order)
  ).length;
}

function countRecentRejectedAssignments(assignments, technicianId) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return assignments.filter((assignment) =>
    String(assignment.technician_id) === String(technicianId) &&
    assignment.status === 'rejected' &&
    new Date(assignment.updated_at || assignment.created_at || 0) >= cutoff
  ).length;
}

function technicianLimits(technician) {
  return {
    daily_job_limit: Number(technician.daily_job_limit || DEFAULT_DAILY_JOB_LIMIT),
    active_job_limit: Number(technician.active_job_limit || DEFAULT_ACTIVE_JOB_LIMIT),
  };
}

function scoreCandidate({ order, technician, activeCount, todayCount, recentRejectCount }) {
  const reasons = [];
  const warnings = [];
  let score = 0;

  if (includesValue(technician.service_types, order.service_type)) {
    score += Array.isArray(technician.service_types) && technician.service_types.length ? 40 : 20;
    reasons.push('服務類型符合');
  }

  if (includesValue(technician.service_areas, order.area)) {
    score += Array.isArray(technician.service_areas) && technician.service_areas.length ? 25 : 12;
    reasons.push('服務區域符合');
  }

  if (activeCount === 0) {
    score += 20;
    reasons.push('目前沒有進行中案件');
  } else {
    score -= 40 * activeCount;
    warnings.push(`目前有 ${activeCount} 張進行中案件`);
  }

  score += Math.max(0, 10 - todayCount * 5);
  if (todayCount > 0) warnings.push(`今日已接 ${todayCount} 張`);

  const trustScore = Number(technician.trust_score || 0);
  if (trustScore > 0) score += Math.min(10, trustScore);

  if (recentRejectCount > 0) {
    score -= recentRejectCount * 10;
    warnings.push(`近 30 天取消或拒絕 ${recentRejectCount} 次`);
  }

  return {
    score: Math.max(0, Math.round(score)),
    reasons,
    warnings,
  };
}

async function listDispatchCandidates(orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) {
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }

  const [technicians, orders, assignments] = await Promise.all([
    userRepository.listUsers({ role: 'technician' }),
    orderRepository.listOrders({}),
    assignmentRepository.listAssignments({}),
  ]);
  const todayStart = startOfToday();

  return technicians
    .map((technician) => {
      const limits = technicianLimits(technician);
      const activeCount = countTechnicianOrders(
        orders,
        technician.id,
        (item) => activeOrderStatuses.has(item.status)
      );
      const todayCount = countTechnicianOrders(
        orders,
        technician.id,
        (item) =>
          todayOrderStatuses.has(item.status) &&
          new Date(item.created_at || 0) >= todayStart
      );
      const recentRejectCount = countRecentRejectedAssignments(assignments, technician.id);
      const hardBlocks = [];

      if (technician.status !== 'active') hardBlocks.push('師傅狀態不是 active');
      if (!technician.available) hardBlocks.push('師傅目前未開啟接案');
      if (!includesValue(technician.service_areas, order.area)) hardBlocks.push('服務區域不符合');
      if (!includesValue(technician.service_types, order.service_type)) hardBlocks.push('服務類型不符合');
      if (activeCount >= limits.active_job_limit) hardBlocks.push(`進行中案件已達上限 ${limits.active_job_limit}`);
      if (todayCount >= limits.daily_job_limit) hardBlocks.push(`今日接單已達上限 ${limits.daily_job_limit}`);

      const scored = scoreCandidate({
        order,
        technician,
        activeCount,
        todayCount,
        recentRejectCount,
      });

      return {
        technician_id: technician.id,
        line_user_id: technician.line_user_id,
        name: technician.name || technician.line_display_name || technician.line_user_id,
        phone: technician.phone,
        available_time_text: technician.available_time_text,
        service_areas: technician.service_areas || [],
        service_types: technician.service_types || [],
        score: hardBlocks.length ? 0 : scored.score,
        eligible: hardBlocks.length === 0,
        reasons: scored.reasons,
        warnings: scored.warnings,
        hard_blocks: hardBlocks,
        stats: {
          active_job_count: activeCount,
          today_assigned_count: todayCount,
          recent_reject_count: recentRejectCount,
          daily_job_limit: limits.daily_job_limit,
          active_job_limit: limits.active_job_limit,
        },
      };
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.score - a.score;
    });
}

module.exports = {
  listDispatchCandidates,
};
