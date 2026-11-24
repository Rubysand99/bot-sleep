// /set_qr của người thường: bot gửi embed xin Owner xác nhận (DM). Quá 5 phút chưa ai xác nhận thì gửi cho Owner kế tiếp;
// gửi hết các Owner rồi thì chỉ chờ. Chỉ khi có Owner bấm "Xác nhận" thì thông tin mới được lưu và dùng để tạo VietQR.
const crypto = require('crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./db');
const { getExtraOwners } = require('./runtime');
const { isValidSnowflake } = require('./permissions');

const STEP_MS = 5 * 60_000;      // chờ 5 phút rồi chuyển Owner kế tiếp
const WAIT_FOREVER = Number.MAX_SAFE_INTEGER;
const PREFIX = 'qrreq';          // customId: qrreq_ok_<guildId>_<id> | qrreq_no_<guildId>_<id>

// Thứ tự Owner: Owner gốc trước, rồi các Owner phụ của server này
function ownersFor(guild) {
    const list = [process.env.OWNER_ID, ...getExtraOwners(guild)].map(x => String(x || '').trim()).filter(isValidSnowflake);
    return [...new Set(list)];
}

const mask = (n) => (n.length > 4 ? `${'•'.repeat(n.length - 4)}${n.slice(-4)}` : n);

function requestEmbed(r, { guildName, step, total, state = 'pending', byId } = {}) {
    const color = state === 'approved' ? '#2ECC71' : state === 'pending' ? '#F1C40F' : '#95A5A6';
    const title = { pending: '🏦 YÊU CẦU CÀI THÔNG TIN NGÂN HÀNG', approved: '✅ ĐÃ XÁC NHẬN THÔNG TIN NGÂN HÀNG', rejected: '❌ ĐÃ TỪ CHỐI THÔNG TIN NGÂN HÀNG', superseded: '⌛ YÊU CẦU CŨ (đã bị thay bằng yêu cầu mới)' }[state];
    const lines = [
        `**Người yêu cầu:** <@${r.userId}> (\`${r.userId}\`)`,
        guildName ? `**Server:** ${guildName}` : '',
        `**Ngân hàng:** ${r.bankName}`,
        `**Số tài khoản:** \`${r.accountNumber}\``,
        `**Chủ tài khoản:** ${r.bankType}`
    ].filter(Boolean);
    if (state === 'pending') {
        lines.push('', 'Khi bạn xác nhận, khách mua acc do người này đăng sẽ nhận mã VietQR theo thông tin trên. **Chỉ xác nhận nếu đúng người và đúng tài khoản.**');
        if (total > 1) lines.push(`-# Owner ${step}/${total}. Quá 5 phút chưa ai xác nhận, yêu cầu sẽ chuyển cho Owner kế tiếp.`);
    } else if (byId) lines.push('', `Xử lý bởi <@${byId}>.`);
    return new EmbedBuilder().setTitle(title).setColor(color).setDescription(lines.join('\n')).setTimestamp();
}

const buttons = (guildId, id) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}_ok_${guildId}_${id}`).setLabel('Xác nhận').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`${PREFIX}_no_${guildId}_${id}`).setLabel('Từ chối').setStyle(ButtonStyle.Danger).setEmoji('❌')
);

// Cập nhật mọi tin đã gửi cho các Owner (bỏ nút, đổi màu). Lỗi từng tin bỏ qua.
async function refreshMessages(client, r, state, byId, guildName) {
    for (const m of r.msgs || []) {
        try {
            const ch = await client.channels.fetch(m.channelId);
            const msg = await ch.messages.fetch(m.messageId);
            await msg.edit({ embeds: [requestEmbed(r, { guildName, state, byId })], components: [] });
        } catch { /* tin đã bị xóa / không sửa được */ }
    }
}

// Gửi cho Owner kế tiếp của 1 yêu cầu. Owner nào không nhận được DM thì bỏ qua ngay, sang Owner sau.
async function sendNext(client, r, guildName) {
    let cur = r;
    for (;;) {
        const nextIdx = cur.sentIdx + 1;
        if (nextIdx >= cur.owners.length) return cur;             // hết Owner: chỉ chờ
        const last = nextIdx === cur.owners.length - 1;
        const claimed = await db.claimQrRequestStep(cur._id, cur.sentIdx, last ? WAIT_FOREVER : Date.now() + STEP_MS);
        if (!claimed) return null;                                // instance khác đã gửi / yêu cầu đã chốt
        cur = claimed;
        const ownerId = cur.owners[nextIdx];
        try {
            const user = await client.users.fetch(ownerId);
            const sent = await user.send({
                embeds: [requestEmbed(cur, { guildName, step: nextIdx + 1, total: cur.owners.length })],
                components: [buttons(cur.guildId, cur._id)]
            });
            cur.msgs = [...(cur.msgs || []), { ownerId, channelId: sent.channelId, messageId: sent.id }];
            await db.setQrRequestMessages(cur._id, cur.msgs);
            return cur;
        } catch (err) {
            // DM đóng / không tìm thấy Owner: bỏ qua, vòng lặp sang Owner kế tiếp ngay (hết Owner thì dừng ở đầu vòng)
            console.error(`[QR] Không gửi được yêu cầu cho Owner ${ownerId}:`, err.message);
        }
    }
}

// Tạo yêu cầu mới và gửi cho Owner đầu tiên. Yêu cầu cũ còn chờ của cùng người bị thay thế.
async function submitQrRequest({ client, guild, userId, bankName, accountNumber, bankType }) {
    for (const old of await db.getPendingQrRequestsByUser(userId)) {
        const done = await db.resolveQrRequest(old._id, 'superseded', null);
        if (done) await refreshMessages(client, done, 'superseded', null, guild?.name);
    }
    const owners = ownersFor(guild);
    const id = crypto.randomBytes(6).toString('hex');
    const r = await db.createQrRequest({ _id: id, guildId: String(guild.id), userId: String(userId), bankName, accountNumber, bankType, owners });
    const after = await sendNext(client, r, guild.name);
    return { id, owners: owners.length, delivered: Boolean(after && after.msgs?.length) };
}

// Chạy mỗi phút (trong ngữ cảnh 1 server): chuyển các yêu cầu quá 5 phút chưa xác nhận cho Owner kế tiếp
async function advanceDueQrRequests(client, guild) {
    for (const r of await db.getDueQrRequests(Date.now())) {
        try { await sendNext(client, r, guild?.name); } catch (err) { console.error('[QR] Lỗi chuyển yêu cầu:', err.message); }
    }
}

// Owner bấm nút. approve = true: lưu thông tin; false: từ chối. Trả về { ok, request?, reason? }
async function decideQrRequest({ client, guild, id, approve, byId }) {
    const r = await db.resolveQrRequest(id, approve ? 'approved' : 'rejected', byId);
    if (!r) return { ok: false, reason: 'done' };
    if (approve) await db.saveStaffQR(r.userId, { bankName: r.bankName, accountNumber: r.accountNumber, bankType: r.bankType });
    await refreshMessages(client, r, approve ? 'approved' : 'rejected', byId, guild?.name);
    try {
        const user = await client.users.fetch(r.userId);
        await user.send({
            content: approve
                ? `✅ Owner đã xác nhận thông tin ngân hàng của bạn (**${r.bankName}** · \`${r.accountNumber}\`). Khách mua acc do bạn đăng sẽ nhận VietQR theo thông tin này.`
                : `❌ Owner đã từ chối thông tin ngân hàng bạn vừa gửi (**${r.bankName}** · \`${r.accountNumber}\`). Hãy kiểm tra lại và gửi lại bằng \`/set_qr\`.`
        });
    } catch { /* người dùng tắt DM */ }
    return { ok: true, request: r };
}

module.exports = { submitQrRequest, advanceDueQrRequests, decideQrRequest, ownersFor, requestEmbed, mask, PREFIX, STEP_MS };
