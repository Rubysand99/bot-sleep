// Chuyển kênh đã bán sang danh mục Sold (dùng chung cho lệnh `sold` và nút Confirm của ticket).
// Trả về { ok, moved, problem?, err?, created? } và KHÔNG ném lỗi, để người gọi tự log / báo cho staff.
// Danh mục Sold đầy 50 kênh thì tự dùng / tạo danh mục "<tên> 1", "<tên> 2", ... (cùng quyền với danh mục gốc).
const { ChannelType } = require('discord.js');

const MAX_CHANNELS_PER_CATEGORY = 50;   // giới hạn của Discord

const isFullError = (err) => err?.code === 50035 || /maximum number of channels/i.test(err?.message || '');

// Mỗi server chỉ cho 1 lượt chọn / tạo danh mục tại một thời điểm (tránh Confirm cùng lúc tạo trùng danh mục)
const locks = new Map();
function withGuildLock(guildId, fn) {
    const prev = locks.get(guildId) || Promise.resolve();
    const run = prev.catch(() => null).then(fn);
    const tail = run.catch(() => null);
    locks.set(guildId, tail);
    tail.then(() => { if (locks.get(guildId) === tail) locks.delete(guildId); });
    return run;
}

const countChildren = (guild, catId) => [...guild.channels.cache.values()].filter(c => c?.parentId === catId).length;

// "Sold 3" -> { base: 'Sold', n: 3 } ; "Sold" -> { base: 'Sold', n: 0 }
function splitName(name) {
    const m = /^(.*?)\s+(\d+)$/.exec(String(name || '').trim());
    return m ? { base: m[1].trim(), n: parseInt(m[2], 10) } : { base: String(name || '').trim(), n: 0 };
}

// Tìm danh mục còn chỗ trong dãy Sold (gốc, base 1, base 2, ...). Không có thì tạo danh mục kế tiếp.
async function pickOrCreateOverflow(guild, cat, { skipFullCheck = false } = {}) {
    const { base } = splitName(cat.name);
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${escaped}\\s+(\\d+)$`, 'i');
    const family = [...guild.channels.cache.values()]
        .filter(c => c?.type === ChannelType.GuildCategory && (c.id === cat.id || re.test(String(c.name || '').trim())))
        .map(c => ({ c, n: c.id === cat.id ? splitName(c.name).n : parseInt(re.exec(String(c.name).trim())[1], 10) }))
        .sort((a, b) => a.n - b.n);

    for (const { c } of family) {
        if (c.id === cat.id && skipFullCheck) continue;
        if (countChildren(guild, c.id) < MAX_CHANNELS_PER_CATEGORY) return { category: c, created: false };
    }

    const nextN = Math.max(0, ...family.map(f => f.n)) + 1;
    const overwrites = cat.permissionOverwrites?.cache
        ? [...cat.permissionOverwrites.cache.values()].map(o => ({ id: o.id, type: o.type, allow: o.allow, deny: o.deny }))
        : [];
    const created = await guild.channels.create({
        name: `${base} ${nextN}`,
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwrites,
        position: typeof cat.position === 'number' ? cat.position + nextN : undefined,
        reason: `Danh mục Sold đã đầy ${MAX_CHANNELS_PER_CATEGORY} kênh, tự tạo danh mục mới`
    });
    return { category: created, created: true };
}

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

    // Kênh đã nằm trong một danh mục Sold (gốc hoặc "Sold N") thì không cần chuyển nữa
    const { base } = splitName(cat.name);
    const parent = channel.parentId ? guild.channels.cache.get(channel.parentId) : null;
    if (channel.parentId === cat.id) return { ok: true, moved: false };
    if (parent && parent.type === ChannelType.GuildCategory && splitName(parent.name).base.toLowerCase() === base.toLowerCase()
        && /^\s*\d+\s*$/.test(String(parent.name).slice(base.length))) {
        return { ok: true, moved: false };
    }

    const fail = (problem, err, category) => ({ ok: false, moved: false, problem, err, category });
    const describeError = (err, c) =>
        err?.code === 50013 ? `Bot thiếu quyền **Manage Channels** ở kênh này hoặc ở danh mục **${c.name}**.`
        : `Không chuyển được kênh sang **${c.name}**: ${err?.message || 'lỗi không rõ'}`;

    return withGuildLock(guild.id, async () => {
        let target = { category: cat, created: false };
        try {
            if (countChildren(guild, cat.id) >= MAX_CHANNELS_PER_CATEGORY) target = await pickOrCreateOverflow(guild, cat);
        } catch (err) {
            return fail(err?.code === 50013
                ? `Danh mục **${cat.name}** đã đầy nhưng bot thiếu quyền **Manage Channels** để tự tạo danh mục Sold mới.`
                : `Danh mục **${cat.name}** đã đầy và không tự tạo được danh mục mới: ${err?.message || 'lỗi không rõ'}`, err, cat);
        }

        try {
            await channel.setParent(target.category.id, { lockPermissions: false });
            return { ok: true, moved: true, category: target.category, created: target.created };
        } catch (err) {
            if (!isFullError(err)) return fail(describeError(err, target.category), err, target.category);
            // Bộ nhớ đệm của bot chưa kịp cập nhật nên đếm thiếu: Discord báo đầy thì sang danh mục kế tiếp
            try {
                const next = await pickOrCreateOverflow(guild, cat, { skipFullCheck: true });
                const again = next.category.id === target.category.id
                    ? await pickOrCreateOverflow(guild, target.category, { skipFullCheck: true })
                    : next;
                await channel.setParent(again.category.id, { lockPermissions: false });
                return { ok: true, moved: true, category: again.category, created: again.created };
            } catch (err2) {
                return fail(isFullError(err2)
                    ? `Danh mục **${target.category.name}** đã đầy (tối đa ${MAX_CHANNELS_PER_CATEGORY} kênh) và bot không tạo thêm được danh mục mới.`
                    : describeError(err2, target.category), err2, target.category);
            }
        }
    });
}

module.exports = { moveToSoldCategory, MAX_CHANNELS_PER_CATEGORY };
