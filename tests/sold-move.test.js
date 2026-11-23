// Kiểm thử chuyển kênh sang danh mục Sold (chạy độc lập: node tests/sold-move.test.js)
const assert = require('assert');
const { ChannelType } = require('discord.js');
const { moveToSoldCategory } = require('../utils/soldMove');

const CAT = '111111111111111111';

function mkGuild({ cat = { id: CAT, name: 'Sold', type: ChannelType.GuildCategory }, children = 0, extraCats = [] } = {}) {
    const cache = new Map();
    if (cat) cache.set(cat.id, cat);
    for (const c of extraCats) cache.set(c.id, c);
    for (let i = 0; i < children; i++) cache.set('c' + i, { id: 'c' + i, parentId: CAT, type: ChannelType.GuildText });
    const g = { id: 'g1', created: [], channels: { cache, fetch: async (id) => (cat && id === cat.id ? cat : null) } };
    let seq = 900;
    g.channels.create = async (opts) => {
        const c = { id: String(++seq), name: opts.name, type: opts.type, permissionOverwrites: { cache: new Map() }, opts };
        cache.set(c.id, c); g.created.push(c); return c;
    };
    return g;
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
    await t('danh mục đầy 50 kênh: tự tạo "Sold 1" cùng quyền và chuyển kênh vào đó', async () => {
        const g = mkGuild({ children: 50 });
        g.channels.cache.get(CAT).permissionOverwrites = { cache: new Map([['r1', { id: 'r1', type: 0, allow: 1n, deny: 2n }]]) };
        const ch = mkChannel(g);
        const r = await moveToSoldCategory(ch, CAT);
        assert.ok(r.ok && r.moved && r.created);
        assert.strictEqual(g.created.length, 1);
        assert.strictEqual(g.created[0].name, 'Sold 1');
        assert.strictEqual(g.created[0].opts.type, ChannelType.GuildCategory);
        assert.deepStrictEqual(g.created[0].opts.permissionOverwrites, [{ id: 'r1', type: 0, allow: 1n, deny: 2n }]);
        assert.strictEqual(ch.parentId, g.created[0].id);
    });
    await t('Sold và Sold 1 đều đầy: tạo "Sold 2"; Sold 1 còn chỗ thì dùng lại, không tạo thêm', async () => {
        const s1 = { id: '222222222222222222', name: 'Sold 1', type: ChannelType.GuildCategory };
        const g = mkGuild({ children: 50, extraCats: [s1] });
        for (let i = 0; i < 50; i++) g.channels.cache.set('d' + i, { id: 'd' + i, parentId: s1.id, type: ChannelType.GuildText });
        const r = await moveToSoldCategory(mkChannel(g), CAT);
        assert.ok(r.ok && r.created); assert.strictEqual(g.created[0].name, 'Sold 2');
        const g2 = mkGuild({ children: 50, extraCats: [{ ...s1 }] });
        const r2 = await moveToSoldCategory(mkChannel(g2), CAT);
        assert.ok(r2.ok && r2.moved && !r2.created); assert.strictEqual(g2.created.length, 0);
        assert.strictEqual(r2.category.id, s1.id);
    });
    await t('kênh đã nằm trong "Sold 1" thì không chuyển lại; 5 đơn cùng lúc khi đầy chỉ tạo 1 danh mục', async () => {
        const s1 = { id: '222222222222222222', name: 'Sold 1', type: ChannelType.GuildCategory };
        const g = mkGuild({ children: 50, extraCats: [s1] });
        const inS1 = mkChannel(g, { parentId: s1.id });
        const r = await moveToSoldCategory(inS1, CAT);
        assert.ok(r.ok && !r.moved); assert.strictEqual(inS1.calls.length, 0);
        const g2 = mkGuild({ children: 50 });
        const chs = [1, 2, 3, 4, 5].map(() => mkChannel(g2));
        const rs = await Promise.all(chs.map(c => moveToSoldCategory(c, CAT)));
        assert.ok(rs.every(x => x.ok)); assert.strictEqual(g2.created.length, 1);
        assert.ok(chs.every(c => c.parentId === g2.created[0].id));
    });
    await t('đầy mà bot thiếu quyền tạo danh mục: báo rõ lý do', async () => {
        const g = mkGuild({ children: 50 });
        g.channels.create = async () => { throw Object.assign(new Error('Missing Permissions'), { code: 50013 }); };
        const r = await moveToSoldCategory(mkChannel(g), CAT);
        assert.ok(!r.ok); assert.match(r.problem, /Manage Channels/);
    });
    await t('Discord báo đầy dù bộ nhớ đệm đếm thiếu: tự sang danh mục mới', async () => {
        const g = mkGuild();
        const ch = mkChannel(g, { fail: Object.assign(new Error('Maximum number of channels in category reached'), { code: 50035 }) });
        const orig = ch.setParent.bind(ch); let n = 0;
        ch.setParent = async (id, o) => { if (++n === 1) return orig(id, o); ch.calls.push([id, o]); ch.parentId = id; };
        const r = await moveToSoldCategory(ch, CAT);
        assert.ok(r.ok && r.moved && r.created); assert.strictEqual(g.created[0].name, 'Sold 1');
    });
    await t('lỗi từ Discord: thiếu quyền (50013) và đầy (50035) được dịch ra lý do', async () => {
        const perm = await moveToSoldCategory(mkChannel(mkGuild(), { fail: Object.assign(new Error('Missing Permissions'), { code: 50013 }) }), CAT);
        assert.match(perm.problem, /Manage Channels/); assert.ok(perm.err);
        const gFull = mkGuild(); gFull.channels.create = async () => { throw Object.assign(new Error('Missing Permissions'), { code: 50013 }); };
        const full = await moveToSoldCategory(mkChannel(gFull, { fail: Object.assign(new Error('Maximum number of channels in category reached'), { code: 50035 }) }), CAT);
        assert.ok(!full.ok); assert.match(full.problem, /đầy|Manage Channels/);
    });
    console.log(`\n${pass} kiểm thử đạt.`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
