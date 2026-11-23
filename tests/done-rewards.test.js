// Kiểm thử phần thưởng sau done: tặng role (có rồi thì bỏ qua) + thả emoji tin legit (chạy độc lập: node tests/done-rewards.test.js)
const assert = require('assert');
const runtime = require('../utils/runtime');
const { giveDoneRole, reactBuyerLegit, rewardAfterDone, rewardLines } = require('../utils/doneRewards');

const ROLE = '333333333333333333', GID = '444444444444444444', BUYER = '555555555555555555', LCH = '666666666666666666';
let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('  ✅ ' + name); };

function mkGuild({ has = false, roleExists = true, fail = null, member = true } = {}) {
    const adds = [];
    const m = { roles: { cache: { has: () => has }, add: async (r, why) => { adds.push([r.id || r, why]); if (fail) throw fail; } } };
    return {
        id: GID, adds,
        members: { fetch: async () => (member ? m : Promise.reject(new Error('Unknown Member'))) },
        roles: { cache: new Map(roleExists ? [[ROLE, { id: ROLE, name: 'Khách VIP' }]] : []), fetch: async () => null }
    };
}
function mkClient(msgs) {
    const reacted = [];
    const list = msgs.map((m, i) => ({
        id: 'm' + i, author: { id: m.author }, content: m.content, createdTimestamp: m.ts,
        react: async (e) => { reacted.push([ 'm' + i, e ]); }
    }));
    const channel = { id: LCH, guildId: GID, messages: { fetch: async () => new Map(list.map(x => [x.id, x])) } };
    return { reacted, channels: { fetch: async (id) => (id === LCH ? channel : null) } };
}

(async () => {
    console.log('\nPhần thưởng sau done:');
    await t('chưa đặt role: không làm gì', async () => {
        runtime.setOverride('DONE_ROLE_ID@' + GID, '-');
        const g = mkGuild();
        assert.strictEqual((await giveDoneRole(g, BUYER)).status, 'none'); assert.strictEqual(g.adds.length, 0);
    });
    runtime.setOverride('DONE_ROLE_ID@' + GID, ROLE);
    await t('khách chưa có role: tặng đúng 1 lần', async () => {
        const g = mkGuild();
        const r = await giveDoneRole(g, BUYER);
        assert.strictEqual(r.status, 'given'); assert.strictEqual(g.adds.length, 1); assert.strictEqual(g.adds[0][0], ROLE);
    });
    await t('khách đã có role: bỏ qua, không gọi Discord', async () => {
        const g = mkGuild({ has: true });
        const r = await giveDoneRole(g, BUYER);
        assert.strictEqual(r.status, 'had'); assert.strictEqual(g.adds.length, 0);
        assert.match(rewardLines({ role: r })[0], /đã có role/);
    });
    await t('lỗi: khách rời server / role bị xóa / bot thiếu quyền đều trả về failed, không ném lỗi', async () => {
        assert.strictEqual((await giveDoneRole(mkGuild({ member: false }), BUYER)).status, 'failed');
        assert.strictEqual((await giveDoneRole(mkGuild({ roleExists: false }), BUYER)).status, 'failed');
        const perm = await giveDoneRole(mkGuild({ fail: Object.assign(new Error('Missing Permissions'), { code: 50013 }) }), BUYER);
        assert.strictEqual(perm.status, 'failed'); assert.ok(perm.why);
    });
    await t('thả emoji vào tin legit MỚI NHẤT của khách (3 emoji legit + tiền), bỏ qua tin người khác', async () => {
        runtime.setLegitChannel(GID, LCH);
        const c = mkClient([
            { author: BUYER, content: '+1 legit @shop', ts: 100 },
            { author: BUYER, content: '+1 legit @shop mfa', ts: 300 },
            { author: '999', content: '+1 legit', ts: 400 },
            { author: BUYER, content: 'xin chào', ts: 500 }
        ]);
        const r = await reactBuyerLegit(c, mkGuild(), BUYER);
        assert.strictEqual(r.status, 'reacted');
        assert.ok(c.reacted.every(([id]) => id === 'm1'));
        assert.strictEqual(c.reacted.length, 4); assert.strictEqual(c.reacted[3][1], '💰');
    });
    await t('khách chưa legit: no-message; không có kênh legit: no-channel', async () => {
        const c = mkClient([{ author: '999', content: '+1 legit', ts: 1 }]);
        assert.strictEqual((await reactBuyerLegit(c, mkGuild(), BUYER)).status, 'no-message');
        runtime.setLegitChannel(GID, null);
        assert.strictEqual((await reactBuyerLegit(c, mkGuild(), BUYER)).status, 'no-channel');
    });
    await t('rewardAfterDone gộp role + legit', async () => {
        runtime.setLegitChannel(GID, LCH);
        const g = mkGuild(); const c = mkClient([{ author: BUYER, content: '+1 legit', ts: 1 }]);
        const r = await rewardAfterDone({ client: c, guild: g, userId: BUYER, reason: 'test' });
        assert.strictEqual(r.role.status, 'given'); assert.strictEqual(r.legit.status, 'reacted');
        assert.strictEqual(rewardLines(r).length, 2);
    });
    console.log(`\n${pass} kiểm thử đạt.`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
