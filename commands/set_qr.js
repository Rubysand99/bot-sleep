const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { saveStaffQR } = require('../utils/db');
const { isOwnerId } = require('../utils/permissions');
const { resolveBankCode } = require('../utils/vietqr');
const { submitQrRequest } = require('../utils/qrRequests');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set_qr')
        .setDescription('Cài thông tin ngân hàng tạo VietQR (người thường cần Owner xác nhận)')
        .addStringOption(option =>
            option.setName('bank_name')
                .setDescription('Tên ngân hàng (vd: MB, VCB, TECHCOMBANK, VPBANK, ACB, ICB...)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('account_number')
                .setDescription('Số tài khoản ngân hàng')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('bank_type')
                .setDescription('Tên chủ tài khoản hoặc loại tài khoản (vd: NGUYEN VAN A)')
                .setRequired(true)),

    async execute(interaction) {
        const bankName = resolveBankCode(interaction.options.getString('bank_name'));
        const accountNumber = interaction.options.getString('account_number').trim().replace(/[\s.\-]/g, '');
        const bankType = interaction.options.getString('bank_type').trim().toUpperCase();

        if (!/^\d{6,20}$/.test(accountNumber)) {
            return await interaction.reply({ content: '❌ Số tài khoản không hợp lệ (chỉ gồm 6-20 chữ số).', flags: MessageFlags.Ephemeral });
        }

        // Owner tự cài thì có hiệu lực ngay (chính Owner là người xác nhận)
        if (isOwnerId(interaction.user.id, interaction.guild)) {
            await saveStaffQR(interaction.user.id, { bankName, accountNumber, bankType });
            return await interaction.reply({
                content: `✅ **Đã cập nhật thông tin VietQR của bạn thành công!**\n` +
                         `🏦 **Ngân hàng:** ${bankName}\n💳 **Số tài khoản:** ${accountNumber}\n👤 **Chủ tài khoản:** ${bankType}\n` +
                         `*Khi khách bấm mua đơn hàng do bạn đăng, bot sẽ tự động tạo mã VietQR theo thông tin này!*`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Người thường: gửi Owner xác nhận, chưa lưu cho tới khi Owner bấm xác nhận
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const res = await submitQrRequest({ client: interaction.client, guild: interaction.guild, userId: interaction.user.id, bankName, accountNumber, bankType });
        const info = `🏦 **Ngân hàng:** ${bankName}\n💳 **Số tài khoản:** ${accountNumber}\n👤 **Chủ tài khoản:** ${bankType}`;
        if (!res.delivered) {
            return await interaction.editReply({
                content: `⚠️ Bot đã ghi nhận yêu cầu nhưng **chưa gửi được cho Owner nào** (Owner đang tắt tin nhắn riêng). Hãy nhờ Owner bật DM rồi gửi lại \`/set_qr\`.\n\n${info}`
            });
        }
        await interaction.editReply({
            content: `⏳ **Đã gửi yêu cầu cho Owner xác nhận.**\n${info}\n\n` +
                     `Thông tin chỉ có hiệu lực sau khi Owner bấm xác nhận. Quá 5 phút chưa ai xác nhận, bot sẽ chuyển cho Owner khác. Bạn sẽ nhận DM khi có kết quả.`
        });
    }
};
