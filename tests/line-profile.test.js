const test = require('node:test');
const assert = require('node:assert/strict');

const { buildProfileChanges } = require('../src/services/line-profile.service');

test('LINE profile changes fill customer name and profile fields', () => {
  const changes = buildProfileChanges(
    { id: 1, name: null },
    {
      displayName: '王小明',
      pictureUrl: 'https://example.test/avatar.png',
      language: 'zh-TW'
    }
  );

  assert.deepEqual(changes, {
    name: '王小明',
    line_display_name: '王小明',
    line_picture_url: 'https://example.test/avatar.png',
    line_language: 'zh-TW'
  });
});

test('LINE profile changes do not overwrite an existing manual name', () => {
  const changes = buildProfileChanges(
    { id: 1, name: '手動姓名' },
    { displayName: 'LINE 名稱' }
  );

  assert.equal(changes.name, undefined);
  assert.equal(changes.line_display_name, 'LINE 名稱');
});
