const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { isOwnerId } = require('../utils/permissions');
const { setEmojiSlot } = require('../utils/config');
const emojis = require('../utils/emojis');

const slotChoices = emojis.SLOTS.map(s => ({ name: `${s.key} · ${s.label}`.slice(0, 100), value: s.key }));
const EPHEMERAL = MessageFlags.Ephemeral;
const SRC = { server: 'đặt bằng `/emoji set`', mac_dinh: 'mặc định của bot' };

// Mô tả trạng thái 1 vị trí emoji cho /emoji check
function describeSlot(client, slot, guildId) {
    const e = emojis.effective(slot.key, guildId);
    const p = emojis.parseEmoji(e.configured);
    const head = `**${slot.key}** · ${slot.label}`;
    const src = SRC[e.source];
    if (!p) return { ok: false, unicode: true, text: `${head}\n❌ Giá trị \`${e.configured}\` không phải emoji hợp lệ · nguồn: ${src}. Đang dùng tạm ${e.value}.` };
    if (!p.custom) return { ok: true, unicode: true, text: `${head}\n⚠️ ${p.raw} là **emoji thường** · nguồn: ${src}. Nên đặt emoji custom bằng \`/emoji set\`.` };
    const found = client.emojis.cache.get(p.id);
    if (found) return { ok: true, unicode: false, text: `${head}\n✅ ${p.raw} \`${p.name}\` · bot thấy, thuộc server **${found.guild?.name || '?'}** · nguồn: ${src}.` };
    if (e.usedBackup) return { ok: false, unicode: false, text: `${head}\n❌ \`${p.name}\` (${p.id}) · bot **không thấy** · nguồn: ${src}.\n↳ Đang dùng emoji custom dự phòng ${e.value}.` };
    return { ok: false, unicode: true, text: `${head}\n❌ \`${p.name}\` (${p.id}) · bot **không thấy** (chưa ở server chứa emoji hoặc emoji đã bị xóa) · nguồn: ${src}.\n↳ **Đang dùng tạm ${e.value}** (emoji thường).` };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('Owner: kiểm tra và đặt các emoji bot dùng (mỗi server một cấu hình riêng)')
        .addSubcommand(sub => sub.setName('check').setDescription('Kiểm tra tất cả emoji bot cần: bot có thấy không, đang dùng emoji nào'))
        .addSubcommand(sub => sub.setName('set').setDescription('Đặt emoji cho một vị trí (ưu tiên emoji custom) trong server này')
            .addStringOption(o => o.setName('vitri').setDescription('Vị trí cần đặt emoji').setRequired(true).addChoices(...slotChoices))
            .addStringOption(o => o.setName('emoji').setDescription('Chọn emoji từ bảng emoji, hoặc gõ TÊN emoji của server, hoặc dán mã <:tên:id>').setRequired(true)))
        .addSubcommand(sub => sub.setName('reset').setDescription('Đưa một vị trí (hoặc tất cả) về emoji mặc định')
            .addStringOption(o => o.setName('vitri').setDescription('Vị trí cần đặt lại').setRequired(true)
                .addChoices(...slotChoices, { name: 'all · Tất cả các vị trí', value: 'all' })))
        .addSubcommand(sub => sub.setName('list').setDescription('Xem các emoji custom của server này mà bot dùng được')),

    async execute(interaction) {
        if (!isOwnerId(interaction.user.id, interaction.guild)) {
            return await interaction.reply({ content: '❌ Lệnh này chỉ dành riêng cho Owner!', flags: EPHEMERAL });
        }
        if (!interaction.guildId) {
            return await interaction.reply({ content: '❌ Emoji được cấu hình riêng từng server, hãy dùng lệnh này trong server.', flags: EPHEMERAL });
        }
        const sub = interaction.options.getSubcommand();
        const gid = interaction.guildId;

        if (sub === 'check') {
            const rows = emojis.SLOTS.map(s => describeSlot(interaction.client, s, gid));
            const bad = rows.filter(r => !r.ok).length;
            const plain = rows.filter(r => r.unicode).length;
            const me = interaction.guild?.members?.me;
            const canExternal = me?.permissions?.has(PermissionFlagsBits.UseExternalEmojis);
            const embed = new EmbedBuilder()
                .setTitle('🔎 Kiểm tra emoji của bot')
                .setColor(bad ? 0xed4245 : plain ? 0xfee75c : 0x57f287)
                .setDescription(rows.map(r => r.text).join('\n\n').slice(0, 4000))
                .addFields({
                    name: 'Tổng kết',
                    value: [
                        bad ? `❌ ${bad}/${rows.length} vị trí lỗi (bot không thấy emoji), đang dùng tạm emoji thường.` : `✅ Mọi emoji custom đều dùng được.`,
                        plain && !bad ? `⚠️ ${plain}/${rows.length} vị trí đang dùng emoji thường.` : '',
                        canExternal === false ? '❌ Role của bot thiếu quyền **Use External Emojis** (cần để dùng emoji của server khác).' : '',
                        'Đặt emoji: `/emoji set` · Xem emoji có sẵn: `/emoji list` · Về mặc định: `/emoji reset`'
                    ].filter(Boolean).join('\n')
                });
            return await interaction.reply({ embeds: [embed], flags: EPHEMERAL });
        }

        if (sub === 'list') {
            const list = [...(interaction.guild?.emojis?.cache?.values?.() || [])].sort((a, b) => String(a.name).localeCompare(String(b.name)));
            if (!list.length) {
                return await interaction.reply({ content: 'Server này chưa có emoji custom nào. Hãy up emoji vào server (Cài đặt server → Emoji) rồi dùng `/emoji set`.', flags: EPHEMERAL });
            }
            const shown = list.slice(0, 60);
            const body = shown.map(e => `${e} \`${e.name}\``).join('  ·  ');
            return await interaction.reply({
                content: `**Emoji custom của server (${list.length})**\n${body}${list.length > shown.length ? `\n…và ${list.length - shown.length} emoji khác.` : ''}\n\n` +
                    'Đặt bằng `/emoji set vitri:<vị trí> emoji:<tên emoji>`.',
                flags: EPHEMERAL, allowedMentions: { parse: [] }
            });
        }

        if (sub === 'set') {
            const slotKey = interaction.options.getString('vitri');
            const slot = emojis.slotOf(slotKey);
            const r = emojis.resolveInput(interaction.options.getString('emoji'), interaction.client, interaction.guild);
            if (!slot) return await interaction.reply({ content: '❌ Vị trí không hợp lệ.', flags: EPHEMERAL });
            if (!r.ok) return await interaction.reply({ content: `❌ ${r.error}`, flags: EPHEMERAL });
            await setEmojiSlot(gid, slotKey, r.value);
            const note = r.custom
                ? `Bot thấy emoji này${r.guildName ? ` (thuộc server **${r.guildName}**)` : ''}.`
                : '⚠️ Đây là emoji thường của Discord. Dùng emoji custom sẽ đẹp hơn: `/emoji list` để xem emoji có sẵn.';
            return await interaction.reply({
                content: `✅ Đã đặt **${slot.key}** (${slot.label}) = ${r.value} · chỉ áp dụng cho server **${interaction.guild?.name || gid}**.\n${note}` +
                    (slot.kind === 'button' ? '\nCard đã đăng sẽ đổi emoji khi card được cập nhật (đang giao dịch / đã bán); card mới dùng ngay.' : ''),
                flags: EPHEMERAL
            });
        }

        if (sub === 'reset') {
            const slotKey = interaction.options.getString('vitri');
            const keys = slotKey === 'all' ? emojis.SLOTS.map(s => s.key) : [slotKey];
            for (const k of keys) if (emojis.slotOf(k)) await setEmojiSlot(gid, k, null);
            return await interaction.reply({
                content: `✅ Đã đưa ${slotKey === 'all' ? '**tất cả** vị trí' : `**${slotKey}**`} về emoji mặc định cho server này.`,
                flags: EPHEMERAL
            });
        }
    }
};
