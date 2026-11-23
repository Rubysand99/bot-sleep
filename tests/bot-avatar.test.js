// Kiểm thử /bot_avatar và tên thương hiệu Zin Yeah Store (chạy độc lập: node tests/bot-avatar.test.js)
const assert = require('assert');
process.env.OWNER_ID = '111111111111111111';
const profile = require('../utils/profile');
const cmd = require('../commands/bot_avatar');

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('  ✅ ' + name); };

function mk({ owner = true, icon = 'https://cdn.discordapp.com/icons/1/a.png', doiTen = false, avatarFail = null, username = 'Cartone bot' } = {}) {
    const calls = { avatar: [], name: [], replies: [], edits: [] };
    const bot = { username,
        async setAvatar(u) { calls.avatar.push(u); if (avatarFail) throw avatarFail; },
        async setUsername(n) { calls.name.push(n); } };
    const i = {
        user: { id: owner ? '111111111111111111' : '222222222222222222' },
        guild: { id: '1', name: 'Zin Yeah', iconURL: (o) => { calls.iconOpts = o; return icon; } },
        client: { user: bot },
        options: { getBoolean: () => doiTen },
        async reply(x) { calls.replies.push(x); }, async deferReply() {}, async editReply(x) { calls.edits.push(x); }
    };
    return { i, calls };
}

(async () => {
    console.log('\n/bot_avatar:');
    await t('profile cartone mang tên thương hiệu Zin Yeah Store; lệnh có ở mọi profile', async () => {
        process.env.BOT_PROFILE = 'cartone';
        assert.strictEqual(profile.brand(), 'Zin Yeah Store');
        for (const p of ['drew', 'cartone', 'full']) { process.env.BOT_PROFILE = p; assert.ok(profile.commandEnabled('bot_avatar')); }
        process.env.BOT_PROFILE = 'drew'; assert.strictEqual(profile.brand(), 'Drew Store');
    });
    await t('không phải Owner: bị từ chối, không đổi gì', async () => {
        const { i, calls } = mk({ owner: false });
        await cmd.execute(i);
        assert.match(calls.replies[0].content, /Owner/); assert.strictEqual(calls.avatar.length, 0);
    });
    await t('đổi avatar bằng icon PNG tĩnh của server, không đổi tên nếu không yêu cầu', async () => {
        const { i, calls } = mk();
        await cmd.execute(i);
        assert.deepStrictEqual(calls.avatar, ['https://cdn.discordapp.com/icons/1/a.png']);
        assert.strictEqual(calls.iconOpts.extension, 'png'); assert.strictEqual(calls.iconOpts.forceStatic, true);
        assert.strictEqual(calls.name.length, 0);
    });
    await t('doi_ten: đổi tên bot thành tên thương hiệu của profile', async () => {
        process.env.BOT_PROFILE = 'cartone';
        const { i, calls } = mk({ doiTen: true });
        await cmd.execute(i);
        assert.deepStrictEqual(calls.name, ['Zin Yeah Store']);
        const again = mk({ doiTen: true, username: 'Zin Yeah Store' });
        await cmd.execute(again.i); assert.strictEqual(again.calls.name.length, 0);
    });
    await t('server chưa có icon / Discord giới hạn tốc độ: báo rõ, không crash', async () => {
        const noIcon = mk({ icon: null }); await cmd.execute(noIcon.i);
        assert.match(noIcon.calls.replies[0].content, /chưa có icon/);
        const limited = mk({ avatarFail: new Error('You are changing your avatar too fast') });
        await cmd.execute(limited.i);
        assert.match(limited.calls.edits[0].content, /giới hạn tốc độ/);
    });
    console.log(`\n${pass} kiểm thử đạt.`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
