const test = require('node:test');
const assert = require('node:assert/strict');

const {
  welcomeMessage,
  reviewApprovedMessage,
  quoteMessage,
  changeRequestMessage,
  assignedCustomerMessage,
  platformCancelledMessage,
  completionMessage,
} = require('../src/templates/customer-messages');
const {
  assignmentMessage,
  assignedMessage,
  quotePromptMessage,
  changeRequestPromptMessage,
  acceptedQuoteTechnicianMessage,
  acceptedChangeRequestTechnicianMessage,
  arrivedTechnicianMessage,
} = require('../src/templates/technician-messages');
const {
  parseQuoteText,
  parseChangeRequestText,
  technicianIdleMessage,
  technicianActiveHelpMessage,
  myOrdersMessage,
} = require('../src/services/technician-flow.service');

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
  assert.match(welcome.text, /加入會員/);
  assert.match(welcome.text, /優惠/);
  assert.equal(welcome.quickReply.items[0].action.type, 'uri');
  assert.match(welcome.quickReply.items[0].action.uri, /\/repair$/);
  assert.equal(welcome.quickReply.items[1].action.type, 'uri');
  assert.equal(welcome.quickReply.items[1].action.label, '加入會員');
  assert.match(welcome.quickReply.items[1].action.uri, /\/profile$/);

  const reviewApproved = reviewApprovedMessage(order);
  assert.equal(reviewApproved.type, 'flex');
  assert.match(reviewApproved.altText, /審核通過/);
  assert.match(JSON.stringify(reviewApproved.contents), /馬上幫你找附近的師傅/);
  assert.match(JSON.stringify(reviewApproved.contents), /CJ-TEST/);

  const quote = quoteMessage(order);
  assert.equal(quote.type, 'flex');
  assert.match(quote.altText, /報價確認/);
  assert.equal(footerActions(quote)[0].type, 'uri');
  assert.match(footerActions(quote)[0].uri, /\/confirm\?order_id=12&mode=quote/);
  assert.equal(footerActions(quote)[1].data, 'customer:cancel_order:12');

  const change = changeRequestMessage(order);
  assert.equal(change.type, 'flex');
  assert.equal(footerActions(change)[0].type, 'uri');
  assert.match(footerActions(change)[0].uri, /\/confirm\?order_id=12&mode=change/);
  assert.equal(footerActions(change)[1].data, 'customer:cancel_order:12');

  const assigned = assignedCustomerMessage(order, {
    name: 'Test Technician',
    phone: '0911222333',
  });
  assert.equal(assigned.type, 'flex');
  assert.match(JSON.stringify(assigned.contents), /師傅已接單/);
  assert.match(JSON.stringify(assigned.contents), /Test Technician/);

  const cancelled = platformCancelledMessage({
    ...order,
    cancel_reason_text: '資料不完整，請重新送出報修',
  });
  assert.equal(cancelled.type, 'flex');
  assert.match(cancelled.altText, /案件已取消/);
  assert.match(JSON.stringify(cancelled.contents), /平台取消/);
  assert.match(JSON.stringify(cancelled.contents), /資料不完整/);

  const completion = completionMessage(order);
  assert.equal(completion.type, 'flex');
  assert.equal(footerActions(completion)[0].type, 'uri');
  assert.match(footerActions(completion)[0].uri, /\/confirm\?order_id=12&mode=completion/);
  assert.equal(footerActions(completion)[1].data, 'customer:dispute_completion:12');
});

test('technician LINE messages include quote, change request, and cancel actions', () => {
  const assignment = assignmentMessage(order, { id: 34 });
  assert.equal(assignment.type, 'flex');
  assert.equal(footerActions(assignment)[0].data, 'technician:accept_assignment:34');

  const assigned = assignedMessage(order);
  assert.equal(assigned.type, 'flex');
  assert.match(JSON.stringify(assigned.contents), /Chiayi test address/);
  assert.match(JSON.stringify(assigned.contents), /Pipe leak under sink/);
  assert.match(JSON.stringify(assigned.contents), /顧客照片/);
  assert.equal(footerActions(assigned)[0].type, 'uri');
  assert.match(footerActions(assigned)[0].uri, /\/quote\?order_id=12/);
  assert.equal(footerActions(assigned)[1].data, 'technician:cancel:12');

  const quotePrompt = quotePromptMessage(order);
  assert.equal(quotePrompt.type, 'flex');
  assert.match(JSON.stringify(quotePrompt.contents), /問題描述/);
  assert.match(JSON.stringify(quotePrompt.contents), /Pipe leak under sink/);
  assert.equal(footerActions(quotePrompt)[0].type, 'uri');
  assert.match(footerActions(quotePrompt)[0].uri, /\/quote\?order_id=12/);
  assert.equal(footerActions(quotePrompt)[1].data, 'technician:cancel:12');

  const changePrompt = changeRequestPromptMessage(order);
  assert.equal(changePrompt.type, 'flex');
  assert.equal(footerActions(changePrompt)[0].type, 'uri');
  assert.match(footerActions(changePrompt)[0].uri, /\/change-request\?order_id=12/);

  const acceptedQuote = acceptedQuoteTechnicianMessage(order);
  assert.equal(acceptedQuote.type, 'flex');
  assert.equal(footerActions(acceptedQuote)[0].data, 'technician:arrived:12');
  assert.equal(footerActions(acceptedQuote)[1].type, 'uri');
  assert.match(footerActions(acceptedQuote)[1].uri, /\/change-request\?order_id=12/);
  assert.equal(footerActions(acceptedQuote)[2].data, 'technician:complete:12');
  assert.equal(footerActions(acceptedQuote)[3].data, 'technician:cancel:12');

  const acceptedChange = acceptedChangeRequestTechnicianMessage(order);
  assert.equal(acceptedChange.type, 'flex');
  assert.match(JSON.stringify(acceptedChange.contents), /追加報價已同意/);
  assert.match(JSON.stringify(acceptedChange.contents), /若已處理完成/);
  assert.equal(footerActions(acceptedChange)[0].data, 'technician:complete:12');
  assert.equal(footerActions(acceptedChange)[1].type, 'uri');
  assert.match(footerActions(acceptedChange)[1].uri, /\/change-request\?order_id=12/);
  assert.equal(footerActions(acceptedChange)[2].data, 'technician:cancel:12');

  const arrived = arrivedTechnicianMessage(order);
  assert.equal(arrived.type, 'flex');
  assert.match(JSON.stringify(arrived.contents), /接下來可以追加報價或完工回報/);
  assert.equal(footerActions(arrived)[0].type, 'uri');
  assert.match(footerActions(arrived)[0].uri, /\/change-request\?order_id=12/);
  assert.equal(footerActions(arrived)[1].data, 'technician:complete:12');
  assert.equal(footerActions(arrived)[2].data, 'technician:cancel:12');
});

test('technician quote and change request text can omit order id', () => {
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

  assert.deepEqual(parseChangeRequestText('追加 500 更換零件'), {
    orderId: null,
    amount: 500,
    reason: '更換零件',
  });

  assert.deepEqual(parseChangeRequestText('追價 12 800 管線加長'), {
    orderId: '12',
    amount: 800,
    reason: '管線加長',
  });
});

test('technician idle text does not ask for quote when there is no case', () => {
  const idle = technicianIdleMessage();
  assert.match(idle, /目前沒有需要你處理的案件/);
  assert.match(idle, /案件還在尋找合適師傅中/);
  assert.doesNotMatch(idle, /報價 1500/);

  const active = technicianActiveHelpMessage([
    { id: 12, order_no: 'CJ-TEST', status: 'assigned' },
  ]);
  assert.match(active, /你目前有案件正在處理/);
  assert.match(active, /報價 1500/);
});

test('technician my orders text lists active order next steps', () => {
  const message = myOrdersMessage([
    {
      id: 12,
      order_no: 'CJ-TEST',
      status: 'assigned',
      service_type: '漏水',
      area: '西區',
    },
  ]);

  assert.match(message, /你目前有 1 張處理中案件/);
  assert.match(message, /CJ-TEST/);
  assert.match(message, /請先回報報價/);
});
