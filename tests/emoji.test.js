// Kiểm thử emoji cấu hình theo server (chạy độc lập: node tests/emoji.test.js)
const assert = require('assert');
const path = require('path');

function load(env = {}) {
    for (const k of Object.keys(require.cache)) if (k.includes(path.sep + 'utils' + path.sep) && !k.includes('node_modules')) delete require.cache[k];
    for (const k of ['EMOJI_ONLINE', 'EMOJI_OFFLINE', 'EMOJI_INFO', 'LEGIT_REACT_EMOJIS', 'LEGIT_REACT_BACKUP_3']) delete process.env[k];
    Object.assign(process.env, env);
    return require(path.join(__dirname, '..', 'utils', 'emojis.js'));
}
class Cache extends Map { find(fn) { for (const v of this.values()) if (fn(v)) return v; return undefined; } }
const emo = (id, name, animated = false, guildName = 'Shop') => ({ id, name, animated, guild: { name: guildName } });
const mkClient = (...list) => ({ emojis: { cache: new Cache(list.map(e => [e.id, e])) } });

const A = '111111111111111111', B = '222222222222222222';
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ✅ ' + name); };

console.log('\nEmoji cấu hình theo server:');
t('parseEmoji: custom, động, emoji thường, không phải emoji', () => {
    const m = load();
    assert.deepStrictEqual(m.parseEmoji(`<a:On:${A}>`), { custom: true, animated: true, name: 'On', id: A, raw: `<a:On:${A}>` });
    assert.strictEqual(m.parseEmoji(`<:Tick:${A}>`).animated, false);
    for (const u of ['✅', '☑️', '🟢', 'ℹ️', '👍🏽', '1️⃣']) assert.strictEqual(m.parseEmoji(u)?.custom, false, u);
    for (const bad of ['', '   ', 'abc', ':tick:', 'ab 🟢', '<a:x:1>']) assert.strictEqual(m.parseEmoji(bad), null, JSON.stringify(bad));
});
t('mặc định lấy từ biến môi trường / code; server đặt thì ưu tiên server, reset thì về mặc định', () => {
    const m = load({ EMOJI_ONLINE: `<a:Env:${A}>` });
    assert.strictEqual(m.configured('online', 'G1'), `<a:Env:${A}>`);
    m.setOverride('G1', 'online', `<a:Mine:${B}>`);
    assert.strictEqual(m.configured('online', 'G1'), `<a:Mine:${B}>`);
    assert.strictEqual(m.configured('online', 'G2'), `<a:Env:${A}>`, 'server khác không bị ảnh hưởng');
    assert.strictEqual(m.sourceOf('online', 'G1'), 'server');
    m.setOverride('G1', 'online', null);
    assert.strictEqual(m.configured('online', 'G1'), `<a:Env:${A}>`);
    assert.strictEqual(m.sourceOf('online', 'G1'), 'mac_dinh');
});
t('effective: emoji custom bot thấy thì GIỮ NGUYÊN, không thay bằng emoji thường', () => {
    const m = load();
    m.setOverride('G1', 'online', `<a:Mine:${B}>`);
    m.setEmojiChecker(id => id === B);
    const e = m.effective('online', 'G1');
    assert.strictEqual(e.value, `<a:Mine:${B}>`);
    assert.strictEqual(e.usedFallback, false);
});
t('effective: emoji custom bot KHÔNG thấy thì mới dùng emoji thường', () => {
    const m = load();
    m.setOverride('G1', 'online', `<a:Mine:${B}>`);
    m.setEmojiChecker(() => false);
    const e = m.effective('online', 'G1');
    assert.strictEqual(e.value, '🟢');
    assert.strictEqual(e.usedFallback, true);
    assert.strictEqual(m.text('offline', 'G1') && typeof m.text('offline', 'G1'), 'string');
});
t('reaction legit: theo cấu hình server; chuỗi dự phòng = custom dự phòng trước, emoji thường sau cùng', () => {
    const m = load();
    assert.strictEqual(m.legitConfigured('G1').length, 3);
    m.setOverride('G1', 'legit2', `<:Mine:${B}>`);
    assert.strictEqual(m.legitConfigured('G1')[1], `<:Mine:${B}>`);
    assert.notStrictEqual(m.legitConfigured('G2')[1], `<:Mine:${B}>`);
    const chain = m.reactionChain(2, 'G1');
    assert.strictEqual(chain[chain.length - 1], '🟢', 'emoji thường nằm cuối cùng');
    assert.ok(chain.length >= 2 && chain.slice(0, -1).every(e => m.parseEmoji(e)?.custom), 'trước đó toàn emoji custom');
    assert.strictEqual(new Set(chain).size, chain.length, 'không trùng');
});
t('resolveInput: mã custom / ID / tên emoji / emoji thường', () => {
    const m = load();
    const client = mkClient(emo(A, 'CanhXanh', true, 'Drew'), emo(B, 'Tick'));
    const guild = { emojis: { cache: new Cache([[B, emo(B, 'Tick')]]) } };
    let r = m.resolveInput(`<a:CanhXanh:${A}>`, client, guild);
    assert.ok(r.ok && r.custom && r.value === `<a:CanhXanh:${A}>` && r.guildName === 'Drew');
    r = m.resolveInput(A, client, guild);
    assert.ok(r.ok && r.value === `<a:CanhXanh:${A}>`, 'đúng ID, tự nhận emoji động');
    r = m.resolveInput('tick', client, guild);
    assert.ok(r.ok && r.value === `<:Tick:${B}>`, 'tìm theo tên (không phân biệt hoa thường)');
    r = m.resolveInput(':canhxanh:', client, guild);
    assert.ok(r.ok && r.id === A, 'tìm theo :tên: ở server khác bot thấy');
    r = m.resolveInput('🔥', client, guild);
    assert.ok(r.ok && !r.custom && r.value === '🔥');
});
t('resolveInput: từ chối emoji bot không thấy, tên không tồn tại, văn bản linh tinh', () => {
    const m = load();
    const client = mkClient(emo(A, 'CanhXanh'));
    const guild = { emojis: { cache: new Cache() } };
    for (const bad of [`<a:Lạ:${B}>`.replace('ạ', 'a'), B, 'khongco', 'xin chào', '']) {
        const r = m.resolveInput(bad, client, guild);
        assert.strictEqual(r.ok, false, JSON.stringify(bad));
        assert.ok(r.error && r.error.length > 10);
    }
});
t('mọi vị trí emoji đều có tên, nhãn và emoji thường dự phòng', () => {
    const m = load();
    assert.deepStrictEqual(m.SLOTS.map(s => s.key), ['online', 'offline', 'info', 'legit1', 'legit2', 'legit3']);
    for (const s of m.SLOTS) {
        assert.ok(s.label);
        assert.strictEqual(m.parseEmoji(m.effective(s.key, 'G1').value) !== null, true, s.key);
    }
});
console.log(`\n${pass}/8 kiểm thử emoji theo server đạt`);
