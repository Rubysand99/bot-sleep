// Tích hợp payOS (https://payos.vn): tạo link/QR thanh toán, hỏi trạng thái, hủy link.
// Mỗi seller có 1 kênh payOS riêng (Client ID / API Key / Checksum Key), lưu mã hóa trong DB (db.getPayosChannel).
// Gọi API trực tiếp bằng axios; chữ ký HMAC-SHA256 theo tài liệu payOS (các trường sắp xếp theo thứ tự chữ cái).
const crypto = require('crypto');
const axios = require('axios');
const QRCode = require('qrcode');

const BASE_URL = () => (process.env.PAYOS_BASE_URL || 'https://api-merchant.payos.vn').replace(/\/+$/, '');

function headers(creds) {
    return { 'x-client-id': creds.clientId, 'x-api-key': creds.apiKey, 'Content-Type': 'application/json' };
}

// Chuỗi ký: amount=..&cancelUrl=..&description=..&orderCode=..&returnUrl=.. (sắp xếp theo tên trường)
function signCreateBody(body, checksumKey) {
    const data = ['amount', 'cancelUrl', 'description', 'orderCode', 'returnUrl']
        .map(k => `${k}=${body[k]}`).join('&');
    return crypto.createHmac('sha256', checksumKey).update(data).digest('hex');
}

// Mã đơn payOS: số nguyên duy nhất (tối đa 9007199254740991)
function newOrderCode() {
    return Number(`${Date.now()}${Math.floor(100 + Math.random() * 900)}`);
}

async function call(creds, method, path, data) {
    let res;
    try {
        res = await axios({ method, url: `${BASE_URL()}${path}`, headers: headers(creds), data, timeout: 10000, validateStatus: () => true });
    } catch (err) {
        const e = new Error(`Không kết nối được payOS: ${err.message}`);
        e.network = true;
        throw e;
    }
    const body = res.data || {};
    if (res.status >= 400 || String(body.code) !== '00') {
        const e = new Error(`payOS từ chối: ${body.desc || `HTTP ${res.status}`}${body.code ? ` (mã ${body.code})` : ''}`);
        e.status = res.status; e.payosCode = body.code;
        throw e;
    }
    return body.data;
}

// Tạo link thanh toán. Trả về { orderCode, paymentLinkId, qrCode, accountNumber, accountName, bin, checkoutUrl, amount, description, expiredAt }
async function createPaymentLink(creds, { orderCode, amount, description, expiredAt }) {
    const body = {
        orderCode, amount, description: String(description).slice(0, 25),
        cancelUrl: process.env.PAYOS_CANCEL_URL || 'https://payos.vn/cancel',
        returnUrl: process.env.PAYOS_RETURN_URL || 'https://payos.vn/success'
    };
    if (expiredAt) body.expiredAt = expiredAt;
    body.signature = signCreateBody(body, creds.checksumKey);
    const d = await call(creds, 'post', '/v2/payment-requests', body);
    return { ...d, orderCode, amount, description: body.description, expiredAt: body.expiredAt || null };
}

// Trả về { status: PENDING|PROCESSING|PAID|CANCELLED|EXPIRED|UNDERPAID, amount, amountPaid, ... }
async function getPaymentInfo(creds, orderCode) {
    return call(creds, 'get', `/v2/payment-requests/${encodeURIComponent(orderCode)}`);
}

async function cancelPaymentLink(creds, orderCode, reason = 'Ticket đã đóng') {
    return call(creds, 'post', `/v2/payment-requests/${encodeURIComponent(orderCode)}/cancel`, { cancellationReason: reason });
}

// Kiểm tra khóa: tạo link 2.000đ rồi hủy ngay. Ném lỗi nếu khóa sai.
async function testChannel(creds) {
    const orderCode = newOrderCode();
    const link = await createPaymentLink(creds, { orderCode, amount: 2000, description: 'Test bot', expiredAt: Math.floor(Date.now() / 1000) + 600 });
    await cancelPaymentLink(creds, orderCode, 'Kiểm tra khóa').catch(() => null);
    return link;
}

// Chuỗi QR (EMVCo) -> ảnh PNG
async function qrToPng(qrString) {
    return QRCode.toBuffer(String(qrString), { type: 'png', width: 600, margin: 2, errorCorrectionLevel: 'M' });
}

module.exports = { createPaymentLink, getPaymentInfo, cancelPaymentLink, testChannel, qrToPng, newOrderCode, signCreateBody };
