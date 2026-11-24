// Báo lỗi khi giao tài khoản / hoàn tất đơn: đăng cảnh báo trong ticket (gọi staff) + nhắn riêng Owner và người bán.
// Không bao giờ ném lỗi và không bao giờ đưa thông tin đăng nhập vào nội dung báo.
const { EmbedBuilder } = require('discord.js');
const { cfg } = require('./runtime');
const { log, errInfo, hint } = require('./logger');

const DM_CLOSED = 50007;   // Cannot send messages to this user

function isDmClosed(err) { return err?.code === DM_CLOSED; }

// Lý do dễ hiểu cho staff
function reasonText(err) {
    if (!err) return '';
    if (isDmClosed(err)) return 'Buyer đang tắt tin nhắn riêng (DM) từ thành viên máy chủ.';
    if (err.code === 10013) return 'Không tìm thấy tài khoản Discord của buyer.';
    return [hint(err), err.message].filter(Boolean).join(' · ').slice(0, 400);
}

/**
 * @param {object} o
 * @param {object} o.client
 * @param {object} [o.guild]
 * @param {object} [o.channel]   kênh ticket (có thì đăng cảnh báo vào đó, trừ khi quiet)
 * @param {object} [o.ticket]    để biết buyer / seller / username
 * @param {string} o.stage       bước bị lỗi, viết cho người đọc
 * @param {Error}  [o.err]
 * @param {string} [o.next]      việc cần làm tiếp
 * @param {boolean} [o.quiet]    true = chỉ nhắn riêng Owner / người bán, không đăng trong ticket
 */
async function reportDeliveryProblem({ client, guild, channel, ticket, stage, err, next, quiet = false }) {
    try {
        const username = ticket?.username || 'N/A';
        const reason = reasonText(err);
        log.error('GIAO_ACC', stage, { ticket: channel?.id, username, buyerId: ticket?.buyerId, ...(err ? errInfo(err) : {}) });

        const lines = [
            `**Bước lỗi:** ${stage}`,
            reason ? `**Chi tiết:** ${reason}` : '',
            `**Tài khoản:** \`${username}\``,
            ticket?.buyerId ? `**Buyer:** <@${ticket.buyerId}>` : '',
            channel?.id ? `**Ticket:** <#${channel.id}>` : '',
            next ? `\n➡️ ${next}` : ''
        ].filter(Boolean).join('\n');
        const embed = new EmbedBuilder().setTitle('⚠️ LỖI KHI XỬ LÝ ĐƠN').setColor('#FF3B30').setDescription(lines).setTimestamp();

        if (channel && !quiet) {
            const staffRole = cfg('STAFF_ROLE_ID', guild);
            await channel.send({
                content: /^\d{17,20}$/.test(staffRole || '') ? `<@&${staffRole}>` : undefined,
                embeds: [embed]
            }).catch(() => null);
        }
        const ids = new Set([process.env.OWNER_ID, ticket?.sellerId].filter(Boolean));
        for (const id of ids) {
            const user = await client.users.fetch(id).catch(() => null);
            await user?.send({ embeds: [embed] }).catch(() => null);
        }
    } catch (e) {
        console.error('[LỖI KHI BÁO LỖI GIAO ACC]:', e.message);
    }
}

module.exports = { reportDeliveryProblem, isDmClosed, reasonText };
