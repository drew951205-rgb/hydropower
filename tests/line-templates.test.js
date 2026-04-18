const test = require('node:test');
const assert = require('node:assert/strict');

const {
  welcomeMessage,
  reviewApprovedMessage,
  quoteMessage,
  changeRequestMessage,
  assignedCustomerMessage,
  completionMessage,
} = require('../src/templates/customer-messages');
const {
  assignmentMessage,
  assignedMessage,
  quotePromptMessage,
  acceptedQuoteTechnicianMessage,
} = require('../src/templates/technician-messages');
const { parseQuoteText } = require('../src/services/technician-flow.service');

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
  final_amount: 2400,
};

function footerActions(message) {
  return message.contents.footer.contents.map((item) => item.action);
}

test('customer LINE messages use clearer cards and postback actions', () => {
  const welcome = welcomeMessage();
  assert.equal(welcome.type, 'text');
  assert.equal(welcome.quickReply.items[0].action.data, 'customer:start_repair');

  const reviewApproved = reviewApprovedMessage(order);
  assert.equal(reviewApproved.type, 'flex');
  assert.match(reviewApproved.altText, /審核通過/);
  assert.match(JSON.stringify(reviewApproved.contents), /馬上幫你找附近的師傅/);
  assert.match(JSON.stringify(reviewApproved.contents), /CJ-TEST/);

  const quote = quoteMessage(order);
  assert.equal(quote.type, 'flex');
  assert.match(quote.altText, /報價確認/);
  assert.equal(footerActions(quote)[0].data, 'customer:accept_quote:12');
  assert.equal(footerActions(quote)[1].data, 'customer:reject_quote:12');
  assert.equal(footerActions(quote)[2].data, 'customer:cancel_order:12');

  const change = changeRequestMessage(order);
  assert.equal(change.type, 'flex');
  assert.equal(footerActions(change)[0].data, 'customer:accept_quote:12');
  assert.equal(footerActions(change)[2].data, 'customer:cancel_order:12');

  const assigned = assignedCustomerMessage(order, {
    name: 'Test Technician',
    phone: '0911222333',
  });
  assert.equal(assigned.type, 'flex');
  assert.match(JSON.stringify(assigned.contents), /師傅已接單/);
  assert.match(JSON.stringify(assigned.contents), /Test Technician/);

  const completion = completionMessage(order);
  assert.equal(completion.type, 'flex');
  assert.equal(footerActions(completion)[0].data, 'customer:confirm_completion:12');
  assert.equal(footerActions(completion)[1].data, 'customer:dispute_completion:12');
});

test('technician LINE messages use clearer cards and actions', () => {
  const assignment = assignmentMessage(order, { id: 34 });
  assert.equal(assignment.type, 'flex');
  assert.equal(footerActions(assignment)[0].data, 'technician:accept_assignment:34');

  const assigned = assignedMessage(order);
  assert.equal(assigned.type, 'flex');
  assert.equal(footerActions(assigned)[0].data, 'technician:quote:12');
  assert.equal(footerActions(assigned)[1].data, 'technician:cancel:12');

  const quotePrompt = quotePromptMessage(order);
  assert.equal(quotePrompt.type, 'flex');
  assert.equal(footerActions(quotePrompt)[0].type, 'message');
  assert.equal(footerActions(quotePrompt)[0].text, '報價 1500');
  assert.equal(footerActions(quotePrompt)[1].data, 'technician:cancel:12');

  const acceptedQuote = acceptedQuoteTechnicianMessage(order);
  assert.equal(acceptedQuote.type, 'flex');
  assert.equal(footerActions(acceptedQuote)[0].data, 'technician:arrived:12');
  assert.equal(footerActions(acceptedQuote)[1].data, 'technician:complete:12');
  assert.equal(footerActions(acceptedQuote)[2].data, 'technician:cancel:12');
});

test('technician quote text can omit order id', () => {
  assert.deepEqual(parseQuoteText('報價 1500'), {
    orderId: null,
    amount: 1500,
    note: 'Technician submitted quote from LINE',
  });

  assert.deepEqual(parseQuoteText('報價 12 1500 更換止水閥'), {
    orderId: '12',
    amount: 1500,
    note: '更換止水閥',
  });
});
