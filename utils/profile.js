// Chế độ chạy của bot, chọn bằng biến môi trường BOT_PROFILE:
//   drew    : bot Drew Store  = auto buy + bxh + sold + auto react legit (mặc định KHÔNG đếm số legit)
//   cartone : bot Cartone     = auto buy + bxh + sold + auto react legit (mặc định ĐẾM số legit)
//   (2 bot có cùng tính năng, chỉ khác: giá trị MẶC ĐỊNH của đếm legit, tên thương hiệu. Dữ liệu bxh / khách tách riêng theo server.)
//   full    : (mặc định) giống bản cũ, đủ mọi tính năng, mặc định đếm legit
// Cả 3 chế độ đều bật / tắt đếm legit được bằng /config legit_dem (lưu riêng từng server); legitDefault chỉ là giá trị khi server CHƯA chỉnh lệnh.
// Mỗi bot chạy 1 service riêng với DISCORD_TOKEN / CLIENT_ID / MONGODB_DB riêng.

const FEATURES = {
    // autobuy: BUY, ticket, Confirm, kho acc, QR, role mốc, nhắc vouch, /skin...
    // sold   : gõ "sold", /set_kenhsold, .taokenh / .xoakenh (quản lý kênh bán hàng)
    // bxh    : .bxh, /leaderboard, .done, /done (ghi doanh thu + bảng xếp hạng)
    // legit  : auto react kênh "+1 legit"
    full:    { autobuy: true,  sold: true, bxh: true,  legit: true, legitDefault: true,  name: 'Drew AutoBuy', brand: 'Drew Store' },
    drew:    { autobuy: true,  sold: true, bxh: true,  legit: true, legitDefault: false, name: 'Drew AutoBuy', brand: 'Drew Store' },
    cartone: { autobuy: true,  sold: true, bxh: true,  legit: true, legitDefault: true,  name: 'Cartone Bot',  brand: 'Cartone' }
};

// Lệnh slash theo tính năng. 'common' = bot nào cũng có.
const COMMAND_FEATURE = {
    config: 'common', staff: 'common', owner: 'common', sticky: 'common',
    set_kenhsold: 'sold', taokenh: 'sold', xoakenh: 'sold',
    leaderboard: 'bxh', done: 'bxh',
    add_acc: 'autobuy', stock: 'autobuy', set_qr: 'autobuy', restock: 'autobuy', skin: 'autobuy', moc_role: 'autobuy'
};

const FALLBACK = 'full';

function resolveName(raw) {
    const n = String(raw || '').trim().toLowerCase();
    return FEATURES[n] ? n : FALLBACK;
}

// Đọc lại mỗi lần gọi để test đổi được process.env.BOT_PROFILE
function current() {
    const id = resolveName(process.env.BOT_PROFILE);
    return { id, ...FEATURES[id] };
}

const has = (feature) => feature === 'common' || Boolean(current()[feature]);
const commandEnabled = (name) => has(COMMAND_FEATURE[name] || 'common');
const brand = () => current().brand;

// Giá trị mặc định của đếm legit khi server chưa dùng /config legit_dem (drew: tắt, cartone / full: bật)
const defaultLegitCount = () => Boolean(current().legitDefault);

// Chỉ phục vụ các server này (ALLOWED_GUILD_IDS = "id1,id2"). Để trống = mọi server bot có mặt.
function allowedGuilds() {
    return String(process.env.ALLOWED_GUILD_IDS || '').split(/[\s,]+/).filter(x => /^\d{17,20}$/.test(x));
}
function guildAllowed(guildId) {
    const list = allowedGuilds();
    return !list.length || list.includes(String(guildId));
}

module.exports = { FEATURES, COMMAND_FEATURE, current, has, commandEnabled, brand, defaultLegitCount, allowedGuilds, guildAllowed, resolveName };
