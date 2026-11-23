// Phần thưởng sau khi ghi 1 đơn (nút Confirm hoặc .done / /done):
//  1. Tặng role DONE_ROLE_ID cho khách (đã có role thì bỏ qua, không làm gì).
//  2. Thả emoji vào tin legit mới nhất của khách trong kênh legit: 3 emoji legit + emoji tiền.
// Mọi lỗi đều được bắt và trả về dạng trạng thái, không bao giờ làm hỏng việc ghi doanh thu.
const C = require('./constants');
const db = require('./db');
const emojis = require('./emojis');
const { cfg, legitChannelFor } = require('./runtime');
const { isLegitMessage } = require('./legit');
const { log, errInfo, hint } = require('./logger');

const LEGIT_SCAN_LIMIT = 100;
const moneyEmoji = () => (C.LEGIT_MONEY_EMOJI && C.LEGIT_MONEY_EMOJI.toLowerCase() !== 'off' ? C.LEGIT_MONEY_EMOJI : null);

// -> { status: 'given' | 'had' | 'none' | 'failed', roleId?, why? }
async function giveDoneRole(guild, userId, reason = 'done đơn') {
    const roleId = cfg('DONE_ROLE_ID', guild);
    if (!guild || !roleId) return { status: 'none' };
    const ctx = { guildId: guild.id, userId, roleId };
    try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return { status: 'failed', roleId, why: 'khách không còn ở trong server' };
        if (member.roles.cache.has(roleId)) return { status: 'had', roleId };
        const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
        if (!role) return { status: 'failed', roleId, why: 'role đã đặt không còn tồn tại, hãy đặt lại bằng `/config role_done`' };
        await member.roles.add(role, `Tặng role sau khi ${reason}`);
        log.info('DONE', 'Đã tặng role khi done đơn', { ...ctx, role: role.name });
        return { status: 'given', roleId };
    } catch (err) {
        const why = hint(err) || err.message;
        log.error('DONE', 'Tặng role khi done THẤT BẠI', { ...ctx, ...errInfo(err), goiy: hint(err) || 'Role của bot phải nằm CAO HƠN role cần tặng và bot cần quyền Manage Roles' });
        return { status: 'failed', roleId, why };
    }
}

async function reactSafe(message, emoji) {
    try { await message.react(emoji); return true; } catch (err) {
        log.warn('DONE', 'Không thả được emoji vào tin legit', { msgId: message.id, emoji, ...errInfo(err), goiy: hint(err) });
        return false;
    }
}

// Thả emoji tin legit gần nhất của khách (nếu khách đã legit rồi). -> { status: 'reacted' | 'no-message' | 'no-channel' | 'failed' }
async function reactBuyerLegit(client, guild, userId) {
    if (!guild) return { status: 'no-channel' };
    try {
        const channelId = legitChannelFor(guild.id);
        const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;
        if (!channel || channel.guildId !== guild.id || !channel.messages) return { status: 'no-channel' };
        const msgs = await channel.messages.fetch({ limit: LEGIT_SCAN_LIMIT });
        const mine = [...msgs.values()]
            .filter(m => m.author?.id === String(userId) && isLegitMessage(m.content))
            .sort((a, b) => b.createdTimestamp - a.createdTimestamp)[0];
        if (!mine) return { status: 'no-message' };
        const list = [...emojis.legitConfigured(guild.id)];
        const money = moneyEmoji();
        if (money) list.push(money);
        let okN = 0;
        for (const e of list) { if (await reactSafe(mine, e)) okN++; }   // đã có reaction của bot rồi thì Discord coi như không đổi gì
        return { status: okN ? 'reacted' : 'failed', messageId: mine.id, channelId: channel.id };
    } catch (err) {
        log.warn('DONE', 'Không thả được emoji tin legit sau khi done', { guildId: guild.id, userId, ...errInfo(err), goiy: hint(err) });
        return { status: 'failed' };
    }
}

async function rewardAfterDone({ client, guild, userId, reason }) {
    if (!userId) return { role: { status: 'none' }, legit: { status: 'no-message' } };
    const role = await giveDoneRole(guild, userId, reason);
    const legit = await reactBuyerLegit(client, guild, userId);
    return { role, legit };
}

// Dòng ghi chú ngắn cho embed / tin nhắn (chỉ nói khi có việc đã làm hoặc có lỗi cần staff biết)
function rewardLines(r) {
    const lines = [];
    if (r?.role?.status === 'given') lines.push(`🎁 Đã tặng role <@&${r.role.roleId}> cho khách.`);
    else if (r?.role?.status === 'had') lines.push(`🎁 Khách đã có role <@&${r.role.roleId}> từ trước, không tặng thêm.`);
    else if (r?.role?.status === 'failed') lines.push(`⚠️ Không tặng được role <@&${r.role.roleId}>: ${r.role.why}`);
    if (r?.legit?.status === 'reacted') lines.push(`${moneyEmoji() || '💰'} Đã thả emoji vào tin legit của khách.`);
    return lines;
}

module.exports = { giveDoneRole, reactBuyerLegit, rewardAfterDone, rewardLines, moneyEmoji };
