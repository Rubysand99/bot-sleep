// Kiểm thử chuyển kênh sang danh mục Sold (chạy độc lập: node tests/sold-move.test.js)
const assert = require('assert');
const { ChannelType } = require('discord.js');
const { moveToSoldCategory } = require('../utils/soldMove');

const CAT = '111111111111111111';

function mkGuild({ cat = { id: CAT, name: 'Sold', type: ChannelType.GuildCategory }, children = 0 } = {}) {
    const cache = new Map();
    for (let i = 0; i < children; i++) cache.set('c' + i, { id: 'c' + i, parentId: CAT });
    return { channels: { cache, fetch: async (id) => (cat && id === cat.id ? cat : null) } };
}
function mkChannel(guild, { parentId = null, fail = null } = {}) {
    return { guild, parentId, calls: [], async setParent(id, o) { this.calls.push([id, o]); if (fail) throw fail; this.parentId = id; } };
}

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('  ✅ ' + name); };

(async () => {
    console.log('\nChuyển kênh sang danh mục Sold:');
    await t('chuyển thành công và giữ nguyên quyền kênh (lockPermissions: false)', async () => {
        const ch = mkChannel(mkGuild());
        const r = await moveToSoldCategory(ch, CAT);
        assert.ok(r.ok && r.moved);
        assert.deepStrictEqual(ch.calls[0], [CAT, { lockPermissions: false }]);
    });
    await t('đã ở trong danh mục Sold thì không gọi lại', async () => {
        const ch = mkChannel(mkGuild(), { parentId: CAT });
        const r = await moveToSoldCategory(ch, CAT);
        assert.ok(r.ok && !r.moved); assert.strictEqual(ch.calls.length, 0);
    });
    await t('chưa đặt danh mục / danh mục không thuộc server / không phải category', async () => {
        assert.match((await moveToSoldCategory(mkChannel(mkGuild()), null)).problem, /Chưa đặt/);
        assert.match((await moveToSoldCategory(mkChannel(mkGuild({ cat: null })), CAT)).problem, /không thuộc server/);
        const textCh = { id: CAT, name: 'x', type: ChannelType.GuildText };
        assert.match((await moveToSoldCategory(mkChannel(mkGuild({ cat: textCh })), CAT)).problem, /không phải là danh mục/);
    });
    await t('danh mục đầy 50 kênh: báo rõ, không gọi Discord', async () => {
        const ch = mkChannel(mkGuild({ children: 50 }));
        const r = await moveToSoldCategory(ch, CAT);
        assert.ok(!r.ok); assert.match(r.problem, /đã đầy/); assert.strictEqual(ch.calls.length, 0);
    });
    await t('lỗi từ Discord: thiếu quyền (50013) và đầy (50035) được dịch ra lý do', async () => {
        const perm = await moveToSoldCategory(mkChannel(mkGuild(), { fail: Object.assign(new Error('Missing Permissions'), { code: 50013 }) }), CAT);
        assert.match(perm.problem, /Manage Channels/); assert.ok(perm.err);
        const full = await moveToSoldCategory(mkChannel(mkGuild(), { fail: Object.assign(new Error('Maximum number of channels in category reached'), { code: 50035 }) }), CAT);
        assert.match(full.problem, /đã đầy/);
    });
    console.log(`\n${pass} kiểm thử đạt.`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
