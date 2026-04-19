const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.LINE_CHANNEL_ACCESS_TOKEN = '';
process.env.LINE_CHANNEL_SECRET = '';
process.env.ADMIN_API_KEY = 'change-me';
process.env.DISPATCH_TIMEOUT_MINUTES = '1';

const { app } = require('../src/app');
const assignmentRepository = require('../src/repositories/assignment.repository');
const { runDispatchTimeoutJob } = require('../src/jobs/dispatch-timeout.job');

function request(server, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request({
      method,
      path,
      port: server.address().port,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        'x-admin-api-key': 'change-me',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

async function createRepairOrder(server, overrides = {}) {
  const stamp = Date.now();
  const lineUserId = overrides.line_user_id || `U-liff-order-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
  const payload = {
    line_user_id: lineUserId,
    line_display_name: overrides.line_display_name || 'LIFF Customer',
    service_type: overrides.service_type || '漏水',
    area: overrides.area || '西區',
    address: overrides.address || '嘉義市西區中山路100號',
    preferred_time_text: overrides.preferred_time_text || '今天下午',
    issue_description: overrides.issue_description || '水管漏水',
    contact_phone: overrides.contact_phone || `09${String(stamp).slice(-8)}`,
    terms_accepted: true,
  };
  const response = await request(server, 'POST', '/api/liff/repair', payload);
  assert.equal(response.status, 201);
  return { lineUserId, order: response.body.data, response };
}

test('customer webhook sends repair form button instead of chat intake', async () => {
  const server = app.listen(0);
  try {
    const userId = `U-test-customer-${Date.now()}`;
    const response = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'r1',
          source: { userId },
          message: { type: 'text', text: '報修' },
        },
      ],
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.results[0].repairFormPrompted, true);

    const orders = await request(server, 'GET', '/api/orders');
    assert.equal(orders.status, 200);
    assert.equal(orders.body.data.length, 0);
  } finally {
    server.close();
  }
});

test('customer can create an order from LIFF repair form API', async () => {
  const server = app.listen(0);
  try {
    const lineUserId = `U-liff-customer-${Date.now()}`;
    const response = await request(server, 'POST', '/api/liff/repair', {
      line_user_id: lineUserId,
      line_display_name: 'LIFF Customer',
      service_type: '漏水',
      area: '西區',
      address: '嘉義市西區民族路100號',
      preferred_time_text: '明天下午 2-5 點',
      issue_description: '浴室洗手台下方會滴水',
      contact_phone: '0912345678',
      terms_accepted: true,
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.status, 'pending_review');
    assert.equal(response.body.data.service_mode, 'scheduled');
    assert.equal(response.body.data.preferred_time_text, '明天下午 2-5 點');
  } finally {
    server.close();
  }
});

test('customer rich menu texts list orders and support info', async () => {
  const server = app.listen(0);
  try {
    const { lineUserId } = await createRepairOrder(server, {
      service_type: '\u6f0f\u6c34',
      preferred_time_text: '\u4eca\u5929\u4e0b\u5348',
    });

    const ordersResponse = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'customer-my-orders',
          source: { userId: lineUserId },
          message: { type: 'text', text: '\u6211\u7684\u6848\u4ef6' },
        },
      ],
    });
    assert.equal(ordersResponse.status, 200);
    assert.equal(ordersResponse.body.results[0].customerOrdersListed, true);
    assert.equal(ordersResponse.body.results[0].count, 1);

    const supportResponse = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'customer-support',
          source: { userId: lineUserId },
          message: { type: 'text', text: '\u806f\u7d61\u5ba2\u670d' },
        },
      ],
    });
    assert.equal(supportResponse.status, 200);
    assert.equal(supportResponse.body.results[0].customerSupportPrompted, true);
  } finally {
    server.close();
  }
});

test('LIFF repair form requires platform terms acceptance', async () => {
  const server = app.listen(0);
  try {
    const lineUserId = `U-liff-terms-${Date.now()}`;
    const response = await request(server, 'POST', '/api/liff/repair', {
      line_user_id: lineUserId,
      service_type: '漏水',
      area: '西區',
      address: '嘉義市西區民族路100號',
      preferred_time_text: '明天下午 2-5 點',
      issue_description: '浴室洗手台下方會滴水',
      contact_phone: '0912345678',
    });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /平台條款/);
  } finally {
    server.close();
  }
});

test('customer can update profile from LIFF profile API', async () => {
  const server = app.listen(0);
  try {
    const lineUserId = `U-liff-profile-${Date.now()}`;
    const saved = await request(server, 'POST', '/api/liff/customer-profile', {
      line_user_id: lineUserId,
      name: 'Profile Customer',
      phone: '0912555666',
      default_address: '嘉義市西區文化路88號',
      line_display_name: 'LINE Profile Customer',
      line_picture_url: 'https://example.com/profile.png',
      line_language: 'zh-TW',
      member_terms_accepted: true,
    });

    assert.equal(saved.status, 200);
    assert.equal(saved.body.data.name, 'Profile Customer');
    assert.equal(saved.body.data.phone, '0912555666');
    assert.equal(saved.body.data.default_address, '嘉義市西區文化路88號');
    assert.equal(saved.body.data.line_display_name, 'LINE Profile Customer');
    assert.equal(saved.body.data.line_picture_url, 'https://example.com/profile.png');
    assert.equal(saved.body.data.is_member, true);

    const loaded = await request(
      server,
      'GET',
      `/api/liff/customer-profile?line_user_id=${encodeURIComponent(lineUserId)}`
    );
    assert.equal(loaded.status, 200);
    assert.equal(loaded.body.data.name, 'Profile Customer');

    const customers = await request(server, 'GET', '/api/admin/customers');
    assert.equal(customers.status, 200);
    const customer = customers.body.data.find((item) => item.line_user_id === lineUserId);
    assert.equal(customer.name, 'Profile Customer');
    assert.equal(customer.order_count, 0);

    const broadcast = await request(server, 'POST', '/api/admin/broadcasts/members', {
      title: '雨季提醒',
      message: '最近午後雷雨較多，若有漏水可以直接使用報修表單。'
    });
    assert.equal(broadcast.status, 200);
    assert.ok(broadcast.body.data.target_count >= 1);
    assert.ok(broadcast.body.data.sent_count >= 1);
    assert.ok(
      broadcast.body.data.results.some((item) => item.line_user_id === lineUserId)
    );
  } finally {
    server.close();
  }
});

test('customer profile membership requires terms acceptance', async () => {
  const server = app.listen(0);
  try {
    const lineUserId = `U-liff-profile-terms-${Date.now()}`;
    const response = await request(server, 'POST', '/api/liff/customer-profile', {
      line_user_id: lineUserId,
      name: 'Profile Customer',
      phone: '0912555666',
      default_address: '嘉義市西區文化路88號',
    });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /會員條款/);
  } finally {
    server.close();
  }
});

test('admin can create a technician', async () => {
  const server = app.listen(0);
  try {
    const response = await request(server, 'POST', '/api/technicians', {
      line_user_id: `U-test-technician-${Date.now()}`,
      name: 'Test Technician',
      phone: '0911222333',
      available: true,
      service_areas: ['west'],
      service_types: ['leak'],
      available_time_text: '平日 18:00 後'
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.role, 'technician');
    assert.equal(response.body.data.available, true);
    assert.equal(response.body.data.available_time_text, '平日 18:00 後');
  } finally {
    server.close();
  }
});

test('LINE user can join as a technician', async () => {
  const server = app.listen(0);
  try {
    const lineUserId = `U-line-technician-${Date.now()}`;
    const response = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'join-tech-1',
          source: { userId: lineUserId },
          message: { type: 'text', text: '\u52a0\u5165\u5e2b\u5085 \u738b\u5e2b\u5085 0911222333' }
        }
      ]
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.results[0].technicianJoined, true);
    assert.equal(response.body.results[0].user.role, 'technician');
    assert.equal(response.body.results[0].user.available, true);

    const technicians = await request(server, 'GET', '/api/technicians');
    assert.equal(technicians.status, 200);
    const technician = technicians.body.data.find((item) => item.line_user_id === lineUserId);
    assert.equal(technician.name, '\u738b\u5e2b\u5085');
    assert.equal(technician.phone, '0911222333');
  } finally {
    server.close();
  }
});

test('LINE technician can leave technician role when no active orders exist', async () => {
  const server = app.listen(0);
  try {
    const lineUserId = `U-line-tech-leave-${Date.now()}`;
    const joined = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'leave-join-1',
          source: { userId: lineUserId },
          message: { type: 'text', text: '\u52a0\u5165\u5e2b\u5085 \u9673\u5e2b\u5085 0911999888' }
        }
      ]
    });
    assert.equal(joined.status, 200);
    assert.equal(joined.body.results[0].technicianJoined, true);

    const left = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'leave-tech-1',
          source: { userId: lineUserId },
          message: { type: 'text', text: '\u9000\u51fa\u5e2b\u5085' }
        }
      ]
    });
    assert.equal(left.status, 200);
    assert.equal(left.body.results[0].technicianLeft, true);
    assert.equal(left.body.results[0].user.role, 'customer');
    assert.equal(left.body.results[0].user.available, false);
  } finally {
    server.close();
  }
});

test('technician with active orders is paused but cannot leave role', async () => {
  const server = app.listen(0);
  try {
    const customerId = `U-customer-active-leave-${Date.now()}`;
    const technicianId = `U-technician-active-leave-${Date.now()}`;
    const { order } = await createRepairOrder(server, {
      line_user_id: customerId,
      service_type: '漏水',
      area: '西區',
      address: '嘉義市西區中山路600號',
      preferred_time_text: '今天下午',
      issue_description: '浴室水龍頭漏水',
      contact_phone: '0912888999',
    });

    const technician = await request(server, 'POST', '/api/technicians', {
      line_user_id: technicianId,
      name: 'Active Leave Technician',
      phone: '0911888777',
      available: true,
      service_areas: [],
      service_types: []
    });
    assert.equal(technician.status, 201);

    await request(server, 'POST', `/api/orders/${order.id}/review`, {
      action: 'approve',
      note: 'ok'
    });
    const dispatched = await request(server, 'POST', `/api/orders/${order.id}/dispatch`, {
      technician_ids: [technician.body.data.id]
    });
    const assignment = dispatched.body.data[0];

    const accepted = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'postback',
          replyToken: 'al-accept',
          source: { userId: technicianId },
          postback: { data: `technician:accept_assignment:${assignment.id}` }
        }
      ]
    });
    assert.equal(accepted.body.results[0].status, 'assigned');

    const left = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'al-leave',
          source: { userId: technicianId },
          message: { type: 'text', text: '\u9000\u51fa\u5e2b\u5085' }
        }
      ]
    });
    assert.equal(left.status, 200);
    assert.equal(left.body.results[0].technicianLeft, false);
    assert.equal(left.body.results[0].reason, 'active_orders');
    assert.equal(left.body.results[0].user.role, 'technician');
    assert.equal(left.body.results[0].user.available, false);
  } finally {
    server.close();
  }
});

test('technician acceptance notifies the customer and moves order to assigned', async () => {
  const server = app.listen(0);
  try {
    const customerId = `U-customer-assign-${Date.now()}`;
    const technicianId = `U-technician-assign-${Date.now()}`;
    const { order } = await createRepairOrder(server, {
      line_user_id: customerId,
      service_type: '漏水',
      area: '西區',
      address: '嘉義市西區中山路200號',
      preferred_time_text: '今天下午',
      issue_description: '水管滲水',
      contact_phone: '0912000000',
    });
    assert.equal(order.status, 'pending_review');

    const technician = await request(server, 'POST', '/api/technicians', {
      line_user_id: technicianId,
      name: 'Notify Technician',
      phone: '0911222444',
      available: true,
      service_areas: [],
      service_types: []
    });
    assert.equal(technician.status, 201);

    const reviewed = await request(server, 'POST', `/api/orders/${order.id}/review`, { action: 'approve', note: 'ok' });
    assert.equal(reviewed.status, 200);

    const dispatched = await request(server, 'POST', `/api/orders/${order.id}/dispatch`, {
      technician_ids: [technician.body.data.id]
    });
    assert.equal(dispatched.status, 201);
    const assignment = dispatched.body.data[0];

    const accepted = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'postback',
          replyToken: 'accept-notify-1',
          source: { userId: technicianId },
          postback: { data: `technician:accept_assignment:${assignment.id}` }
        }
      ]
    });

    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.results[0].status, 'assigned');

    const detail = await request(server, 'GET', `/api/orders/${order.id}`);
    assert.equal(detail.body.data.status, 'assigned');
    assert.equal(detail.body.data.technician_id, technician.body.data.id);
  } finally {
    server.close();
  }
});

test('dispatch timeout expires pending assignments and returns order to dispatch queue', async () => {
  const server = app.listen(0);
  try {
    const customerId = `U-customer-timeout-${Date.now()}`;
    const technicianId = `U-technician-timeout-${Date.now()}`;
    const { order } = await createRepairOrder(server, {
      line_user_id: customerId,
      service_type: '漏水',
      area: '西區',
      address: '嘉義市西區中山路500號',
      preferred_time_text: '明天下午 2-5 點',
      issue_description: '陽台水龍頭滴水',
      contact_phone: '0912666888',
    });

    const technician = await request(server, 'POST', '/api/technicians', {
      line_user_id: technicianId,
      name: 'Timeout Technician',
      phone: '0911777888',
      available: true,
      service_areas: [],
      service_types: []
    });
    assert.equal(technician.status, 201);

    const reviewed = await request(server, 'POST', `/api/orders/${order.id}/review`, {
      action: 'approve',
      note: 'ok'
    });
    assert.equal(reviewed.status, 200);

    const dispatched = await request(server, 'POST', `/api/orders/${order.id}/dispatch`, {
      technician_ids: [technician.body.data.id]
    });
    assert.equal(dispatched.status, 201);
    assert.equal(dispatched.body.data[0].status, 'pending');

    const staleTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    await assignmentRepository.updateAssignment(dispatched.body.data[0].id, {
      created_at: staleTime
    });

    await runDispatchTimeoutJob();

    const detail = await request(server, 'GET', `/api/orders/${order.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.status, 'pending_dispatch');
    assert.equal(detail.body.data.assignments[0].status, 'expired');
    assert.ok(detail.body.data.logs.some((log) => log.action === 'dispatch_timeout'));
  } finally {
    server.close();
  }
});

test('platform cancellation stores reason for customer notification', async () => {
  const server = app.listen(0);
  try {
    const customerId = `U-customer-platform-cancel-${Date.now()}`;
    const { order } = await createRepairOrder(server, {
      line_user_id: customerId,
      service_type: '漏水',
      area: '西區',
      address: '嘉義市西區中山路700號',
      preferred_time_text: '今天下午',
      issue_description: '水管滲水',
      contact_phone: '0912777000',
    });
    const cancelled = await request(server, 'POST', `/api/orders/${order.id}/cancel`, {
      cancelled_by: 'platform',
      reason_code: 'admin_cancel',
      reason_text: '資料不完整，請重新送出報修',
    });

    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.data.status, 'platform_cancelled');
    assert.equal(cancelled.body.data.cancelled_by, 'platform');
    assert.equal(cancelled.body.data.cancel_reason_text, '資料不完整，請重新送出報修');
  } finally {
    server.close();
  }
});

test('technician can quote, arrive, and complete after customer accepts', async () => {
  const server = app.listen(0);
  try {
    const stamp = Date.now();
    const customerId = `U-customer-tech-flow-${stamp}`;
    const technicianId = `U-technician-tech-flow-${stamp}`;
    const phone = `09${String(stamp).slice(-8)}`;

    const { order } = await createRepairOrder(server, {
      line_user_id: customerId,
      service_type: '漏水',
      area: '西區',
      address: '嘉義市西區忠義街123號',
      preferred_time_text: '週六上午',
      issue_description: '洗手台下方漏水',
      contact_phone: phone,
    });
    const imageAdded = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'tf-img1',
          source: { userId: customerId },
          message: { type: 'image', id: 'line-image-tech-flow-1' },
        },
      ],
    });
    assert.equal(imageAdded.status, 200);

    assert.equal(order.status, 'pending_review');
    assert.equal(order.service_mode, 'scheduled');
    assert.equal(order.preferred_time_text, '\u9031\u516d\u4e0a\u5348');

    const technician = await request(server, 'POST', '/api/technicians', {
      line_user_id: technicianId,
      name: 'Flow Technician',
      phone: '0911555666',
      available: true,
      service_areas: [],
      service_types: []
    });
    assert.equal(technician.status, 201);

    const reviewed = await request(server, 'POST', `/api/orders/${order.id}/review`, {
      action: 'approve',
      note: 'ok'
    });
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.data.status, 'pending_dispatch');

    const dispatched = await request(server, 'POST', `/api/orders/${order.id}/dispatch`, {
      technician_ids: [technician.body.data.id]
    });
    assert.equal(dispatched.status, 201);
    const assignment = dispatched.body.data[0];

    const accepted = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'postback',
          replyToken: 'tf-accept',
          source: { userId: technicianId },
          postback: { data: `technician:accept_assignment:${assignment.id}` }
        }
      ]
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.results[0].status, 'assigned');

    const myOrders = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'tf-my-orders',
          source: { userId: technicianId },
          message: { type: 'text', text: '\u6211\u7684\u6848\u4ef6' }
        }
      ]
    });
    assert.equal(myOrders.status, 200);
    assert.equal(myOrders.body.results[0].myOrders, true);
    assert.equal(myOrders.body.results[0].count, 1);

    const quoted = await request(server, 'POST', `/api/liff/orders/${order.id}/quote`, {
      line_user_id: technicianId,
      basic_fee: 1000,
      material_fee: 300,
      labor_fee: 200,
      estimated_arrival_time: '\u4eca\u5929 16:00 \u524d',
      note: '\u66f4\u63db\u6b62\u6c34\u95a5'
    });
    assert.equal(quoted.status, 200);
    assert.equal(quoted.body.data.status, 'quoted');
    assert.equal(quoted.body.data.quote_amount, 1500);
    assert.equal(quoted.body.data.estimated_arrival_time, '\u4eca\u5929 16:00 \u524d');

    const customerAccepted = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'postback',
          replyToken: 'tf-customer-accept',
          source: { userId: customerId },
          postback: { data: `customer:accept_quote:${order.id}` }
        }
      ]
    });
    assert.equal(customerAccepted.status, 200);
    assert.equal(customerAccepted.body.results[0].order.status, 'in_progress');

    const staleAccept = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'postback',
          replyToken: 'tf-customer-accept-stale',
          source: { userId: customerId },
          postback: { data: `customer:accept_quote:${order.id}` }
        }
      ]
    });
    assert.equal(staleAccept.status, 200);
    assert.equal(staleAccept.body.results[0].reason, 'stale_action');
    assert.equal(staleAccept.body.results[0].order.status, 'in_progress');

    const staleCancel = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'postback',
          replyToken: 'tf-customer-cancel-stale',
          source: { userId: customerId },
          postback: { data: `customer:cancel_order:${order.id}` }
        }
      ]
    });
    assert.equal(staleCancel.status, 200);
    assert.equal(staleCancel.body.results[0].reason, 'stale_action');
    assert.equal(staleCancel.body.results[0].order.status, 'in_progress');

    const changePrompt = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'postback',
          replyToken: 'tf-change-prompt',
          source: { userId: technicianId },
          postback: { data: `technician:change_request:${order.id}` }
        }
      ]
    });
    assert.equal(changePrompt.status, 200);
    assert.equal(changePrompt.body.results[0].status, 'in_progress');

    const changeRequest = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'tf-change-request',
          source: { userId: technicianId },
          message: { type: 'text', text: '\u8ffd\u52a0 500 \u66f4\u63db\u96f6\u4ef6' }
        }
      ]
    });
    assert.equal(changeRequest.status, 200);
    assert.equal(changeRequest.body.results[0].changeRequestSubmitted, true);
    assert.equal(changeRequest.body.results[0].order.status, 'platform_review');
    assert.equal(changeRequest.body.results[0].order.change_request_amount, 500);

    const customerAcceptedChange = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'postback',
          replyToken: 'tf-customer-accept-change',
          source: { userId: customerId },
          postback: { data: `customer:accept_quote:${order.id}` }
        }
      ]
    });
    assert.equal(customerAcceptedChange.status, 200);
    assert.equal(customerAcceptedChange.body.results[0].order.status, 'arrived');
    assert.equal(customerAcceptedChange.body.results[0].order.change_request_status, 'approved');

    const completed = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'postback',
          replyToken: 'tf-complete',
          source: { userId: technicianId },
          postback: { data: `technician:complete:${order.id}` }
        }
      ]
    });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.results[0].status, 'completed_pending_customer');
    assert.equal(completed.body.results[0].final_amount, 2000);

    const technicianReview = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'tf-tech-review',
          source: { userId: technicianId },
          message: { type: 'text', text: '\u73fe\u5834\u8655\u7406\u9806\u5229\uff0c\u5ba2\u6236\u597d\u6e9d\u901a' }
        }
      ]
    });
    assert.equal(technicianReview.status, 200);
    assert.equal(technicianReview.body.results[0].technicianReviewSubmitted, true);

    const customerConfirmed = await request(server, 'POST', `/api/liff/orders/${order.id}/confirm-completion`, {
      line_user_id: customerId,
      confirmed: true,
      paid_amount: 2000,
      rating: 5,
      comment: '\u8655\u7406\u5f88\u5feb\uff0c\u554f\u984c\u5df2\u89e3\u6c7a'
    });
    assert.equal(customerConfirmed.status, 200);
    assert.equal(customerConfirmed.body.data.status, 'closed');

    const staleCompletion = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'postback',
          replyToken: 'tf-customer-complete-stale',
          source: { userId: customerId },
          postback: { data: `customer:confirm_completion:${order.id}` }
        }
      ]
    });
    assert.equal(staleCompletion.status, 200);
    assert.equal(staleCompletion.body.results[0].reason, 'stale_action');
    assert.equal(staleCompletion.body.results[0].order.status, 'closed');

    const finalDetail = await request(server, 'GET', `/api/orders/${order.id}`);
    assert.equal(finalDetail.body.data.status, 'closed');
    assert.equal(finalDetail.body.data.images.length, 1);
    assert.equal(finalDetail.body.data.images[0].image_url, 'line-image:line-image-tech-flow-1');
    assert.equal(finalDetail.body.data.rating, 5);
    assert.equal(finalDetail.body.data.customer_comment, '\u8655\u7406\u5f88\u5feb\uff0c\u554f\u984c\u5df2\u89e3\u6c7a');
    assert.ok(finalDetail.body.data.messages.some((message) =>
      message.message_type === 'technician_review' &&
      message.content === '\u73fe\u5834\u8655\u7406\u9806\u5229\uff0c\u5ba2\u6236\u597d\u6e9d\u901a'
    ));
  } finally {
    server.close();
  }
});

test('admin CRM lists customers with profile and order summary', async () => {
  const server = app.listen(0);
  try {
    const userId = `U-crm-customer-${Date.now()}`;
    await createRepairOrder(server, {
      line_user_id: userId,
      service_type: '熱水器',
      area: '東區',
      address: '嘉義市東區彌陀路66號',
      preferred_time_text: '明天晚上',
      issue_description: '熱水器忽冷忽熱',
      contact_phone: '0922333444',
    });

    const customers = await request(server, 'GET', '/api/admin/customers');
    assert.equal(customers.status, 200);
    const customer = customers.body.data.find((item) => item.line_user_id === userId);

    assert.equal(customer.phone, '0922333444');
    assert.equal(customer.default_address, '\u5609\u7fa9\u5e02\u6771\u5340\u5f4c\u9640\u8def66\u865f');
    assert.equal(customer.order_count, 1);

    const detail = await request(server, 'GET', `/api/admin/customers/${customer.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.orders.length, 1);
  } finally {
    server.close();
  }
});
