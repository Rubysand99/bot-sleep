// Tên kênh legit: 『✅』𝙑𝙤𝙪𝙘𝙝𝙚𝙨-<số> (đổi bằng biến LEGIT_CHANNEL_PREFIX). Discord chỉ cho đổi tên 2 lần / 10 phút (tính riêng TỪNG kênh) nên mỗi kênh đổi tối đa
// 1 lần / ~5 phút, luôn lấy số mới nhất tại thời điểm đổi (không bao giờ bỏ sót số cuối).
const C = require('./constants');
const { log, errInfo, hint } = require('./logger');

const states = new Map();   // channelId -> { last, timer, latest }

const legitName = (n) => `${C.LEGIT_CHANNEL_PREFIX}${n}`;

// ---- Nhận diện tin legit ------------------------------------------------------------
// Chấp nhận mọi cách khách hay viết, ví dụ:
//   +1 legit @shop | +1legit @shop | legit +1 @shop | LEGIT+1 | + 1 legit | ＋1 legit
//   +1 vouch / +1 vouches | +1 lgit / legitt | **+1 legit** | `+1 legit` | "Cảm ơn shop, +1 legit @shop"
// Không tính: tin chỉ hỏi "shop này legit không?" (thiếu +1), chỉ có "+1" (thiếu chữ legit), "+10 legit".
const PLUS_ONE = /\+\s*1(?!\d)|(?<![\d.])1\s*\+(?!\s*\d)/;
const KEYWORD = /(?<![a-z])(?:le?gg?i?t{1,4}|vouch(?:es|ed|er|ers)?)(?![a-z])/;   // cho phép số dính liền: "+1legit"
const MENTION = /<@[!&]?\d+>/;

function normalizeLegitText(content) {
    return String(content || '')
        .normalize('NFKC')                       // ＋ -> +, chữ toàn-rộng -> thường, ký tự toán học nghiêng đậm -> chữ thường
        .replace(/[\u200B-\u200D\uFEFF]/g, '')   // ký tự vô hình
        .replace(/[*_~`|]/g, ' ')                // bỏ định dạng markdown **...**, `...`, ||...||
        .toLowerCase();
}

function isLegitMessage(content, { requireMention = C.LEGIT_REQUIRE_MENTION } = {}) {
    const raw = String(content || '');
    if (!raw.trim()) return false;
    const t = normalizeLegitText(raw);
    // Bỏ phần mention khỏi văn bản trước khi tìm "+1" để ID người dùng không gây nhận nhầm
    const text = t.replace(/<@[!&]?\d+>/g, ' ');
    if (!PLUS_ONE.test(text) || !KEYWORD.test(text)) return false;
    return requireMention ? MENTION.test(raw) : true;
}

function stateOf(channel) {
    let st = states.get(channel.id);
    if (!st) { st = { last: 0, timer: null, latest: null }; states.set(channel.id, st); }
    return st;
}

function applyRename(channel, st) {
    st.timer = null;
    st.last = Date.now();
    const name = legitName(st.latest);
    if (channel.name !== name) {
        log.info('LEGIT', 'Đang đổi tên kênh legit', { channelId: channel.id, tu: channel.name, thanh: name });
        return Promise.resolve(channel.setName(name))
            .then(() => log.info('LEGIT', 'Đã đổi tên kênh legit', { channelId: channel.id, ten: name }))
            .catch(err => log.warn('LEGIT', 'Không đổi được tên kênh legit', { channelId: channel.id, ...errInfo(err), goiy: hint(err) || 'Thiếu quyền Manage Channels?' }));
    }
}

function scheduleLegitRename(channel, number, { force = false } = {}) {
    if (!channel || typeof channel.setName !== 'function') return;
    const st = stateOf(channel);
    st.latest = number;
    if (force) {
        if (st.timer) clearTimeout(st.timer);
        return applyRename(channel, st);
    }
    if (st.timer) { log.debug('LEGIT', 'Đã có lịch đổi tên kênh, sẽ dùng số mới nhất', { channelId: channel.id, so: number }); return; }
    const wait = Math.max(0, st.last + C.LEGIT_RENAME_INTERVAL_MS - Date.now());
    if (wait === 0) return applyRename(channel, st);
    log.debug('LEGIT', 'Hẹn đổi tên kênh legit (tránh giới hạn 2 lần/10 phút)', { channelId: channel.id, so: number, sau_giay: Math.round(wait / 1000) });
    st.timer = setTimeout(() => applyRename(channel, st), wait);
    if (st.timer.unref) st.timer.unref();
}

function resetLegitRenameState() {
    for (const st of states.values()) if (st.timer) clearTimeout(st.timer);
    states.clear();
}

module.exports = { legitName, isLegitMessage, scheduleLegitRename, resetLegitRenameState };
