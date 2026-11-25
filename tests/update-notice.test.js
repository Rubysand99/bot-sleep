// Kiểm thử embed thông báo mỗi lần bot cập nhật (phiên bản hiện tại + trước + nội dung changelog)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

process.env.MONGODB_URI = 'mongodb://fake';
process.env.DATA_ENCRYPTION_KEY = 'test-key-test-key-test-key-1234';
process.env.LOG_LEVEL = 'error';
delete process.env.UPDATE_NOTICE; delete process.env.UPDATE_CHANNEL_ID;
const { FakeMongoClient } = require('./fakeMongo');
const origLoad = Module._load;
Module._load = function (request, ...rest) { return request === 'mongodb' ? { MongoClient: FakeMongoClient } : origLoad.call(this, request, ...rest); };
const db = require('../utils/db');
const C = require('../utils/constants');
const U = require('../utils/updateNotice');

let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log(`  ✅ ${name}`); } catch (e) { fail++; console.log(`  ❌ ${name}\n     ${e.message}`); } };
const mkRoot = (md) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-')); if (md != null) fs.writeFileSync(path.join(d, 'CHANGELOG.md'), md); return d; };
const mkClient = ({ reachable = true, sendFails = false } = {}) => {
    const sent = [];
    const channel = { async send(x) { if (sendFails) throw new Error('Missing Access'); sent.push(x); } };
    return { sent, user: { id: 'BOT1', username: 'Drew AutoBuy', displayName: 'Drew AutoBuy', displayAvatarURL: () => null },
        channels: { fetch: async (id) => (reachable && id === '1501883287902355516' ? channel : Promise.reject(new Error('Unknown Channel'))) } };
};
const MD = '# Nhật ký\n\ngiới thiệu\n\n## 27/11 · Sửa lỗi B\n- fix B\n\n## 26/11 · Tính năng A\n- thêm A\n- thêm A2\n';

(async () => {
    console.log('\nThông báo cập nhật:');
    await db.connect();

    await t('kênh mặc định đúng ID người dùng đưa', () => assert.strictEqual(C.UPDATE_CHANNEL_ID, '1501883287902355516'));
    await t('đọc changelog: bỏ phần giới thiệu, mới nhất ở trên', () => {
        const e = U.parseChangelog(MD);
        assert.deepStrictEqual(e.map(x => x.title), ['27/11 · Sửa lỗi B', '26/11 · Tính năng A']);
        assert.deepStrictEqual(e[1].lines, ['- thêm A', '- thêm A2']);
    });
    await t('mục chưa thông báo: lần đầu lấy mục mới nhất, sau đó lấy các mục nằm trên mục đã báo', () => {
        const e = U.parseChangelog(MD);
        assert.deepStrictEqual(U.pendingEntries(e, null).map(x => x.title), ['27/11 · Sửa lỗi B']);
        assert.deepStrictEqual(U.pendingEntries(e, '26/11 · Tính năng A').map(x => x.title), ['27/11 · Sửa lỗi B']);
        assert.deepStrictEqual(U.pendingEntries(e, '27/11 · Sửa lỗi B'), []);
        assert.deepStrictEqual(U.pendingEntries(e, 'mục đã bị xóa').length, 1);
    });
    await t('lần đầu: gửi embed có version hiện tại, "chưa có" bản trước và nội dung', async () => {
        const cl = mkClient(), root = mkRoot(MD);
        assert.strictEqual(await U.announceUpdate(cl, { version: '1.1', tenths: 11, bumped: true }, root), true);
        const e = cl.sent[0].embeds[0].toJSON();
        assert.ok(e.title.includes('Drew AutoBuy') && e.title.includes('v1.1'));
        const f = Object.fromEntries(e.fields.map(x => [x.name, x.value]));
        assert.strictEqual(f['📦 Phiên bản hiện tại'], '`v1.1`');
        assert.ok(f['⏮️ Phiên bản trước'].includes('chưa có'));
        assert.ok(e.description.includes('fix B') && !e.description.includes('thêm A'));
    });
    await t('restart cùng bản: KHÔNG gửi lại', async () => {
        const cl = mkClient();
        assert.strictEqual(await U.announceUpdate(cl, { version: '1.1', tenths: 11, bumped: false }, mkRoot(MD)), false);
        assert.strictEqual(cl.sent.length, 0);
    });
    await t('bản mới: ghi version trước + chỉ nội dung chưa báo; không có mục mới thì báo cập nhật nhỏ', async () => {
        const cl = mkClient(), root = mkRoot('## 28/11 · Mới C\n- thêm C\n\n' + MD.split('\n').slice(4).join('\n'));
        assert.strictEqual(await U.announceUpdate(cl, { version: '1.2', tenths: 12, bumped: true }, root), true);
        const e = cl.sent[0].embeds[0].toJSON();
        const f = Object.fromEntries(e.fields.map(x => [x.name, x.value]));
        assert.strictEqual(f['⏮️ Phiên bản trước'], '`v1.1`'); assert.strictEqual(f['📦 Phiên bản hiện tại'], '`v1.2`');
        assert.ok(e.description.includes('thêm C') && !e.description.includes('fix B'));
        const cl2 = mkClient();
        assert.strictEqual(await U.announceUpdate(cl2, { version: '1.3', tenths: 13, bumped: true }, root), true);
        assert.ok(cl2.sent[0].embeds[0].toJSON().description.includes('sửa lỗi nhỏ'), 'không có mục mới thì báo chung');
    });
    await t('không thấy kênh / gửi lỗi: không đánh dấu đã báo, lần sau thử lại', async () => {
        const root = mkRoot(MD);
        assert.strictEqual(await U.announceUpdate(mkClient({ reachable: false }), { version: '2', tenths: 20, bumped: true }, root), false);
        assert.strictEqual(await U.announceUpdate(mkClient({ sendFails: true }), { version: '2', tenths: 20, bumped: true }, root), false);
        const ok = mkClient();
        assert.strictEqual(await U.announceUpdate(ok, { version: '2', tenths: 20, bumped: true }, root), true);
    });
    await t('UPDATE_NOTICE=off hoặc tắt version: không gửi', async () => {
        process.env.UPDATE_NOTICE = 'off';
        const cl = mkClient();
        assert.strictEqual(await U.announceUpdate(cl, { version: '3', tenths: 30, bumped: true }, mkRoot(MD)), false);
        delete process.env.UPDATE_NOTICE;
        assert.strictEqual(await U.announceUpdate(cl, null, mkRoot(MD)), false);
        assert.strictEqual(cl.sent.length, 0);
    });

    console.log(`\n${pass} kiểm thử đạt${fail ? `, ${fail} LỖI` : '.'}`);
    await db.close();
    process.exit(fail ? 1 : 0);
})();
