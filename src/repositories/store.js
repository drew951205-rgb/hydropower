const tables = {
  users: [],
  customer_sessions: [],
  orders: [],
  assignments: [],
  order_messages: [],
  order_images: [],
  order_logs: [],
  support_tickets: [],
};

const counters = Object.fromEntries(
  Object.keys(tables).map((name) => [name, 1])
);

function nowIso() {
  return new Date().toISOString();
}

function insert(tableName, payload) {
  const record = {
    id: counters[tableName]++,
    ...payload,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  tables[tableName].push(record);
  return record;
}

function update(tableName, id, changes) {
  const record = tables[tableName].find(
    (item) => String(item.id) === String(id)
  );
  if (!record) return null;
  Object.assign(record, changes, { updated_at: nowIso() });
  return record;
}

function removeWhere(tableName, predicate) {
  tables[tableName] = tables[tableName].filter((item) => !predicate(item));
}

function find(tableName, predicate) {
  return tables[tableName].find(predicate) || null;
}

function filter(tableName, predicate = () => true) {
  return tables[tableName].filter(predicate);
}

function getAll(tableName) {
  return tables[tableName] || [];
}

module.exports = { tables, insert, update, removeWhere, find, filter, getAll };
