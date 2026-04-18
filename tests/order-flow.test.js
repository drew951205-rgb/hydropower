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

test('customer webhook creates an order through repair flow', async () => {
  const server = app.listen(0);
  try {
    const userId = `U-test-customer-${Date.now()}`;
    const events = [
      { type: 'message', replyToken: 'r1', source: { userId }, message: { type: 'text', text: '\u5831\u4fee' } },
      { type: 'message', replyToken: 'r2', source: { userId }, message: { type: 'text', text: '\u6f0f\u6c34' } },
      { type: 'message', replyToken: 'r3', source: { userId }, message: { type: 'text', text: '\u897f\u5340' } },
      { type: 'message', replyToken: 'r4', source: { userId }, message: { type: 'text', text: '\u5609\u7fa9\u5e02\u897f\u5340\u4e2d\u5c71\u8def100\u865f' } },
      { type: 'message', replyToken: 'r5', source: { userId }, message: { type: 'text', text: '\u5eda\u623f\u6c34\u69fd\u4e0b\u65b9\u6301\u7e8c\u6f0f\u6c34' } },
      { type: 'message', replyToken: 'r6', source: { userId }, message: { type: 'text', text: '\u8d8a\u5feb\u8d8a\u597d' } },
      { type: 'message', replyToken: 'r7', source: { userId }, message: { type: 'text', text: '0912345678' } }
    ];

    for (const event of events) {
      const response = await request(server, 'POST', '/webhook', { events: [event] });
      assert.equal(response.status, 200);
    }

    const orders = await request(server, 'GET', '/api/orders');
    assert.equal(orders.status, 200);
    assert.equal(orders.body.data.length, 1);
    assert.equal(orders.body.data[0].status, 'pending_review');
    assert.equal(orders.body.data[0].service_mode, 'urgent');
    assert.equal(orders.body.data[0].preferred_time_text, '\u8d8a\u5feb\u8d8a\u597d');
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

test('technician acceptance notifies the customer and moves order to assigned', async () => {
  const server = app.listen(0);
  try {
    const customerId = `U-customer-assign-${Date.now()}`;
    const technicianId = `U-technician-assign-${Date.now()}`;

    const intakeEvents = [
      { type: 'message', replyToken: 'ca1', source: { userId: customerId }, message: { type: 'text', text: '\u5831\u4fee' } },
      { type: 'message', replyToken: 'ca2', source: { userId: customerId }, message: { type: 'text', text: '\u6f0f\u6c34' } },
      { type: 'message', replyToken: 'ca3', source: { userId: customerId }, message: { type: 'text', text: '\u897f\u5340' } },
      { type: 'message', replyToken: 'ca4', source: { userId: customerId }, message: { type: 'text', text: '\u5609\u7fa9\u5e02\u897f\u5340\u4e2d\u5c71\u8def200\u865f' } },
      { type: 'message', replyToken: 'ca5', source: { userId: customerId }, message: { type: 'text', text: '\u6c34\u7ba1\u6ef2\u6c34' } },
      { type: 'message', replyToken: 'ca6', source: { userId: customerId }, message: { type: 'text', text: '\u4eca\u5929\u4e0b\u5348' } },
      { type: 'message', replyToken: 'ca7', source: { userId: customerId }, message: { type: 'text', text: '0912000000' } }
    ];

    for (const event of intakeEvents) {
      const response = await request(server, 'POST', '/webhook', { events: [event] });
      assert.equal(response.status, 200);
    }

    const orders = await request(server, 'GET', '/api/orders');
    const order = orders.body.data.find((item) => item.customer_id);
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

    const intakeEvents = [
      { type: 'message', replyToken: 'to1', source: { userId: customerId }, message: { type: 'text', text: '\u5831\u4fee' } },
      { type: 'message', replyToken: 'to2', source: { userId: customerId }, message: { type: 'text', text: '\u6f0f\u6c34' } },
      { type: 'message', replyToken: 'to3', source: { userId: customerId }, message: { type: 'text', text: '\u897f\u5340' } },
      { type: 'message', replyToken: 'to4', source: { userId: customerId }, message: { type: 'text', text: '\u5609\u7fa9\u5e02\u897f\u5340\u4e2d\u5c71\u8def500\u865f' } },
      { type: 'message', replyToken: 'to5', source: { userId: customerId }, message: { type: 'text', text: '\u967d\u53f0\u6c34\u9f8d\u982d\u6ef4\u6c34' } },
      { type: 'message', replyToken: 'to6', source: { userId: customerId }, message: { type: 'text', text: '\u660e\u5929\u4e0b\u5348 2-5 \u9ede' } },
      { type: 'message', replyToken: 'to7', source: { userId: customerId }, message: { type: 'text', text: '0912666888' } }
    ];

    for (const event of intakeEvents) {
      const response = await request(server, 'POST', '/webhook', { events: [event] });
      assert.equal(response.status, 200);
    }

    const orders = await request(server, 'GET', '/api/orders');
    const order = orders.body.data.find((item) => item.contact_phone === '0912666888');

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

test('technician can quote, arrive, and complete after customer accepts', async () => {
  const server = app.listen(0);
  try {
    const stamp = Date.now();
    const customerId = `U-customer-tech-flow-${stamp}`;
    const technicianId = `U-technician-tech-flow-${stamp}`;
    const phone = `09${String(stamp).slice(-8)}`;

    const intakeEvents = [
      { type: 'message', replyToken: 'tf1', source: { userId: customerId }, message: { type: 'text', text: '\u5831\u4fee' } },
      { type: 'message', replyToken: 'tf2', source: { userId: customerId }, message: { type: 'text', text: '\u6f0f\u6c34' } },
      { type: 'message', replyToken: 'tf3', source: { userId: customerId }, message: { type: 'text', text: '\u897f\u5340' } },
      { type: 'message', replyToken: 'tf4', source: { userId: customerId }, message: { type: 'text', text: '\u5609\u7fa9\u5e02\u897f\u5340\u5fe0\u7fa9\u8857123\u865f' } },
      { type: 'message', replyToken: 'tf5', source: { userId: customerId }, message: { type: 'text', text: '\u6d17\u624b\u53f0\u4e0b\u65b9\u6f0f\u6c34' } },
      { type: 'message', replyToken: 'tf-img1', source: { userId: customerId }, message: { type: 'image', id: 'line-image-tech-flow-1' } },
      { type: 'message', replyToken: 'tf6', source: { userId: customerId }, message: { type: 'text', text: '\u9031\u516d\u4e0a\u5348' } },
      { type: 'message', replyToken: 'tf7', source: { userId: customerId }, message: { type: 'text', text: phone } }
    ];

    for (const event of intakeEvents) {
      const response = await request(server, 'POST', '/webhook', { events: [event] });
      assert.equal(response.status, 200);
    }

    const orders = await request(server, 'GET', '/api/orders');
    const order = orders.body.data.find((item) => item.contact_phone === phone);
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

    const quoted = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'tf-quote',
          source: { userId: technicianId },
          message: { type: 'text', text: '\u5831\u50f9 1500' }
        }
      ]
    });
    assert.equal(quoted.status, 200);
    assert.equal(quoted.body.results[0].quoteSubmitted, true);
    assert.equal(quoted.body.results[0].order.status, 'quoted');
    assert.equal(quoted.body.results[0].order.quote_amount, 1500);

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
    assert.equal(customerAcceptedChange.body.results[0].order.status, 'in_progress');
    assert.equal(customerAcceptedChange.body.results[0].order.change_request_status, 'approved');

    const arrived = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'postback',
          replyToken: 'tf-arrived',
          source: { userId: technicianId },
          postback: { data: `technician:arrived:${order.id}` }
        }
      ]
    });
    assert.equal(arrived.status, 200);
    assert.equal(arrived.body.results[0].status, 'arrived');

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

    const customerConfirmed = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'postback',
          replyToken: 'tf-customer-complete',
          source: { userId: customerId },
          postback: { data: `customer:confirm_completion:${order.id}` }
        }
      ]
    });
    assert.equal(customerConfirmed.status, 200);
    assert.equal(customerConfirmed.body.results[0].order.status, 'closed');
    assert.equal(customerConfirmed.body.results[0].reviewStarted, true);

    const customerRating = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'tf-customer-rating',
          source: { userId: customerId },
          message: { type: 'text', text: '5' }
        }
      ]
    });
    assert.equal(customerRating.status, 200);
    assert.equal(customerRating.body.results[0].nextStep, 'customer_review_comment');

    const customerReview = await request(server, 'POST', '/webhook', {
      events: [
        {
          type: 'message',
          replyToken: 'tf-customer-review',
          source: { userId: customerId },
          message: { type: 'text', text: '\u8655\u7406\u5f88\u5feb\uff0c\u554f\u984c\u5df2\u89e3\u6c7a' }
        }
      ]
    });
    assert.equal(customerReview.status, 200);
    assert.equal(customerReview.body.results[0].customerReviewSubmitted, true);

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
    const events = [
      { type: 'message', replyToken: 'crm1', source: { userId }, message: { type: 'text', text: '\u5831\u4fee' } },
      { type: 'message', replyToken: 'crm2', source: { userId }, message: { type: 'text', text: '\u71b1\u6c34\u5668' } },
      { type: 'message', replyToken: 'crm3', source: { userId }, message: { type: 'text', text: '\u6771\u5340' } },
      { type: 'message', replyToken: 'crm4', source: { userId }, message: { type: 'text', text: '\u5609\u7fa9\u5e02\u6771\u5340\u5f4c\u9640\u8def66\u865f' } },
      { type: 'message', replyToken: 'crm5', source: { userId }, message: { type: 'text', text: '\u71b1\u6c34\u5668\u5ffd\u51b7\u5ffd\u71b1' } },
      { type: 'message', replyToken: 'crm6', source: { userId }, message: { type: 'text', text: '\u660e\u5929\u665a\u4e0a' } },
      { type: 'message', replyToken: 'crm7', source: { userId }, message: { type: 'text', text: '0922333444' } }
    ];

    for (const event of events) {
      const response = await request(server, 'POST', '/webhook', { events: [event] });
      assert.equal(response.status, 200);
    }

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
