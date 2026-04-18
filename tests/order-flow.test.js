const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.LINE_CHANNEL_ACCESS_TOKEN = '';
process.env.LINE_CHANNEL_SECRET = '';

const { app } = require('../src/app');

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
      { type: 'message', replyToken: 'r6', source: { userId }, message: { type: 'text', text: '0912345678' } }
    ];

    for (const event of events) {
      const response = await request(server, 'POST', '/webhook', { events: [event] });
      assert.equal(response.status, 200);
    }

    const orders = await request(server, 'GET', '/api/orders');
    assert.equal(orders.status, 200);
    assert.equal(orders.body.data.length, 1);
    assert.equal(orders.body.data[0].status, 'pending_review');
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
      service_types: ['leak']
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.role, 'technician');
    assert.equal(response.body.data.available, true);
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
      { type: 'message', replyToken: 'ca6', source: { userId: customerId }, message: { type: 'text', text: '0912000000' } }
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
