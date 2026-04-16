const test = require('node:test');
const assert = require('node:assert/strict');

const { welcomeMessage, quoteMessage, changeRequestMessage, assignedCustomerMessage, completionMessage } = require('../src/templates/customer-messages');
const { assignmentMessage, assignedMessage } = require('../src/templates/technician-messages');

const order = {
  id: 12,
  order_no: 'CJ-TEST',
  service_type: 'leak',
  area: 'west',
  address: 'Chiayi test address',
  issue_description: 'Pipe leak under sink',
  contact_phone: '0912345678',
  quote_amount: 1800,
  change_request_amount: 600,
  change_request_reason: 'Need to replace valve',
  final_amount: 2400
};

test('customer LINE messages include postback actions', () => {
  const welcome = welcomeMessage();
  assert.equal(welcome.type, 'text');
  assert.equal(welcome.quickReply.items[0].action.data, 'customer:start_repair');

  const quote = quoteMessage(order);
  assert.equal(quote.type, 'template');
  assert.equal(quote.template.actions[0].data, 'customer:accept_quote:12');
  assert.equal(quote.template.actions[1].data, 'customer:reject_quote:12');

  const change = changeRequestMessage(order);
  assert.equal(change.template.actions[0].data, 'customer:accept_quote:12');

  const assigned = assignedCustomerMessage(order, { name: 'Test Technician', phone: '0911222333' });
  assert.equal(assigned.type, 'text');
  assert.match(assigned.text, /師傅已接單/);
  assert.match(assigned.text, /Test Technician/);

  const completion = completionMessage(order);
  assert.equal(completion.template.actions[0].data, 'customer:confirm_completion:12');
  assert.equal(completion.template.actions[1].data, 'customer:dispute_completion:12');
});

test('technician LINE messages include assignment actions', () => {
  const assignment = assignmentMessage(order, { id: 34 });
  assert.equal(assignment.type, 'template');
  assert.equal(assignment.template.actions[0].data, 'technician:accept_assignment:34');

  const assigned = assignedMessage(order);
  assert.equal(assigned.template.actions[0].data, 'technician:arrived:12');
  assert.equal(assigned.template.actions[1].data, 'technician:complete:12');
});
