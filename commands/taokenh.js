const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { checkStaffOrOwner } = require('../utils/permissions');
const { createTextChannel } = require('../utils/channelManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('taokenh')
        .setDescription('Tạo kênh chat mới (Staff/Owner)')
        .addStringOption(opt =>
            opt.setName('ten')
                .setDescription('Tên kênh cần tạo')
                .setRequired(true)
                .setMaxLength(100))
        .addChannelOption(opt =>
            opt.setName('danhmuc')
                .setDescription('Chọn danh mục chứa kênh (bỏ trống = cùng danh mục với kênh bạn đang gõ lệnh)')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(false)),

    async execute(interaction) {
        if (!checkStaffOrOwner(interaction.member)) {
            return await interaction.reply({ content: '❌ Lệnh này chỉ dành cho Staff hoặc Owner!', allowedMentions: { parse: [] } });
        }

        const category = interaction.options.getChannel('danhmuc');
        const parentId = category?.id || interaction.channel?.parentId || null;
        const result = await createTextChannel(interaction.guild, interaction.options.getString('ten'), { parentId });

        if (!result.ok) return await interaction.reply({ content: result.msg, allowedMentions: { parse: [] } });
        await interaction.reply({ content: `✅ Đã tạo kênh <#${result.channel.id}> (\`${result.channel.id}\`).`, allowedMentions: { parse: [] } });
    }
};
