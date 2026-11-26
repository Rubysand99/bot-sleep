const {
    SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder
} = require('discord.js');
const db = require('../utils/db');
const payos = require('../utils/payos');
const { isOwnerId, checkStaffOrOwner } = require('../utils/permissions');

// Kênh payOS riêng cho từng seller: bot tự kiểm tra khách đã chuyển khoản và tự giao acc.
// Khóa được nhập bằng form (modal) nên KHÔNG hiện công khai trong kênh chat.
const MODAL_PREFIX = 'modal_payos_';

const PAYOS_HELP =
    'Lấy 3 khóa trong **my.payos.vn** → chọn kênh thanh toán (đã liên kết tài khoản ngân hàng của bạn) → *Cài đặt*: ' +
    '**Client ID**, **API Key**, **Checksum Key**.';

function resolveTarget(interaction) {
    const picked = interaction.options.getUser('seller');
    return picked || interaction.user;
}

function canManage(interaction, targetId) {
    if (targetId === interaction.user.id) return checkStaffOrOwner(interaction.member);
    return isOwnerId(interaction.user.id, interaction.guild);   // chỉ Owner thao tác hộ người khác
}

const deny = (interaction) => interaction.reply({
    content: '❌ Bạn chỉ quản lý được kênh payOS của chính mình (Staff/Owner). Chỉ Owner mới thao tác hộ người khác.',
    allowedMentions: { parse: [] }
});

function buildModal(targetId) {
    const input = (id, label, ph) => new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(ph).setStyle(TextInputStyle.Short).setRequired(true).setMinLength(8).setMaxLength(100)
    );
    return new ModalBuilder()
        .setCustomId(`${MODAL_PREFIX}${targetId}`)
        .setTitle('Kênh payOS của seller')
        .addComponents(
            input('client_id', 'Client ID', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'),
            input('api_key', 'API Key', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'),
            input('checksum_key', 'Checksum Key', 'chuỗi 64 ký tự')
        );
}

// Xử lý form: lưu mã hóa rồi thử tạo+hủy link 2.000đ để báo khóa đúng/sai ngay
async function handleModal(interaction) {
    const targetId = interaction.customId.slice(MODAL_PREFIX.length);
    if (!canManage(interaction, targetId)) return deny(interaction);
    const creds = {
        clientId: interaction.fields.getTextInputValue('client_id').trim(),
        apiKey: interaction.fields.getTextInputValue('api_key').trim(),
        checksumKey: interaction.fields.getTextInputValue('checksum_key').trim()
    };
    if (Object.values(creds).some(v => !v || /\s/.test(v))) {
        return interaction.reply({ content: '❌ Khóa không được để trống hoặc có khoảng trắng.', allowedMentions: { parse: [] } });
    }
    await interaction.deferReply();
    try {
        await payos.testChannel(creds);
    } catch (err) {
        return interaction.editReply({ content: `❌ **Chưa lưu.** Khóa không dùng được: ${err.message}\nKiểm tra lại 3 khóa rồi chạy \`/payos set\` lần nữa.` });
    }
    await db.savePayosChannel(targetId, creds, interaction.user.id);
    return interaction.editReply({
        content: `✅ **Đã lưu kênh payOS cho <@${targetId}>** (khóa đúng, đã mã hóa).\n` +
                 `Từ giờ khách mua acc của người này sẽ nhận QR payOS, bot tự xác nhận khi nhận đủ tiền và tự giao acc.`
    });
}

module.exports = {
    MODAL_PREFIX, handleModal,
    data: new SlashCommandBuilder()
        .setName('payos')
        .setDescription('Kênh payOS: bot tự kiểm tra khách đã chuyển khoản và tự giao acc')
        .addSubcommand(s => s.setName('set').setDescription('Nhập khóa kênh payOS (mở form nhập)')
            .addUserOption(o => o.setName('seller').setDescription('Seller cần cài (chỉ Owner chọn người khác)')))
        .addSubcommand(s => s.setName('xem').setDescription('Xem seller đã cài payOS chưa (không hiện khóa)')
            .addUserOption(o => o.setName('seller').setDescription('Seller cần xem')))
        .addSubcommand(s => s.setName('kiem_tra').setDescription('Thử khóa payOS đã lưu (tạo rồi hủy link 2.000đ)')
            .addUserOption(o => o.setName('seller').setDescription('Seller cần thử')))
        .addSubcommand(s => s.setName('xoa').setDescription('Xóa kênh payOS (đơn sau quay lại VietQR + Confirm tay)')
            .addUserOption(o => o.setName('seller').setDescription('Seller cần xóa'))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const target = resolveTarget(interaction);
        if (!canManage(interaction, target.id)) return deny(interaction);

        if (sub === 'set') {
            // showModal phải là phản hồi đầu tiên, không được defer trước
            return interaction.showModal(buildModal(target.id));
        }
        if (sub === 'xem') {
            const has = await db.hasPayosChannel(target.id);
            return interaction.reply({
                content: has ? `✅ <@${target.id}> **đã cài** kênh payOS: đơn của người này tự động xác nhận.`
                             : `⚠️ <@${target.id}> **chưa cài** kênh payOS: đơn dùng VietQR + Confirm tay.\n${PAYOS_HELP}\nDùng \`/payos set\` để nhập khóa.`,
                allowedMentions: { parse: [] }
            });
        }
        if (sub === 'kiem_tra') {
            await interaction.deferReply();
            const creds = await db.getPayosChannel(target.id);
            if (!creds) return interaction.editReply({ content: `⚠️ <@${target.id}> chưa cài kênh payOS (\`/payos set\`).` });
            try { await payos.testChannel(creds); }
            catch (err) { return interaction.editReply({ content: `❌ Khóa payOS lỗi: ${err.message}` }); }
            return interaction.editReply({ content: `✅ Kênh payOS của <@${target.id}> hoạt động bình thường.` });
        }
        if (sub === 'xoa') {
            const ok = await db.deletePayosChannel(target.id);
            return interaction.reply({
                content: ok ? `🗑️ Đã xóa kênh payOS của <@${target.id}>. Đơn mới sẽ dùng VietQR + Confirm tay (đơn đang chờ vẫn được bot theo dõi).`
                            : `ℹ️ <@${target.id}> chưa có kênh payOS.`,
                allowedMentions: { parse: [] }
            });
        }
    }
};
