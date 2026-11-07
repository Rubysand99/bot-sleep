// Chuyển kênh đã bán sang danh mục Sold (dùng chung cho lệnh `sold` và nút Confirm của ticket).
// Trả về { ok, moved, problem?, err? } và KHÔNG ném lỗi, để người gọi tự log / báo cho staff.
const { ChannelType } = require('discord.js');

const MAX_CHANNELS_PER_CATEGORY = 50;   // giới hạn của Discord

async function moveToSoldCategory(channel, soldCatId, guildArg = null) {
    const guild = guildArg || channel?.guild;
    if (!channel || !guild) return { ok: false, moved: false, problem: 'Không xác định được server của kênh.' };
    if (!soldCatId) {
        return { ok: false, moved: false, problem: 'Chưa đặt **danh mục Sold**: dùng `/config set muc:Danh mục chứa kênh đã bán kenh:<danh mục>` hoặc `/set_kenhsold`.' };
    }

    const cat = await guild.channels.fetch(soldCatId).catch(() => null);
    if (!cat) {
        return { ok: false, moved: false, problem: `Danh mục Sold đang đặt (\`${soldCatId}\`) **không thuộc server này** hoặc đã bị xóa. Hãy chạy \`/config set\` ngay trong server này.` };
    }
    if (cat.type !== ChannelType.GuildCategory) {
        return { ok: false, moved: false, problem: `<#${soldCatId}> **không phải là danh mục (category)**, hãy chọn đúng danh mục chứa kênh đã bán.` };
    }
    if (channel.parentId === cat.id) return { ok: true, moved: false };

    // Kiểm tra trước để báo rõ lý do thay vì chờ Discord từ chối
    const count = [...guild.channels.cache.values()].filter(c => c?.parentId === cat.id).length;
    if (count >= MAX_CHANNELS_PER_CATEGORY) {
        return { ok: false, moved: false, problem: `Danh mục **${cat.name}** đã đầy (${count}/${MAX_CHANNELS_PER_CATEGORY} kênh), hãy tạo thêm danh mục Sold mới và đặt lại bằng \`/config set\`.` };
    }

    try {
        await channel.setParent(cat.id, { lockPermissions: false });
        return { ok: true, moved: true, category: cat };
    } catch (err) {
        const full = err?.code === 50035 || /maximum number of channels/i.test(err?.message || '');
        const problem =
            err?.code === 50013 ? `Bot thiếu quyền **Manage Channels** ở kênh này hoặc ở danh mục **${cat.name}**.`
            : full ? `Danh mục **${cat.name}** đã đầy (tối đa ${MAX_CHANNELS_PER_CATEGORY} kênh), hãy tạo thêm danh mục Sold mới và đặt lại bằng \`/config set\`.`
            : `Không chuyển được kênh sang **${cat.name}**: ${err?.message || 'lỗi không rõ'}`;
        return { ok: false, moved: false, problem, err, category: cat };
    }
}

module.exports = { moveToSoldCategory, MAX_CHANNELS_PER_CATEGORY };
