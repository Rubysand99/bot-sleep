// Khối Note nằm trong embed card ở kênh stock (không nằm trong bill). Kênh và emoji đặt bằng biến, mỗi server một khác.
//  Kênh:  BILL_KENH_DIEUKHOAN, BILL_KENH_DOITHONGTIN, BILL_KENH_2FA (hoặc KENH_2FA / `/config`), BILL_KENH_LUUY
//         (chưa đặt thì dùng kênh mặc định trong utils/constants.js > DEFAULT_CHANNELS, nếu kênh đó nằm trong server)
//  Emoji: BILL_EMOJI_NOTE, BILL_EMOJI_SETTINGS, BILL_EMOJI_KEY, BILL_EMOJI_WARNING (mặc định là emoji thường)
//  Khác:  BILL_NOTE (dòng ghi chú chung), BILL_FOOTER (dòng nhỏ cuối Note, mặc định không có)
const { cfg } = require('./runtime');

const fromEnvTrim = (name) => { const v = process.env[name]; return v && v.trim() ? v.trim() : ''; };
const noteEmoji = (name, def) => fromEnvTrim(`BILL_EMOJI_${name}`) || def;

function buildStockNote({ guild }) {
    const E = {
        note: noteEmoji('NOTE', '📝'), settings: noteEmoji('SETTINGS', '⚙️'),
        key: noteEmoji('KEY', '🔑'), warning: noteEmoji('WARNING', '⚠️')
    };
    const chId = (envName, ...alsoCfg) => cfg(envName, guild) || alsoCfg.map(n => cfg(n, guild)).find(Boolean) || '';
    const rows = [
        ['📜', 'Điều khoản', chId('BILL_KENH_DIEUKHOAN')],
        [E.settings, 'Cách đổi thông tin', chId('BILL_KENH_DOITHONGTIN')],
        [E.key, 'Nếu có 2fa', chId('BILL_KENH_2FA', 'KENH_2FA')],
        [E.warning, 'Lưu ý', chId('BILL_KENH_LUUY')]
    ];
    const lines = [];
    for (const [icon, label, id] of rows) if (id && /^\d{17,20}$/.test(id)) lines.push(`${icon} **${label}:** <#${id}>`);
    const extra = fromEnvTrim('BILL_NOTE');
    if (extra) lines.push('', extra);
    if (!lines.length) return '';
    const footer = fromEnvTrim('BILL_FOOTER');
    return [`--- ${E.note} Note ---`, ...lines, ...(footer ? [`-# ${footer}`] : [])].join('\n');
}

module.exports = { buildStockNote };
