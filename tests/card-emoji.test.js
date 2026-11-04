// Nút BUY không bao giờ làm hỏng tin nhắn vì emoji custom không hợp lệ (chạy độc lập: node tests/card-emoji.test.js)
const assert = require('assert');
const path = require('path');
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ✅ ' + name); };

function load(emojiEnv) {
    for (const k of Object.keys(require.cache)) if (k.includes(path.sep + 'utils' + path.sep) && !k.includes('node_modules')) delete require.cache[k];
    if (emojiEnv === undefined) delete process.env.EMOJI_ONLINE; else process.env.EMOJI_ONLINE = emojiEnv;
    return require(path.join(__dirname, '..', 'utils', 'cardButtons.js'));
}
const emojiOf = (row) => row.components.map(b => b.data.emoji);

console.log('\nEmoji nút BUY:');
t('emoji custom bot thấy -> giữ nguyên cho cả 2 nút', () => {
    const m = load('<a:Online:111222333444555666>');
    m.setEmojiChecker(id => id === '111222333444555666');
    for (const e of emojiOf(m.buildCardRow('available', 'Acc1'))) assert.strictEqual(e.id, '111222333444555666');
});
t('emoji custom bot KHÔNG thấy -> đổi sang emoji thường, không còn id lỗi', () => {
    const m = load('<a:Online:111222333444555666>');
    m.setEmojiChecker(() => false);
    for (const e of emojiOf(m.buildCardRow('available', 'Acc1'))) { assert.strictEqual(e.name, '🟢'); assert.ok(!e.id); }
});
t('emoji thường (unicode) luôn giữ nguyên', () => {
    const m = load('🔥');
    m.setEmojiChecker(() => false);
    for (const e of emojiOf(m.buildCardRow('available', 'Acc1'))) assert.strictEqual(e.name, '🔥');
});
t('chưa gắn hàm kiểm tra -> giữ cấu hình như cũ', () => {
    const m = load('<a:Online:111222333444555666>');
    for (const e of emojiOf(m.buildCardRow('available', 'Acc1'))) assert.strictEqual(e.id, '111222333444555666');
});
t('trạng thái pending / sold không dùng emoji custom', () => {
    const m = load('<a:Online:111222333444555666>');
    m.setEmojiChecker(() => false);
    for (const s of ['pending', 'sold']) for (const e of emojiOf(m.buildCardRow(s, 'Acc1'))) assert.ok(!e.id);
});
console.log(`\n${pass}/5 kiểm thử emoji nút đạt`);
