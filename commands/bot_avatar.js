const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isOwnerId } = require('../utils/permissions');
const profile = require('../utils/profile');
const { log, errInfo } = require('../utils/logger');

// Avatar / tên của bot là của CẢ tài khoản bot (không riêng từng server) và Discord giới hạn số lần đổi,
// nên đây là lệnh chạy tay, chỉ Owner dùng được, không tự chạy khi khởi động.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot_avatar')
        .setDescription('Owner: đổi avatar của bot thành avatar (icon) của server này')
        .addBooleanOption(o => o.setName('doi_ten')
            .setDescription('Đổi luôn tên bot thành tên thương hiệu (vd Zin Yeah Store), Discord giới hạn ~2 lần / giờ')
            .setRequired(false)),

    async execute(interaction) {
        if (!isOwnerId(interaction.user.id, interaction.guild)) {
            return await interaction.reply({ content: '❌ Lệnh này chỉ dành riêng cho Owner!', flags: MessageFlags.Ephemeral });
        }
        const guild = interaction.guild;
        if (!guild) return await interaction.reply({ content: '❌ Hãy dùng lệnh này trong server.', flags: MessageFlags.Ephemeral });

        // Ảnh tĩnh PNG: avatar động của bot cần Nitro nên dùng ảnh tĩnh cho chắc
        const iconUrl = guild.iconURL({ extension: 'png', size: 1024, forceStatic: true });
        if (!iconUrl) {
            return await interaction.reply({ content: '❌ Server này chưa có icon (avatar server), hãy đặt icon cho server trước.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const done = [];
        const problems = [];
        const bot = interaction.client.user;

        try {
            await bot.setAvatar(iconUrl);
            done.push(`🖼️ Đã đổi avatar bot thành icon của **${guild.name}**.`);
            log.info('BOT', 'Đổi avatar bot theo icon server', { guildId: guild.id, by: interaction.user.id });
        } catch (err) {
            log.warn('BOT', 'Không đổi được avatar bot', { guildId: guild.id, ...errInfo(err) });
            problems.push(`Không đổi được avatar: ${/too fast|rate/i.test(err?.message || '') ? 'Discord giới hạn tốc độ đổi avatar, thử lại sau ít phút.' : (err?.message || 'lỗi không rõ')}`);
        }

        if (interaction.options.getBoolean('doi_ten')) {
            const name = profile.brand();
            try {
                if (bot.username === name) done.push(`🏷️ Tên bot đã là **${name}** rồi.`);
                else {
                    await bot.setUsername(name);
                    done.push(`🏷️ Đã đổi tên bot thành **${name}**.`);
                    log.info('BOT', 'Đổi tên bot', { ten: name, by: interaction.user.id });
                }
            } catch (err) {
                log.warn('BOT', 'Không đổi được tên bot', { ten: name, ...errInfo(err) });
                problems.push(`Không đổi được tên bot: ${err?.message || 'lỗi không rõ'} (Discord chỉ cho đổi tên bot khoảng 2 lần / giờ).`);
            }
        }

        await interaction.editReply({
            content: [...done, ...problems.map(p => `⚠️ ${p}`)].join('\n') + '\n*Discord có thể mất ít phút để hiện avatar mới.*'
        });
    }
};
