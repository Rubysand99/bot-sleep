const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const cardGif = require('../utils/cardGif');
const { checkStaffOrOwner } = require('../utils/permissions');
const { parseAmount } = require('../utils/money');

// /test_stock: tạo thử ảnh stock (GIF) để xem trước, KHÔNG đăng acc, không lưu gì
module.exports = {
    data: new SlashCommandBuilder()
        .setName('test_stock')
        .setDescription('Tạo thử ảnh stock để xem trước (không đăng acc)')
        .addStringOption(o => o.setName('username').setDescription('Tên Minecraft (mặc định: Technoblade)').setRequired(false))
        .addStringOption(o => o.setName('price').setDescription('Giá, vd 150k (mặc định 150k)').setRequired(false))
        .addStringOption(o => o.setName('rank').setDescription('Rank (mặc định NON)').setRequired(false))
        .addStringOption(o => o.setName('capes').setDescription('Cape, cách nhau dấu phẩy (vd: Migrator, Minecon 2016)').setRequired(false)),

    async execute(interaction) {
        if (!checkStaffOrOwner(interaction.member)) {
            return await interaction.reply({ content: '❌ Lệnh này chỉ dành cho Staff hoặc Owner!', allowedMentions: { parse: [] } });
        }
        await interaction.deferReply();
        const get = (k, d) => (interaction.options.getString(k) || '').trim() || d;
        try {
            const user = interaction.client.user;
            const card = await cardGif.renderStockCard({
                username: get('username', 'Technoblade'),
                price: parseAmount(get('price', '150k')),
                rank: get('rank', 'NON'),
                capes: get('capes', ''),
                botName: user?.displayName || user?.username || 'BOT',
                botAvatarUrl: user?.displayAvatarURL?.({ extension: 'png', size: 128 }) || null
            });
            await interaction.editReply({
                content: `🖼️ Ảnh stock thử (${(card.buffer.length / 1024 / 1024).toFixed(1)} MB, \`${card.name}\`)`,
                files: [new AttachmentBuilder(card.buffer, { name: card.name })]
            });
        } catch (err) {
            console.error('[LỖI TEST STOCK]:', err);
            await interaction.editReply({ content: `❌ Không tạo được ảnh: ${err.message}` }).catch(() => null);
        }
    }
};
