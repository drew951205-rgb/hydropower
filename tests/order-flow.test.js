const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';

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
