const axios = require('axios');
const { AttachmentBuilder } = require('discord.js');
const { parseAmount } = require('./money');
const { log } = require('./logger');

function generateTransferMemo() {
    const randomCode = Math.floor(100000 + Math.random() * 900000);
    return `${require('./profile').brand().split(' ')[0]}Buy ${randomCode}`;
}

const BANK_MAP = {
    'MBBANK': 'MB', 'VIETCOMBANK': 'VCB', 'VIETINBANK': 'ICB', 'TECHCOMBANK': 'TCB',
    'BIDV': 'BIDV', 'VPBANK': 'VPB', 'TPBANK': 'TPB', 'ACB': 'ACB', 'SACOMBANK': 'STB',
    'HDBANK': 'HDB', 'SHB': 'SHB', 'VIB': 'VIB', 'MSB': 'MSB', 'OCB': 'OCB',
    'SEABANK': 'SEAB', 'LPBANK': 'LPB',
    'MB': 'MB', 'MBB': 'MB', 'VCB': 'VCB', 'TCB': 'TCB', 'CTG': 'ICB', 'VIETINBANK': 'ICB', 'ICB': 'ICB',
    'AGRIBANK': 'VBA', 'VBA': 'VBA', 'EXIMBANK': 'EIB', 'EIB': 'EIB', 'NAMABANK': 'NAB', 'NAB': 'NAB',
    'BACABANK': 'BAB', 'BAB': 'BAB', 'NCB': 'NCB', 'SCB': 'SCB', 'VIETCAPITALBANK': 'VCCB', 'VCCB': 'VCCB',
    'PVCOMBANK': 'PVCB', 'PVCB': 'PVCB', 'ABBANK': 'ABB', 'ABB': 'ABB', 'BAOVIETBANK': 'BVB', 'BVB': 'BVB',
    'KIENLONGBANK': 'KLB', 'KLB': 'KLB', 'VIETABANK': 'VAB', 'VAB': 'VAB', 'VIETBANK': 'VBB', 'VBB': 'VBB',
    'SAIGONBANK': 'SGICB', 'GPBANK': 'GPB', 'GPB': 'GPB', 'OCEANBANK': 'OCEANBANK', 'CAKE': 'CAKE',
    'TIMO': 'TIMO', 'UBANK': 'UBANK', 'WOORI': 'WOO', 'WOO': 'WOO', 'SHINHAN': 'SHBVN', 'SHBVN': 'SHBVN',
    'HSBC': 'HSBC', 'CIMB': 'CIMB', 'PBVN': 'PBVN', 'PUBLICBANK': 'PBVN', 'COOPBANK': 'COOPBANK',
    'DONGABANK': 'DOB', 'DAB': 'DOB', 'DOB': 'DOB', 'BANVIET': 'VCCB', 'LIENVIETPOSTBANK': 'LPB',
    'VPB': 'VPB', 'TPB': 'TPB', 'STB': 'STB', 'HDB': 'HDB', 'SEAB': 'SEAB', 'BIDV': 'BIDV'
};

// Chuẩn hóa tên ngân hàng người dùng nhập (bỏ khoảng trắng, gạch, dấu chấm) rồi đổi sang mã VietQR
function resolveBankCode(bankName) {
    const clean = String(bankName || '').trim().toUpperCase().replace(/[\s_\-.]+/g, '');
    return BANK_MAP[clean] || clean;
}

function buildVietQRUrl(bankName, accountNumber, amount, memo, accountName) {
    if (!bankName || !accountNumber) return null;

    const cleanBank = resolveBankCode(bankName);

    const cleanAccNum = String(accountNumber).trim().replace(/\s+/g, '');
    const numAmount = typeof amount === 'number' ? amount : parseAmount(amount);
    const amountParam = numAmount > 0 ? `amount=${numAmount}` : '';
    const memoParam = memo ? `addInfo=${encodeURIComponent(String(memo).trim())}` : '';
    const nameParam = accountName ? `accountName=${encodeURIComponent(String(accountName).trim())}` : '';

    const params = [amountParam, memoParam, nameParam].filter(Boolean).join('&');
    const queryString = params ? `?${params}` : '';

    return `https://img.vietqr.io/image/${cleanBank}-${cleanAccNum}-compact2.png${queryString}`;
}

// Tải ảnh QR về từ phía bot rồi đính kèm thẳng vào tin nhắn (không phụ thuộc việc Discord có tải được link ngoài hay không).
// Trả về { files, imageUrl }: files để đưa vào message.send; imageUrl để embed.setImage. Tải lỗi thì rơi về dùng link trực tiếp.
// Che số tài khoản / nội dung trong URL trước khi ghi log (URL VietQR chứa STK, tên chủ TK, số tiền)
function safeUrl(u) {
    try { const x = new URL(u); return `${x.origin}${x.pathname.replace(/\d{5,}/g, d => '***' + d.slice(-3))}`; } catch (e) { return '(url không hợp lệ)'; }
}

// Cách gửi ảnh QR (biến môi trường QR_MODE, chỉ áp dụng khi VietQR trả về ảnh PNG/JPEG thật):
//   link   (mặc định): cho Discord tự tải ảnh qua link (embed.setImage(link)).
//   attach: bot tải ảnh về rồi đính kèm file (attachment://qr.png).
// LƯU Ý: img.vietqr.io hiện trả về ảnh SVG (dù đuôi link là .png). Discord KHÔNG hiển thị được SVG
// (kể cả dạng link lẫn dạng đính kèm), nên khi gặp SVG bot tự đổi sang PNG rồi đính kèm.
const QR_MODE = () => String(process.env.QR_MODE || 'link').trim().toLowerCase();

// Nhận diện định dạng ảnh qua vài byte đầu (PNG / JPEG / GIF / WEBP / SVG)
function sniffImage(buf) {
    if (!buf || buf.length < 4) return 'rong';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
    if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
    if (buf.slice(0, 3).toString('latin1') === 'GIF') return 'gif';
    if (buf.slice(0, 4).toString('latin1') === 'RIFF') return 'webp';
    if (buf.slice(0, 500).toString('utf8').includes('<svg')) return 'svg';
    return 'khong_ro';
}

// Đổi SVG -> PNG bằng @napi-rs/canvas (đã có sẵn trong dependencies), nền trắng để mã QR quét được
async function svgToPng(svgBuffer) {
    const { createCanvas, loadImage } = require('@napi-rs/canvas');
    const img = await loadImage(svgBuffer);
    const scale = img.width > 0 && img.width < 600 ? 600 / img.width : 1;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { png: canvas.toBuffer('image/png'), w, h };
}

async function prepareQrImage(url, ctx = {}) {
    if (!url) return { files: [], imageUrl: null };
    let href;
    try { href = new URL(url).href; }
    catch (e) {
        log.warn('QR', 'URL ảnh QR không hợp lệ', { loi: e.message, ...ctx });
        return { files: [], imageUrl: null };
    }
    try {
        const res = await axios.get(href, { responseType: 'arraybuffer', timeout: 8000, validateStatus: () => true });
        const type = String(res.headers?.['content-type'] || '');
        const data = Buffer.isBuffer(res.data) ? res.data : Buffer.from(res.data || []);
        const format = sniffImage(data);
        log.info('QR', 'Kết quả tải ảnh VietQR', { status: res.status, type, bytes: data.length, dinhdang: format, che_do: QR_MODE(), url: safeUrl(href), ...ctx });
        if (res.status === 200 && data.length > 0 && (type.startsWith('image/') || format === 'svg')) {
            if (format === 'svg' || type.includes('svg')) {
                try {
                    const { png, w, h } = await svgToPng(data);
                    log.info('QR', 'Đã đổi SVG sang PNG', { bytes: png.length, rong: w, cao: h, ...ctx });
                    return { files: [new AttachmentBuilder(png, { name: 'qr.png' })], imageUrl: 'attachment://qr.png' };
                } catch (convErr) {
                    log.error('QR', 'Đổi SVG sang PNG THẤT BẠI (Discord không hiển thị được SVG)', { loi: convErr.message, ...ctx });
                    return { files: [], imageUrl: href };
                }
            }
            if (QR_MODE() === 'attach') {
                return { files: [new AttachmentBuilder(data, { name: 'qr.png' })], imageUrl: 'attachment://qr.png' };
            }
            return { files: [], imageUrl: href };
        }
        log.warn('QR', 'VietQR không trả về ảnh hợp lệ (kiểm tra mã ngân hàng / số tài khoản)', { status: res.status, type, url: safeUrl(href), ...ctx });
    } catch (e) {
        log.warn('QR', 'Không tải được ảnh VietQR từ máy chủ bot', { loi: e.message, url: safeUrl(href), ...ctx });
    }
    return { files: [], imageUrl: href };
}

module.exports = { generateTransferMemo, buildVietQRUrl, prepareQrImage, resolveBankCode, BANK_MAP };
