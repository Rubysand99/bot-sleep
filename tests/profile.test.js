// Kiểm thử chế độ bot (BOT_PROFILE): drew / cartone / full
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function t(name, fn) {
    try { fn(); pass++; console.log(`  ✅ ${name}`); }
    catch (e) { fail++; console.log(`  ❌ ${name}\n     ${e.message}`); }
}
const load = (id, extra = {}) => {
    for (const k of Object.keys(require.cache)) if (/[\\/](utils[\\/](profile|runtime|help))\.js$/.test(k)) delete require.cache[k];
    if (id === undefined) delete process.env.BOT_PROFILE; else process.env.BOT_PROFILE = id;
    if (extra.allowed === undefined) delete process.env.ALLOWED_GUILD_IDS; else process.env.ALLOWED_GUILD_IDS = extra.allowed;
    return { profile: require('../utils/profile'), runtime: require('../utils/runtime'), help: require('../utils/help') };
};
const cmdFiles = fs.readdirSync(path.join(__dirname, '..', 'commands')).filter(f => f.endsWith('.js')).map(f => f.replace(/\.js$/, ''));
const enabled = (p) => cmdFiles.filter(n => p.commandEnabled(n)).sort();

console.log('\nChế độ bot:');

t('mọi file trong commands/ đều được khai báo trong COMMAND_FEATURE (không lệnh nào rơi vào "common" do quên)', () => {
    const { profile } = load('full');
    const missing = cmdFiles.filter(n => !(n in profile.COMMAND_FEATURE));
    assert.deepStrictEqual(missing, []);
});

t('chế độ mặc định / không hợp lệ = full (giữ hành vi cũ, đủ mọi lệnh)', () => {
    for (const v of [undefined, '', 'abc']) {
        const { profile } = load(v);
        assert.strictEqual(profile.current().id, 'full');
        assert.deepStrictEqual(enabled(profile), [...cmdFiles].sort());
    }
});

t('drew và cartone đều có auto buy + bxh + sold + legit (cùng bộ lệnh)', () => {
    const d = load('drew'), c = load('cartone');
    const on = enabled(d.profile);
    for (const n of ['add_acc', 'stock', 'set_qr', 'restock', 'moc_role', 'leaderboard', 'done', 'set_kenhsold', 'taokenh', 'xoakenh', 'config', 'staff', 'owner']) assert.ok(on.includes(n), `thiếu /${n}`);
    assert.deepStrictEqual(enabled(c.profile), on);
    for (const p of [d.profile, c.profile]) assert.ok(p.has('autobuy') && p.has('bxh') && p.has('sold') && p.has('legit'));
});

t('đếm legit: mặc định cartone / full BẬT, drew TẮT; cả 3 chế độ đều bật / tắt được bằng /config legit_dem', () => {
    let m = load('cartone');
    assert.strictEqual(m.runtime.isLegitEnabled('G1'), true, 'cartone mặc định đếm');
    m.runtime.setLegitEnabled('G1', false);
    assert.strictEqual(m.runtime.isLegitEnabled('G1'), false, 'cartone tắt được');
    assert.strictEqual(m.runtime.isLegitEnabled('G2'), true, 'server khác không bị ảnh hưởng');
    m = load('drew');
    assert.strictEqual(m.runtime.isLegitEnabled('G1'), false, 'drew mặc định không đếm');
    m.runtime.setLegitEnabled('G1', true);
    assert.strictEqual(m.runtime.isLegitEnabled('G1'), true, 'drew bật được');
    assert.strictEqual(m.runtime.isLegitEnabled('G2'), false, 'server khác vẫn theo mặc định');
    m = load('full');
    assert.strictEqual(m.runtime.isLegitEnabled('G1'), true, 'full mặc định bật');
    m.runtime.setLegitEnabled('G1', false);
    assert.strictEqual(m.runtime.isLegitEnabled('G1'), false, 'full tắt được');
});

t('ALLOWED_GUILD_IDS: chỉ phục vụ server trong danh sách; để trống = mọi server', () => {
    let { profile } = load('drew', { allowed: '111111111111111111, 222222222222222222' });
    assert.ok(profile.guildAllowed('111111111111111111') && profile.guildAllowed('222222222222222222'));
    assert.ok(!profile.guildAllowed('333333333333333333'));
    ({ profile } = load('drew'));
    assert.ok(profile.guildAllowed('333333333333333333'));
});

t('.help: cả hai có đủ lệnh auto buy + bxh và đều có lệnh bật / tắt đếm legit', () => {
    const OID = '123456789012345678';
    const text = (id) => {
        process.env.OWNER_ID = OID;
        const { help } = load(id);
        return help.buildHelpEmbed({ id: OID, guild: null }).data.fields.map(f => f.value).join('\n');
    };
    const drew = text('drew'), cartone = text('cartone');
    for (const x of [drew, cartone]) assert.ok(x.includes('/stock') && x.includes('.bxh') && x.includes('/leaderboard') && x.includes('.done'));
    assert.ok(drew.includes('/config legit_dem') && cartone.includes('/config legit_dem'), 'cả 2 bot đều bật / tắt đếm legit được');
    assert.ok(!drew.includes('không tắt được') && !cartone.includes('không tắt được'));
});

t('log QR không lộ số tài khoản', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'vietqr.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    assert.ok(!/coAnh: !!qrImageUrl, url:/.test(src), 'log chọn nguồn QR không được kèm url');
    assert.ok(!/url: href/.test(src), 'log lỗi QR phải dùng safeUrl');
});

console.log(`\n${pass}/${pass + fail} kiểm thử chế độ bot đạt${fail ? `, ${fail} LỖI` : ''}`);
process.exit(fail ? 1 : 0);
