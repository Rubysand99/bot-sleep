// Sau mỗi lần bot được cập nhật / sửa lỗi (version tự tăng khi code đổi, xem utils/version.js) bot gửi 1 embed vào kênh thông báo:
// phiên bản hiện tại, phiên bản trước và nội dung cập nhật lấy từ CHANGELOG.md (mục mới nhất ở trên cùng).
//  - Mỗi bot nhớ riêng "đã thông báo tới version nào / mục changelog nào" trong MongoDB nên restart lại cùng bản thì KHÔNG gửi lại.
//  - Gửi lỗi (bot không thấy kênh...) thì không đánh dấu đã gửi, lần khởi động sau thử lại.
//  - UPDATE_CHANNEL_ID: kênh nhận thông báo; UPDATE_NOTICE=off: tắt.
const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const C = require('./constants');
const db = require('./db');
const profile = require('./profile');
const { log } = require('./logger');

const ROOT = path.join(__dirname, '..');
const MAX_ENTRIES = 5;

// CHANGELOG.md: mỗi bản là 1 mục "## Tiêu đề" (mới nhất ở trên cùng), bên dưới là các dòng "- nội dung"
function parseChangelog(text) {
    const entries = [];
    let cur = null;
    for (const raw of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
        const m = raw.match(/^##\s+(.+?)\s*$/);
        if (m) { cur = { title: m[1], lines: [] }; entries.push(cur); continue; }
        if (cur && raw.trim()) cur.lines.push(raw.trimEnd());
    }
    return entries;
}

function readChangelog(root = ROOT) {
    try { return parseChangelog(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')); } catch { return []; }
}

// Các mục chưa thông báo: những mục nằm phía trên mục đã thông báo gần nhất (chưa từng thông báo: chỉ lấy mục mới nhất)
function pendingEntries(entries, lastTitle) {
    if (!entries.length) return [];
    const idx = lastTitle ? entries.findIndex(e => e.title === lastTitle) : -1;
    const fresh = idx === -1 ? entries.slice(0, 1) : entries.slice(0, idx);
    return fresh.slice(0, MAX_ENTRIES);
}

function buildUpdateEmbed({ botName, brand, version, previousVersion, entries, avatarUrl, unix = Math.floor(Date.now() / 1000) }) {
    let body = entries.length
        ? entries.map(e => `**${e.title}**\n${e.lines.join('\n')}`).join('\n\n')
        : 'Cập nhật và sửa lỗi nhỏ để bot chạy ổn định hơn.';
    if (body.length > 3800) body = body.slice(0, 3790).replace(/\s+\S*$/, '') + '\n…';
    const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle(`🚀 ${botName} vừa cập nhật lên phiên bản v${version}`)
        .setDescription(body)
        .addFields(
            { name: '📦 Phiên bản hiện tại', value: `\`v${version}\``, inline: true },
            { name: '⏮️ Phiên bản trước', value: previousVersion ? `\`v${previousVersion}\`` : '*(chưa có)*', inline: true },
            { name: '🕒 Thời gian', value: `<t:${unix}:F>`, inline: true }
        )
        .setFooter({ text: `${brand} • Bản cập nhật mới` })
        .setTimestamp();
    if (avatarUrl) embed.setThumbnail(avatarUrl);
    return embed;
}

// info: kết quả của syncBotVersion ({ version, tenths, bumped }); trả về true nếu đã gửi
async function announceUpdate(client, info, root = ROOT) {
    if (!info || String(process.env.UPDATE_NOTICE || '').toLowerCase() === 'off') return false;
    // Hiện chỉ bot Zin Yeah (BOT_PROFILE=cartone) báo cập nhật; bot Drew chưa dùng nên không gửi. UPDATE_NOTICE_DREW=on để bật lại cho Drew.
    if (profile.current().id === 'drew' && String(process.env.UPDATE_NOTICE_DREW || '').toLowerCase() !== 'on') return false;
    const channelId = String(C.UPDATE_CHANNEL_ID || '').trim();
    if (!channelId) return false;
    const botId = client.user?.id || 'bot';
    const state = await db.getUpdateNoticeState(botId);
    if (state?.tenths === info.tenths) return false;   // bản này đã thông báo rồi (restart lại cùng code)

    const entries = readChangelog(root);
    const fresh = pendingEntries(entries, state?.lastTitle);
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.send) {
        log.warn('UPDATE', 'Không thấy kênh thông báo cập nhật (bot chưa ở server đó / thiếu quyền), sẽ thử lại lần khởi động sau', { kenh: channelId });
        return false;
    }
    const embed = buildUpdateEmbed({
        botName: client.user?.displayName || client.user?.username || 'Bot',
        brand: profile.brand(),
        version: info.version,
        previousVersion: state?.version || null,
        entries: fresh,
        avatarUrl: client.user?.displayAvatarURL?.({ extension: 'png', size: 128 }) || null
    });
    try {
        await channel.send({ embeds: [embed] });
    } catch (err) {
        log.warn('UPDATE', 'Gửi thông báo cập nhật thất bại, sẽ thử lại lần khởi động sau', { kenh: channelId, loi: err.message });
        return false;
    }
    await db.saveUpdateNoticeState(botId, { tenths: info.tenths, version: info.version, lastTitle: entries[0]?.title || state?.lastTitle || null });
    log.info('UPDATE', 'Đã gửi thông báo cập nhật', { version: info.version, truoc: state?.version || null });
    return true;
}

module.exports = { parseChangelog, readChangelog, pendingEntries, buildUpdateEmbed, announceUpdate };
