// Lệnh prefix của Owner: .setqr <@user | id> <ngân hàng> <số tài khoản> <tên chủ tài khoản>
// Ví dụ: .setqr @Tên MB 0123456789 NGUYEN VAN A   (lưu giống /set_qr nhưng cho người khác)
//        .setqr xem @Tên                              (xem thông tin đã lưu)
const { resolveBankCode } = require('./vietqr');

const USER_RE = /^<@!?(\d{17,20})>$|^(\d{17,20})$/;

// Trả về { action:'set', userId, bankName, accountNumber, holder } | { action:'view', userId } | { error }
function parseSetQr(content) {
    const text = String(content || '').trim();
    const m = text.match(/^\.setqr(?:\s+([\s\S]*))?$/i);
    if (!m) return null;
    const tokens = (m[1] || '').trim().split(/\s+/).filter(Boolean);
    const usage = 'Cú pháp: `.setqr @user MB 0123456789 TEN CHU TK` · xem: `.setqr xem @user`';
    if (!tokens.length) return { error: usage };

    const view = tokens[0].toLowerCase() === 'xem';
    const userTok = view ? tokens[1] : tokens[0];
    const um = USER_RE.exec(userTok || '');
    if (!um) return { error: `Thiếu hoặc sai người nhận (tag @user hoặc dán ID). ${usage}` };
    const userId = um[1] || um[2];
    if (view) return { action: 'view', userId };

    const [, bank, stkRaw, ...nameParts] = tokens;
    if (!bank || !stkRaw || !nameParts.length) return { error: `Thiếu thông tin. ${usage}` };
    const accountNumber = stkRaw.replace(/[.\-]/g, '');
    if (!/^\d{6,20}$/.test(accountNumber)) return { error: `Số tài khoản \`${stkRaw}\` không hợp lệ (chỉ gồm 6-20 chữ số). ${usage}` };
    return { action: 'set', userId, bankName: resolveBankCode(bank), accountNumber, holder: nameParts.join(' ').toUpperCase() };
}

module.exports = { parseSetQr };
