// Kiểm thử nhận diện tin legit (chạy độc lập: node tests/legit-detect.test.js)
const assert = require('assert');
const path = require('path');
const { isLegitMessage } = require(path.join(__dirname, '..', 'utils', 'legit.js'));
const C = require(path.join(__dirname, '..', 'utils', 'constants.js'));

const S = '<@1234567890123456>';
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('  ✅ ' + name); };

console.log('\nNhận diện tin legit:');
t('nhận mọi cách viết "+1 legit" của khách', () => {
    const yes = [
        `+1 legit ${S} mfa`, `+1legit ${S}`, `legit +1 ${S}`, `legit+1 ${S}`, `LEGIT +1 ${S}`, `+1 Legit ${S}`,
        `+ 1 legit ${S}`, `＋1 legit ${S}`, `+1  legit  ${S}`, `**+1 legit** ${S}`, `\`+1 legit ${S}\``, `||+1 legit|| ${S}`,
        `+1 vouch ${S}`, `+1 vouches ${S}`, `vouch +1 ${S}`, `+1 lgit ${S}`, `+1 legitt ${S}`, `+1 leggit ${S}`,
        `Cảm ơn shop nhiều, +1 legit ${S} acc ngon`, `${S} +1 legit`, `+1 legit\n${S}`, `shop uy tín, legit +1`,
        `+1 𝙇𝙀𝙂𝙄𝙏 ${S}`, `+1 ｌｅｇｉｔ ${S}`, `1+ legit ${S}`, `+1\u200B legit ${S}`, `+1, legit ${S}`
    ];
    for (const m of yes) assert.ok(isLegitMessage(m), 'phải nhận: ' + JSON.stringify(m));
});
t('không nhận tin chat thường / thiếu +1 / thiếu chữ legit', () => {
    const no = ['chào mọi người', 'shop này legit không?', '+1', 'legit', '+10 legit', 'vouch nhé', 'legit 10/10',
        '+1 legitimate', '+1 illegitimate', S, '', '   ', 'cho mình hỏi giá +1 acc'];
    for (const m of no) assert.ok(!isLegitMessage(m), 'không được nhận: ' + JSON.stringify(m));
});
t('ID trong @mention không bị nhận nhầm thành "+1"', () => {
    assert.ok(!isLegitMessage('<@+1123456789012345> legit'));
});
t('requireMention=true: bắt buộc có tag người bán', () => {
    assert.ok(!isLegitMessage('+1 legit mfa', { requireMention: true }));
    assert.ok(isLegitMessage(`legit +1 ${S}`, { requireMention: true }));
});
t('mặc định không bắt buộc tag, tên kênh là 𝙑𝙤𝙪𝙘𝙝𝙚𝙨-<số>', () => {
    assert.strictEqual(C.LEGIT_REQUIRE_MENTION, false);
    assert.ok(C.LEGIT_CHANNEL_PREFIX.includes('𝙑𝙤𝙪𝙘𝙝𝙚𝙨-'));
});
console.log(`\n${pass}/5 kiểm thử nhận diện legit đạt`);
