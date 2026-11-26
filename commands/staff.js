const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isOwnerId } = require('../utils/permissions');
const { cfg, getExtraStaff, getExtraOwners } = require('../utils/runtime');
const { addStaffUser, removeStaffUser, setConfig } = require('../utils/config');

const ROLE_LABEL = { OWNER_ROLE_ID: 'Owner', STAFF_ROLE_ID: 'Staff', SELLER_ROLE_ID: 'Seller' };
const roleText = (id) => (id ? `<@&${id}>` : '*(chưa đặt)*');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff')
        .setDescription('Owner: quản lý danh sách Staff')
        .addSubcommand(sub => sub.setName('add').setDescription('Thêm một người làm Staff')
            .addUserOption(o => o.setName('user').setDescription('Người cần thêm').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Bỏ quyền Staff của một người')
            .addUserOption(o => o.setName('user').setDescription('Người cần bỏ').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('Xem danh sách Staff / Owner'))
        .addSubcommand(sub => sub.setName('role').setDescription('Đặt role cho Owner / Staff / Seller: ai có role này bot tự nhận quyền tương ứng')
            .addRoleOption(o => o.setName('role').setDescription('Role cần đặt').setRequired(true))
            .addStringOption(o => o.setName('loai').setDescription('Role này là của ai (mặc định: Staff)')
                .addChoices({ name: 'Owner', value: 'OWNER_ROLE_ID' }, { name: 'Staff', value: 'STAFF_ROLE_ID' }, { name: 'Seller', value: 'SELLER_ROLE_ID' }))),

    async execute(interaction) {
        if (!interaction.guildId) {
            return await interaction.reply({ content: '❌ Staff được quản lý riêng từng server, hãy dùng lệnh này trong server cần cấu hình.', allowedMentions: { parse: [] } });
        }
        if (!isOwnerId(interaction.user.id, interaction.guild)) {
            return await interaction.reply({ content: '❌ Lệnh này chỉ dành riêng cho Owner!', allowedMentions: { parse: [] } });
        }
        const sub = interaction.options.getSubcommand();
        const reply = (content) => interaction.reply({ content, allowedMentions: { parse: [] } });

        if (sub === 'add') {
            const user = interaction.options.getUser('user');
            if (user.bot) return await reply('❌ Không thể thêm bot làm Staff!');
            if (isOwnerId(user.id, interaction.guild)) return await reply('ℹ️ Người này đã là Owner.');
            const added = await addStaffUser(user.id, interaction.guildId);
            return await reply(added
                ? `✅ Đã thêm <@${user.id}> làm Staff. (Ticket mới sẽ tự cấp quyền xem cho người này.)`
                : `ℹ️ <@${user.id}> đã là Staff từ trước.`);
        }

        if (sub === 'remove') {
            const user = interaction.options.getUser('user');
            const removed = await removeStaffUser(user.id, interaction.guildId);
            return await reply(removed
                ? `✅ Đã bỏ quyền Staff của <@${user.id}>.`
                : `ℹ️ <@${user.id}> không nằm trong danh sách Staff thêm bằng lệnh (nếu có role Staff thì vẫn là Staff).`);
        }

        if (sub === 'role') {
            const role = interaction.options.getRole('role');
            const key = interaction.options.getString('loai') || 'STAFF_ROLE_ID';
            if (role.managed || role.id === interaction.guildId) return await reply('❌ Không dùng được role này (role của bot / tích hợp hoặc @everyone). Hãy chọn role thường.');
            await setConfig(key, role.id, interaction.guildId);
            return await reply(`✅ Đã đặt role ${ROLE_LABEL[key]} = <@&${role.id}>. Ai có role này là bot tự nhận quyền ${ROLE_LABEL[key]} ngay, không cần thêm từng người.`);
        }

        const users = getExtraStaff(interaction.guild);
        const embed = new EmbedBuilder()
            .setTitle('👥 Danh sách Staff / Owner')
            .setColor('#00FFAA')
            .setDescription(
                `**Owner:** <@${process.env.OWNER_ID}>${getExtraOwners(interaction.guild).map(id => ` <@${id}>`).join('')}\n` +
                `**Role Owner:** ${roleText(cfg('OWNER_ROLE_ID', interaction.guild))}\n` +
                `**Role Staff:** ${roleText(cfg('STAFF_ROLE_ID', interaction.guild))}\n` +
                `**Role Seller:** ${roleText(cfg('SELLER_ROLE_ID', interaction.guild))}\n` +
                `**Staff thêm bằng /staff add ở server này (${users.length}):**\n` +
                (users.length ? users.map(id => `• <@${id}>`).join('\n') : '*(trống)*'))
            .setFooter({ text: require('../utils/profile').current().name });
        await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    }
};
