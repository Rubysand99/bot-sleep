const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const C = require('./constants');

// Emoji custom trên NÚT chỉ hợp lệ khi bot đang ở server chứa emoji đó (và emoji chưa bị xóa).
// Nếu emoji không hợp lệ, Discord từ chối cả tin nhắn (lỗi 50035 COMPONENT_INVALID_EMOJI) và /stock không đăng được card.
// index.js gắn hàm kiểm tra (dựa trên client.emojis.cache) sau khi bot sẵn sàng; emoji lỗi thì tự đổi sang emoji thường.
const FALLBACK_BUTTON_EMOJI = '🟢';
let emojiChecker = null;
let warned = false;
const setEmojiChecker = (fn) => { emojiChecker = typeof fn === 'function' ? fn : null; warned = false; };

function buttonEmoji() {
    const configured = C.EMOJI_ONLINE;
    const m = /^<a?:[^:>]+:(\d+)>$/.exec(String(configured || '').trim());
    if (!m) return configured || FALLBACK_BUTTON_EMOJI;           // emoji thường (unicode) hoặc rỗng
    if (!emojiChecker) return configured;                          // chưa có thông tin từ bot: giữ nguyên
    let ok = false;
    try { ok = Boolean(emojiChecker(m[1])); } catch { ok = false; }
    if (ok) return configured;
    if (!warned) {
        warned = true;
        try { require('./logger').log.warn('EMOJI', 'EMOJI_ONLINE không hợp lệ hoặc bot không thấy emoji này, nút BUY dùng tạm emoji thường', { emoji: configured, thay_bang: FALLBACK_BUTTON_EMOJI, goiy: 'Đặt biến EMOJI_ONLINE = emoji có trong server bot đang ở, hoặc emoji thường như 🟢' }); } catch { /* bỏ qua */ }
    }
    return FALLBACK_BUTTON_EMOJI;
}

// Hàng nút dưới card bán: available (BUY), pending (đang giao dịch), sold (đã bán)
function buildCardRow(state, username) {
    const lower = String(username).toLowerCase();
    const guide = (emoji) => new ButtonBuilder()
        .setCustomId('guide_how_to_buy')
        .setLabel('      Cách mua      ')
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Secondary);

    if (state === 'pending') {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`pending_acc_${lower}`)
                .setLabel('    Đang Giao Dịch    ')
                .setEmoji('⏳')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            guide('ℹ️')
        );
    }
    if (state === 'sold') {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sold_acc_${lower}`)
                .setLabel('         SOLD         ')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            guide('ℹ️')
        );
    }
    const emoji = buttonEmoji();
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`buy_acc_${lower}`)
            .setLabel('         BUY         ')
            .setEmoji(emoji)
            .setStyle(ButtonStyle.Success),
        guide(emoji)
    );
}

module.exports = { buildCardRow, setEmojiChecker, buttonEmoji };
