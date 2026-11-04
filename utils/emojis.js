// Emoji bot cần dùng, đặt riêng TỪNG server bằng lệnh /emoji (lưu trong MongoDB), ưu tiên emoji custom.
// Thứ tự lấy giá trị cho mỗi vị trí:  /emoji set của server  ->  biến môi trường / giá trị mặc định trong code.
// Emoji thường (unicode) chỉ là phương án CUỐI CÙNG khi emoji custom không dùng được (bot không thấy / đã bị xóa).
const C = require('./constants');

// key = tên vị trí dùng trong /emoji; fallback = emoji thường dùng khi emoji custom hỏng
const SLOTS = [
    { key: 'online',  label: 'Nút BUY / Cách mua (acc còn hàng)', kind: 'button',   fallback: '🟢',  def: () => C.EMOJI_ONLINE },
    { key: 'offline', label: 'Dòng "Acc đã được bán"',            kind: 'text',     fallback: '🔴',  def: () => C.EMOJI_OFFLINE },
    { key: 'info',    label: 'Dòng "Seller" trên card',           kind: 'text',     fallback: 'ℹ️', def: () => C.EMOJI_INFO },
    { key: 'legit1',  label: 'Reaction legit thứ 1',              kind: 'reaction', fallback: () => C.LEGIT_FALLBACK_REACTIONS[0] || '✅',  def: () => C.LEGIT_REACTIONS[0], backups: () => C.LEGIT_BACKUP_REACTIONS[0] || [] },
    { key: 'legit2',  label: 'Reaction legit thứ 2',              kind: 'reaction', fallback: () => C.LEGIT_FALLBACK_REACTIONS[1] || '☑️', def: () => C.LEGIT_REACTIONS[1], backups: () => C.LEGIT_BACKUP_REACTIONS[1] || [] },
    { key: 'legit3',  label: 'Reaction legit thứ 3',              kind: 'reaction', fallback: () => C.LEGIT_FALLBACK_REACTIONS[2] || '🟢', def: () => C.LEGIT_REACTIONS[2], backups: () => C.LEGIT_BACKUP_REACTIONS[2] || [] }
];
const slotOf = (key) => SLOTS.find(s => s.key === key) || null;
const fallbackOf = (slot) => (typeof slot.fallback === 'function' ? slot.fallback() : slot.fallback);

// ---- Phân tích 1 emoji ----
const CUSTOM_RE = /^<(a?):([A-Za-z0-9_]{2,32}):(\d{15,25})>$/;
const UNICODE_RE = /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3)$/u;

// -> { custom: true, animated, name, id, raw } | { custom: false, raw } | null (không phải emoji)
function parseEmoji(input) {
    const raw = String(input ?? '').trim();
    if (!raw) return null;
    const m = CUSTOM_RE.exec(raw);
    if (m) return { custom: true, animated: m[1] === 'a', name: m[2], id: m[3], raw };
    if (UNICODE_RE.test(raw)) return { custom: false, raw };
    return null;
}

// ---- Bộ nhớ cấu hình theo server ----
const overrides = new Map();   // guildId -> Map(slotKey -> emoji)
const clearOverrides = () => overrides.clear();
function setOverride(guildId, slotKey, value) {
    const g = String(guildId);
    if (value === null || value === undefined || value === '') {
        const m = overrides.get(g);
        if (m) { m.delete(slotKey); if (!m.size) overrides.delete(g); }
        return;
    }
    if (!overrides.has(g)) overrides.set(g, new Map());
    overrides.get(g).set(slotKey, String(value));
}
const getOverride = (guildId, slotKey) => (guildId ? overrides.get(String(guildId))?.get(slotKey) : undefined) ?? null;

// Giá trị đã cấu hình (chưa kiểm tra bot có thấy hay không)
function configured(slotKey, guildId) {
    const slot = slotOf(slotKey);
    if (!slot) return '';
    return getOverride(guildId, slotKey) || slot.def() || fallbackOf(slot);
}
const sourceOf = (slotKey, guildId) => (getOverride(guildId, slotKey) ? 'server' : 'mac_dinh');

// ---- Kiểm tra bot có thấy emoji custom không ----
let checker = null;   // id => boolean (index.js gắn dựa trên client.emojis.cache)
const setEmojiChecker = (fn) => { checker = typeof fn === 'function' ? fn : null; warned.clear(); };
const isVisible = (id) => { if (!checker) return true; try { return Boolean(checker(id)); } catch { return false; } };

const warned = new Set();
function warnOnce(key, msg, extra) {
    if (warned.has(key)) return;
    warned.add(key);
    try { require('./logger').log.warn('EMOJI', msg, extra); } catch { /* bỏ qua */ }
}

// Emoji THỰC SỰ sẽ dùng: custom nếu bot thấy, ngược lại mới dùng emoji thường
function effective(slotKey, guildId) {
    const slot = slotOf(slotKey);
    const value = configured(slotKey, guildId);
    const p = parseEmoji(value);
    const fb = slot ? fallbackOf(slot) : '✅';
    if (!p) return { value: fb, configured: value, custom: false, usedFallback: true, source: sourceOf(slotKey, guildId), reason: 'giá trị không phải emoji hợp lệ' };
    if (!p.custom) return { value: p.raw, configured: value, custom: false, usedFallback: false, source: sourceOf(slotKey, guildId) };
    if (isVisible(p.id)) return { value: p.raw, configured: value, custom: true, usedFallback: false, source: sourceOf(slotKey, guildId) };
    // Vị trí có emoji custom dự phòng (reaction legit): thử dự phòng còn thấy được trước khi dùng emoji thường
    for (const b of (slot?.backups ? slot.backups() : [])) {
        const bp = parseEmoji(b);
        if (bp?.custom && isVisible(bp.id)) {
            return { value: bp.raw, configured: value, custom: true, usedFallback: false, usedBackup: true, source: sourceOf(slotKey, guildId), reason: 'emoji chính bot không thấy, đang dùng emoji custom dự phòng' };
        }
    }
    warnOnce(`${slotKey}:${guildId}:${p.id}`, `Emoji "${slotKey}" không dùng được (bot không thấy hoặc đã bị xóa), tạm dùng emoji thường`,
        { emoji: p.raw, thay_bang: fb, guildId, goiy: 'Chạy /emoji check rồi /emoji set để đặt emoji custom bot thấy được' });
    return { value: fb, configured: value, custom: true, usedFallback: true, source: sourceOf(slotKey, guildId), reason: 'bot không thấy emoji này' };
}
const text = (slotKey, guildId) => effective(slotKey, guildId).value;

// Dành cho reaction legit: danh sách [emoji cần thả, ...emoji dự phòng custom, emoji thường cuối cùng]
function reactionChain(index, guildId) {
    const slot = slotOf(`legit${index + 1}`);
    if (!slot) return [];
    const list = [configured(slot.key, guildId), ...(slot.backups ? slot.backups() : []), fallbackOf(slot)];
    return [...new Set(list.filter(Boolean))];
}
const legitConfigured = (guildId) => [1, 2, 3].map(n => configured(`legit${n}`, guildId));

// ---- Đọc emoji người dùng nhập ở /emoji set ----
// Chấp nhận: emoji chọn từ bảng emoji / mã <:tên:id> / <a:tên:id>, ID emoji, TÊN emoji có trong server, hoặc emoji thường
// Trả về { ok:true, value, custom, name?, id?, guildName? } | { ok:false, error }
function resolveInput(input, client, guild) {
    const raw = String(input ?? '').trim();
    if (!raw) return { ok: false, error: 'Bạn chưa nhập emoji.' };
    const cache = client?.emojis?.cache;
    const describe = (e) => ({ ok: true, custom: true, value: `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`, name: e.name, id: e.id, guildName: e.guild?.name });
    const notSeen = (name, id) => ({
        ok: false,
        error: `Bot **không thấy** emoji \`${name || id}\`. Cần mời bot vào server chứa emoji đó, hoặc up emoji vào server này rồi đặt lại (dùng \`/emoji list\` để xem emoji có sẵn).`
    });

    const p = parseEmoji(raw);
    if (p && p.custom) {
        const found = cache?.get(p.id);
        return found ? describe(found) : notSeen(p.name, p.id);
    }
    if (p && !p.custom) return { ok: true, custom: false, value: p.raw };

    if (/^\d{15,25}$/.test(raw)) {
        const found = cache?.get(raw);
        return found ? describe(found) : notSeen(null, raw);
    }
    if (/^:?[A-Za-z0-9_]{2,32}:?$/.test(raw)) {
        const name = raw.replace(/^:|:$/g, '').toLowerCase();
        const inGuild = guild?.emojis?.cache?.find?.(e => String(e.name).toLowerCase() === name);
        const any = inGuild || cache?.find?.(e => String(e.name).toLowerCase() === name);
        if (any) return describe(any);
        return { ok: false, error: `Không tìm thấy emoji nào tên \`${name}\` mà bot thấy được. Dùng \`/emoji list\` để xem danh sách, hoặc dán mã dạng \`<:tên:id>\`.` };
    }
    return { ok: false, error: 'Không nhận ra đây là emoji. Hãy chọn emoji từ bảng emoji, gõ **tên** emoji của server, dán mã `<:tên:id>` hoặc ID emoji.' };
}

module.exports = {
    SLOTS, slotOf, parseEmoji, resolveInput,
    clearOverrides, setOverride, getOverride, configured, sourceOf,
    setEmojiChecker, isVisible, effective, text, reactionChain, legitConfigured
};
