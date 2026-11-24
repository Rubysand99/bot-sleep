const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { renderListing, formatPrice } = require('../utils/listingRenderer');
const { checkStaffOrOwner } = require('../utils/permissions');
const { parseAmount, formatVND } = require('../utils/money');
const db = require('../utils/db');

const EMOJI_RE = /<(?:a)?:[a-zA-Z0-9_]+:[0-9]+>/g;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dang_anh')
        .setDescription('Đăng ảnh tài khoản kèm giá (mẫu MFA: skin 2D, danh sách cape, giá)')
        .addStringOption(o => o.setName('username').setDescription('Tên tài khoản Minecraft').setRequired(true))
        .addStringOption(o => o.setName('price').setDescription('Giá bán (vd: 150k, 140000, 1.2M)').setRequired(true))
        .addStringOption(o => o.setName('capes').setDescription('Emoji capes (để trống = lấy từ kho nếu đã /add_acc)').setRequired(false)),

    async execute(interaction) {
        if (!checkStaffOrOwner(interaction.member)) {
            return await interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh này (Chỉ dành cho Owner hoặc Staff)!',
                flags: MessageFlags.Ephemeral
            });
        }
        await interaction.deferReply();

        try {
            const username = interaction.options.getString('username').trim();
            const price = interaction.options.getString('price').trim();
            let capes = (interaction.options.getString('capes') || '').trim();
            if (!capes) capes = String((await db.getAccount(username))?.capes || '').trim();
            capes = Array.from(new Set(capes.match(EMOJI_RE) || [])).join(' ');

            const image = await renderListing({ username, price, capes });
            const attachment = new AttachmentBuilder(image, { name: 'listing.png', description: `Minecraft MFA: ${username}` });

            const amount = parseAmount(price);
            const priceLine = amount ? `💰 **Giá:** ${formatPrice(price)} (${formatVND(amount)})` : `💰 **Giá:** ${price}`;
            await interaction.editReply({ content: priceLine, files: [attachment] });
        } catch (error) {
            console.error('[LỖI DANG_ANH]:', error);
            await interaction.editReply({ content: `❌ Không tạo được ảnh: ${error.message}` }).catch(() => null);
        }
    }
};
