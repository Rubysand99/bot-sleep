#!/usr/bin/env node
// Kiểm tra kênh payOS của Owner mà không cần Discord. Chạy trên VPS:
//   ENV_FILE=.env.cartone node scripts/payos-check.js          -> tạo link 2.000đ rồi hủy (kiểm tra khóa + chữ ký)
//   ENV_FILE=.env.cartone node scripts/payos-check.js --pay    -> giữ link, chờ bạn chuyển 2.000đ thật, in trạng thái tới khi PAID
require('dotenv').config({ path: process.env.ENV_FILE || '.env' });
const payos = require('../utils/payos');

const creds = {
    clientId: (process.env.PAYOS_CLIENT_ID || '').trim(),
    apiKey: (process.env.PAYOS_API_KEY || '').trim(),
    checksumKey: (process.env.PAYOS_CHECKSUM_KEY || '').trim()
};
const missing = Object.entries({ PAYOS_CLIENT_ID: creds.clientId, PAYOS_API_KEY: creds.apiKey, PAYOS_CHECKSUM_KEY: creds.checksumKey }).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) { console.error(`❌ Thiếu trong ${process.env.ENV_FILE || '.env'}: ${missing.join(', ')}`); process.exit(1); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    const orderCode = payos.newOrderCode();
    let link;
    try {
        link = await payos.createPaymentLink(creds, {
            orderCode, amount: 2000, description: 'Test bot',
            expiredAt: Math.floor(Date.now() / 1000) + 600
        });
    } catch (err) {
        console.error(`❌ Tạo link thất bại: ${err.message}`);
        process.exit(2);
    }
    console.log('✅ Tạo link payOS thành công (khóa + chữ ký đúng)');
    console.log(`   orderCode: ${orderCode}`);
    console.log(`   Số tài khoản: ${link.accountNumber || '(không có)'} | Chủ TK: ${link.accountName || '(không có)'} | BIN: ${link.bin || '(không có)'}`);
    console.log(`   Có chuỗi QR: ${link.qrCode ? 'có' : 'KHÔNG'} | Ảnh QR tạo được: ${link.qrCode ? (await payos.qrToPng(link.qrCode)).length + ' bytes' : '-'}`);
    console.log(`   Trang thanh toán: ${link.checkoutUrl || '(không có)'}`);

    if (!process.argv.includes('--pay')) {
        await payos.cancelPaymentLink(creds, orderCode).then(() => console.log('🗑️  Đã hủy link test.')).catch(e => console.log(`⚠️ Không hủy được: ${e.message}`));
        console.log('\nĐể thử cả bước nhận tiền: chạy lại với --pay, mở link ở trên, chuyển đúng 2.000đ.');
        return;
    }
    console.log('\n⏳ Chờ thanh toán 2.000đ (tối đa 10 phút). Mở trang thanh toán ở trên hoặc quét QR rồi chuyển khoản...');
    let last = '';
    for (let i = 0; i < 200; i++) {
        await sleep(3000);
        let info;
        try { info = await payos.getPaymentInfo(creds, orderCode); } catch (e) { console.log(`   (hỏi trạng thái lỗi: ${e.message})`); continue; }
        if (info.status !== last) { console.log(`   Trạng thái: ${info.status} | đã nhận: ${info.amountPaid ?? 0}`); last = info.status; }
        if (info.status === 'PAID') { console.log('✅ ĐÃ NHẬN TIỀN: payOS và bot hỏi trạng thái hoạt động đúng.'); return; }
        if (['CANCELLED', 'EXPIRED'].includes(info.status)) { console.log(`❌ Link ${info.status}`); process.exit(3); }
    }
    await payos.cancelPaymentLink(creds, orderCode).catch(() => null);
    console.log('⌛ Hết 10 phút chưa thấy tiền, đã hủy link.');
})();
