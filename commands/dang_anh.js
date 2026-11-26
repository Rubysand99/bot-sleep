const {
    SlashCommandBuilder,
    AttachmentBuilder,
    EmbedBuilder
} = require('discord.js');
const crypto = require('crypto');
const db = require('../utils/db');
const emojis = require('../utils/emojis');
const { formatPriceDisplay } = require('../utils/money');
const { buildCardRow } = require('../utils/cardButtons');
const { checkStaffOrOwner } = require('../utils/permissions');
const cardRenderer = require('../utils/cardRenderer');
const { resolveStockTarget } = require('./stock');

// Đăng acc Liên Quân: chỉ cần 2 giá trị — ảnh acc + giá.
// Giống /stock: tạo kênh theo giá trong danh mục STOCK_ID, đăng embed (ảnh + giá) với 2 nút Buy / Cách mua. Không có Note.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('dang_anh')
        .setDescription('Đăng acc Liên Quân: gửi ảnh acc + giá, bot tạo kênh và nút mua')
        .addAttachmentOption(o => o.setName('image').setDescription('Ảnh acc Liên Quân').setRequired(true))
        .addStringOption(o => o.setName('price').setDescription('Giá bán (vd: 150k, 140000, 1.2M)').setRequired(true)),

    async execute(interaction) {
        if (!checkStaffOrOwner(interaction.member)) {
            return interaction.reply({
                content: '❌ Bạn không có quyền đăng bán tài khoản (Chỉ dành cho Staff hoặc Owner)!',
                allowedMentions: { parse: [] }
            });
        }

        const image = interaction.options.getAttachment('image');
        const price = (interaction.options.getString('price') || '').trim();

        if (!image || !String(image.contentType || '').startsWith('image/')) {
            return interaction.reply({ content: '❌ File đính kèm phải là ảnh (png/jpg/webp)!', allowedMentions: { parse: [] } });
        }
        if (!price) {
            return interaction.reply({ content: '❌ Thiếu giá bán!', allowedMentions: { parse: [] } });
        }

        await interaction.deferReply();

        try {
            // Tải lại ảnh để gắn trực tiếp vào embed (link đính kèm của slash command sẽ hết hạn)
            const buf = await cardRenderer.fetchBuffer(image.url);
            if (!buf) {
                return interaction.editReply({ content: '❌ Không tải được ảnh, hãy thử gửi lại!' });
            }
            const ext = /png/.test(image.contentType) ? 'png' : /webp/.test(image.contentType) ? 'webp' : 'jpg';
            const fileName = `lienquan.${ext}`;

            // Mỗi bài đăng là 1 acc riêng: mã tự sinh để nút Buy trỏ đúng acc
            const key = `lq${crypto.randomBytes(3).toString('hex')}`;
            const sellerId = interaction.user.id;

            const saved = await db.upsertAccount({
                username: key, price, rank: 'LQ', capes: '', sellerId, status: 'AVAILABLE', game: 'lienquan'
            });
            if (!saved) {
                return interaction.editReply({ content: '❌ Không lưu được acc, thử lại nhé!' });
            }

            const attachment = new AttachmentBuilder(buf, { name: fileName, description: 'Acc Liên Quân' });
            const embed = new EmbedBuilder()
                .setDescription(
                    `${emojis.text('info', interaction.guildId)} **Seller:** <@${sellerId}>\n` +
                    `💰 **Giá:** ${formatPriceDisplay(price)}`
                )
                .setImage(`attachment://${fileName}`)
                .setColor('#2b2d31');
            const row = buildCardRow('available', key, interaction.guildId);

            const { targetChannel, isDifferentChannel } = await resolveStockTarget(
                interaction, `✅・${formatPriceDisplay(price)}・lien-quan`
            );

            let msg;
            if (isDifferentChannel) {
                msg = await targetChannel.send({ embeds: [embed], files: [attachment], components: [row] });
                await interaction.editReply({ content: `✅ **Đã đăng acc Liên Quân!** Xem tại: <#${targetChannel.id}>` });
            } else {
                msg = await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
            }

            await db.updateAccount(key, { cardMessageId: msg.id, cardChannelId: msg.channelId });

            await interaction.followUp({
                content: `ℹ️ Mã acc: \`${key}\`. Dùng \`/add_acc\` với mã này để nạp thông tin đăng nhập, nếu không khi khách mua bot sẽ không tự gửi DM được.`,
                allowedMentions: { parse: [] }
            }).catch(() => null);
        } catch (err) {
            console.error('[LỖI DANG_ANH]:', err);
            await interaction.editReply({ content: `❌ Đã xảy ra lỗi: ${err.message}` }).catch(() => null);
        }
    }
};
