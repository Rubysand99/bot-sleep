const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const emojis = require('./emojis');

// Emoji custom trên NÚT chỉ hợp lệ khi bot đang ở server chứa emoji đó (và emoji chưa bị xóa); nếu không Discord từ chối
// cả tin nhắn (lỗi 50035 COMPONENT_INVALID_EMOJI). Emoji lấy theo cấu hình của server (/emoji set), hỏng thì mới dùng emoji thường.
const buttonEmoji = (guildId) => emojis.effective('online', guildId).value;

// Hàng nút dưới card bán: available (BUY), pending (đang giao dịch), sold (đã bán)
function buildCardRow(state, username, guildId = null) {
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
    const emoji = buttonEmoji(guildId);
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`buy_acc_${lower}`)
            .setLabel('         BUY         ')
            .setEmoji(emoji)
            .setStyle(ButtonStyle.Success),
        guide(emoji)
    );
}

module.exports = { buildCardRow, setEmojiChecker: emojis.setEmojiChecker, buttonEmoji };
