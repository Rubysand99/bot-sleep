// Các hằng số có thể đổi bằng biến môi trường (không còn gán cứng trong code)
const fromEnv = (name, fallback) => {
    const v = process.env[name];
    return v && v.trim() ? v.trim() : fallback;
};

module.exports = {
    EMOJI_INFO: fromEnv('EMOJI_INFO', '<a:Info:1554714206870183996>'),
    EMOJI_ONLINE: fromEnv('EMOJI_ONLINE', '<a:X_online:1545982871716634784>'),
    EMOJI_OFFLINE: fromEnv('EMOJI_OFFLINE', '<a:X_offline:1545982880033800233>'),

    // Số legit của lần legit ĐẦU TIÊN khi chưa có dữ liệu (kênh đang hiện 632 thì legit kế tiếp là 633).
    // Có thể chỉnh lại bất cứ lúc nào bằng /config legit_count
    LEGIT_START: parseInt(fromEnv('LEGIT_START', '633'), 10) || 633,

    // 3 emoji bot thả vào tin legit của khách (đổi bằng biến LEGIT_REACT_EMOJIS, cách nhau bằng dấu cách)
    LEGIT_REACTIONS: fromEnv(
        'LEGIT_REACT_EMOJIS',
        '<a:CanhXanh:1556987445437014116> <:minecraft_accept:1556987449996218409> <a:CanhXanh:1541014174312828968>'
    ).split(/[\s,]+/).filter(Boolean),

    // Emoji DỰ PHÒNG cho emoji thứ 3 (cánh xanh): khi emoji thứ 3 không thả được, thử lần lượt 2 emoji này.
    // Đổi bằng biến LEGIT_REACT_BACKUP_3 (cách nhau bằng dấu cách). Vị trí 1, 2 chưa có dự phòng riêng.
    LEGIT_BACKUP_REACTIONS: [
        [],
        [],
        fromEnv(
            'LEGIT_REACT_BACKUP_3',
            '<a:CanhXanh:1561268756850937876> <a:canhxanh2:1519732018215129090>'
        ).split(/[\s,]+/).filter(Boolean)
    ],

    // Cuối cùng, nếu cả emoji dự phòng cũng lỗi thì dùng emoji thường này (vẫn luôn đủ 3 reaction)
    LEGIT_FALLBACK_REACTIONS: ['✅', '☑️', '🟢'],

    // Tên kênh legit = prefix + số (vd: 『✅』𝙑𝙤𝙪𝙘𝙝𝙚𝙨-632). Discord giới hạn đổi tên 2 lần / 10 phút
    // Đổi tên mà không cần sửa code bằng biến LEGIT_CHANNEL_PREFIX
    LEGIT_CHANNEL_PREFIX: fromEnv('LEGIT_CHANNEL_PREFIX', '『✅』𝙑𝙤𝙪𝙘𝙝𝙚𝙨-'),
    LEGIT_RENAME_INTERVAL_MS: 310_000,

    // Chống spam kênh legit: cùng 1 người chỉ được đếm 1 lần / số giây này (0 = tắt)
    LEGIT_COOLDOWN_SEC: Math.max(0, parseInt(fromEnv('LEGIT_COOLDOWN_SEC', '20'), 10) || 0),

    // Nhắc vouch qua DM: nhắc lần 1 sau 5 phút, lần 2 sau 30 phút, lần 3 sau 3 giờ rồi dừng
    VOUCH_REMINDER_DELAYS_MIN: [5, 30, 180],

    // Ticket CHỈ đóng khi staff/owner gõ .close; kênh bị xóa sau số ms này
    CLOSE_DELAY_MS: 5_000,

    // Nhận diện tin legit linh hoạt (xem utils/legit.js > isLegitMessage): có "+1" và chữ legit / vouch ở BẤT KỲ vị trí nào.
    // Đặt LEGIT_REQUIRE_MENTION=true nếu muốn bắt buộc phải tag (@) người bán mới tính.
    LEGIT_REQUIRE_MENTION: /^(1|true|yes|on)$/i.test(fromEnv('LEGIT_REQUIRE_MENTION', 'false'))
};
