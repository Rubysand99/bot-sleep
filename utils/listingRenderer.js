// Ảnh "đăng ảnh kèm giá" (mẫu MFA listing): tên tài khoản, danh sách cape, giá, skin 2D.
// Không có thương hiệu shop: chân trang đặt bằng biến LISTING_FOOTER (mặc định chữ chung, không tên shop).
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');
const { parseAmount } = require('./money');
const { composeSkin2D } = require('./skin2d');
const cardRenderer = require('./cardRenderer');

const W = 1671, H = 941;
const ASSETS = fs.existsSync(path.join(__dirname, '../assets')) ? path.join(__dirname, '../assets') : path.join(process.cwd(), 'assets');
const PIXEL = 'ListingPixel';
const FALLBACK = 'ListingFallback';
let fontsReady = false;

function registerFonts() {
    if (fontsReady) return;
    fontsReady = true;
    const reg = (file, name) => {
        const full = path.join(ASSETS, 'fonts', file);
        if (fs.existsSync(full)) { try { GlobalFonts.registerFromPath(full, name); } catch {} }
    };
    reg('Jersey15-Regular.ttf', PIXEL);
    reg('DejaVuSans-Bold.ttf', FALLBACK);
}

// Font pixel (Jersey 15) chỉ có Latin; chữ có dấu tiếng Việt (ấ, ợ...) dùng font dự phòng để không bị ô vuông
const fontStack = (text) => (/[^\u0000-ɏ]/.test(text) ? `"${FALLBACK}", "${PIXEL}", sans-serif` : `"${PIXEL}", "${FALLBACK}", sans-serif`);

function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Chữ có co chữ cho vừa chiều rộng + giãn chữ (spacing) + bóng
function text(ctx, str, x, y, o = {}) {
    const { size = 28, color = '#fff', align = 'left', maxW = 0, spacing = 0, weight = 400, shadow = 'rgba(0,0,0,0.6)', blur = 4, minSize = 12 } = o;
    str = String(str);
    let s = Math.round(size * 1.22);
    const measure = () => {
        ctx.font = `${weight} ${s}px ${fontStack(str)}`;
        return ctx.measureText(str).width + spacing * Math.max(0, str.length - 1);
    };
    let w = measure();
    while (maxW && w > maxW && s > minSize) { s -= 1; w = measure(); }
    if (maxW && w > maxW) {   // vẫn dài: cắt bớt và thêm "..."
        while (str.length > 1 && measure() > maxW) str = str.slice(0, -1);
        str = str.slice(0, -1) + '...';
        w = measure();
    }
    ctx.save();
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.shadowColor = shadow;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetY = 2;
    let sx = x;
    if (align === 'center') sx = x - w / 2;
    else if (align === 'right') sx = x - w;
    if (!spacing) ctx.fillText(str, sx, y);
    else for (const ch of str) { ctx.fillText(ch, sx, y); sx += ctx.measureText(ch).width + spacing; }
    ctx.restore();
    return w;
}

// Khung kính tối viền tím phát sáng
function panel(ctx, x, y, w, h, r, o = {}) {
    const { fill = 'rgba(12, 9, 30, 0.72)', border = 'rgba(150, 110, 255, 0.95)', glow = 'rgba(140, 90, 255, 0.55)', line = 2.5 } = o;
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = border;
    ctx.lineWidth = line;
    ctx.stroke();
    ctx.restore();
}

// ----- Icon vẽ bằng code (không dùng logo của shop) -----
function drawCube(ctx, cx, cy, s) {
    const pts = (a) => { ctx.beginPath(); a.forEach(([px, py], i) => (i ? ctx.lineTo(cx + px * s, cy + py * s) : ctx.moveTo(cx + px * s, cy + py * s))); ctx.closePath(); };
    pts([[0, -1], [0.87, -0.5], [0, 0], [-0.87, -0.5]]); ctx.fillStyle = '#c9b2ff'; ctx.fill();
    pts([[-0.87, -0.5], [0, 0], [0, 1], [-0.87, 0.5]]); ctx.fillStyle = '#8e63f0'; ctx.fill();
    pts([[0.87, -0.5], [0, 0], [0, 1], [0.87, 0.5]]); ctx.fillStyle = '#6a3fd0'; ctx.fill();
}
function drawShirt(ctx, cx, cy, s) {
    ctx.beginPath();
    [[-1, -0.7], [-0.4, -0.9], [0, -0.55], [0.4, -0.9], [1, -0.7], [1.25, -0.1], [0.7, 0.1], [0.7, 0.9], [-0.7, 0.9], [-0.7, 0.1], [-1.25, -0.1]]
        .forEach(([px, py], i) => (i ? ctx.lineTo(cx + px * s, cy + py * s) : ctx.moveTo(cx + px * s, cy + py * s)));
    ctx.closePath();
    ctx.fillStyle = '#b79cff'; ctx.fill();
}
function drawCrown(ctx, cx, cy, s) {
    ctx.beginPath();
    [[-1, 0.7], [-1, -0.5], [-0.5, 0], [0, -0.8], [0.5, 0], [1, -0.5], [1, 0.7]]
        .forEach(([px, py], i) => (i ? ctx.lineTo(cx + px * s, cy + py * s) : ctx.moveTo(cx + px * s, cy + py * s)));
    ctx.closePath();
    ctx.fillStyle = '#b79cff'; ctx.fill();
}
function drawGem(ctx, cx, cy, s) {
    const poly = (a, c) => { ctx.beginPath(); a.forEach(([px, py], i) => (i ? ctx.lineTo(cx + px * s, cy + py * s) : ctx.moveTo(cx + px * s, cy + py * s))); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); };
    poly([[-1, -0.35], [-0.55, -0.9], [0.55, -0.9], [1, -0.35], [0, 1]], '#9b6cff');
    poly([[-1, -0.35], [-0.55, -0.9], [0, -0.35]], '#c9b0ff');
    poly([[-0.55, -0.9], [0.55, -0.9], [0, -0.35]], '#e4d6ff');
    poly([[0.55, -0.9], [1, -0.35], [0, -0.35]], '#b18cff');
    poly([[-1, -0.35], [0, -0.35], [0, 1]], '#7a4de0');
    poly([[1, -0.35], [0, -0.35], [0, 1]], '#6338c4');
}
// Đồng tiền VÀNG (thay cho đồng tiền tím của mẫu)
function drawGoldCoin(ctx, cx, cy, r) {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 200, 60, 0.7)';
    ctx.shadowBlur = 22;
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.45, '#ffcf3a'); g.addColorStop(1, '#c98a00');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = '#fff0a6'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(150, 90, 0, 0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
    text(ctx, '$', cx, cy + 2, { size: r * 1.15, color: '#8a5600', align: 'center', shadow: 'rgba(255,240,170,0.8)', blur: 0 });
}

// Giá viết gọn: 150K, 1.2M. Giá không đọc được thì giữ nguyên chữ người nhập
function formatPrice(raw) {
    const n = parseAmount(raw);
    if (!n) return String(raw || '0').trim().toUpperCase().slice(0, 14) || '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    return Math.round(n / 1000) + 'K';
}

// "10:27:41 21/11/2025" theo giờ Việt Nam
function stamp(now) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
    }).formatToParts(now).map(x => [x.type, x.value]));
    return `${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second} ${p.day}/${p.month}/${p.year}`;
}

// Vẽ cape vừa khung, giữ đúng tỉ lệ (cắt phần trong suốt thừa)
function drawCapeIn(ctx, img, x, y, w, h) {
    const t = createCanvas(img.width, img.height);
    const tc = t.getContext('2d');
    tc.drawImage(img, 0, 0);
    const d = tc.getImageData(0, 0, img.width, img.height).data;
    let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
    for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) {
        if (d[(j * img.width + i) * 4 + 3] > 15) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    }
    if (x1 < x0 || y1 < y0) { x0 = 0; y0 = 0; x1 = img.width - 1; y1 = img.height - 1; }
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const pad = Math.round(Math.min(w, h) * 0.1);
    const k = Math.min((w - pad * 2) / cw, (h - pad * 2) / ch);
    const dw = cw * k, dh = ch * k;
    ctx.save();
    ctx.imageSmoothingEnabled = k < 2;   // cape nhỏ phóng to: giữ nét vuông
    ctx.drawImage(img, x0, y0, cw, ch, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
}

// Mẫu ảnh. deps chỉ dùng cho kiểm thử (thay hàm tải ảnh / giờ).
async function renderListing(data, deps = {}) {
    registerFonts();
    const fetchBuffer = deps.fetchBuffer || cardRenderer.fetchBuffer;
    const fetchSkinTexture = deps.fetchSkinTexture || cardRenderer.fetchSkinTexture;
    const now = deps.now || new Date();

    const username = String(data.username || 'NameAccount').trim();
    const price = formatPrice(data.price);
    const footer = (process.env.LISTING_FOOTER || '').trim() || 'Shop Account Minecraft Uy Tín Nhất!';

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Nền
    const bgPath = path.join(ASSETS, 'listing_bg.png');
    let drewBg = false;
    if (fs.existsSync(bgPath)) {
        try { ctx.drawImage(await loadImage(bgPath), 0, 0, W, H); drewBg = true; } catch {}
    }
    if (!drewBg) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0d0a26'); g.addColorStop(1, '#2a1b55');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // Khung ngoài
    panel(ctx, 30, 52, 1614, 856, 44, { fill: 'rgba(0,0,0,0)', border: 'rgba(160, 125, 255, 0.55)', glow: 'rgba(140, 90, 255, 0.35)', line: 2 });

    // Thanh trên
    panel(ctx, 64, 32, 444, 72, 36);
    drawCube(ctx, 118, 62, 30);
    text(ctx, 'Minecraft - Mfa', 170, 69, { size: 31, maxW: 310 });
    panel(ctx, 1397, 34, 221, 66, 33);
    text(ctx, 'MFA LISTING', 1507, 67, { size: 26, align: 'center', maxW: 190, spacing: 1 });

    // Nhãn "SKIN PREVIEW" + khung skin
    panel(ctx, 145, 130, 313, 66, 33);
    drawShirt(ctx, 190, 163, 19);
    text(ctx, 'SKIN PREVIEW', 237, 165, { size: 25, maxW: 200 });
    panel(ctx, 100, 214, 417, 586, 42);
    const glowG = ctx.createRadialGradient(308, 520, 30, 308, 520, 250);
    glowG.addColorStop(0, 'rgba(140, 90, 255, 0.28)'); glowG.addColorStop(1, 'rgba(140, 90, 255, 0)');
    ctx.fillStyle = glowG; ctx.fillRect(101, 215, 415, 584);

    // Tên tài khoản
    text(ctx, 'ACCOUNT USERNAME', 548, 152, { size: 26, color: '#b79cff', spacing: 2, maxW: 520 });
    text(ctx, username, 548, 212, { size: 84, maxW: 1070, minSize: 30, blur: 8, shadow: 'rgba(120,80,255,0.6)' });

    // Danh sách cape
    const emojiList = cardRenderer.extractAllEmojis(data.capes || '');
    const shown = emojiList.slice(0, 8);
    panel(ctx, 543, 294, 1062, 340, 46);
    text(ctx, 'CAPE LIST', 574, 330, { size: 30, color: '#e7dcff' });
    text(ctx, `${emojiList.length} CAPES`, 1572, 330, { size: 28, color: '#e7dcff', align: 'right' });
    ctx.fillStyle = 'rgba(180, 150, 255, 0.28)';
    ctx.fillRect(574, 362, 998, 2);

    if (!shown.length) {
        text(ctx, 'NO CAPE', 1074, 490, { size: 30, color: 'rgba(200,180,255,0.55)', align: 'center' });
    }
    const gap = shown.length > 5 ? 16 : 28;
    const tileW = Math.min(152, Math.floor((998 - gap * (shown.length - 1)) / Math.max(1, shown.length)));
    const tileH = Math.round(tileW * 178 / 152);
    for (let i = 0; i < shown.length; i++) {
        const x = 587 + i * (tileW + gap), y = 387;
        ctx.save();
        rr(ctx, x, y, tileW, tileH, 14);
        const tg = ctx.createLinearGradient(x, y, x, y + tileH);
        tg.addColorStop(0, '#7b5cf0'); tg.addColorStop(1, '#4a2fa8');
        ctx.fillStyle = tg; ctx.fill();
        ctx.restore();
        const buf = await fetchBuffer(shown[i].url);
        if (buf) {
            try { drawCapeIn(ctx, await loadImage(buf), x, y, tileW, tileH); } catch {}
        }
        ctx.save();
        rr(ctx, x, y, tileW, tileH, 14);
        ctx.strokeStyle = '#efe6ff'; ctx.lineWidth = 3.5; ctx.shadowColor = 'rgba(170,130,255,0.9)'; ctx.shadowBlur = 12; ctx.stroke();
        ctx.restore();
        text(ctx, shown[i].name, x + tileW / 2, y + tileH + 30, { size: 25, align: 'center', maxW: tileW + gap - 4, minSize: 13, blur: 3 });
    }
    if (emojiList.length > shown.length) {
        text(ctx, `+${emojiList.length - shown.length}`, 1572, 600, { size: 26, color: '#e7dcff', align: 'right' });
    }

    // Giá
    panel(ctx, 543, 660, 1062, 138, 46);
    text(ctx, 'PRICE', 574, 692, { size: 30, color: '#b79cff', spacing: 1 });
    drawGem(ctx, 603, 750, 27);
    text(ctx, price, 650, 748, { size: 62, maxW: 700, minSize: 30 });
    drawGoldCoin(ctx, 1540, 728, 41);

    // Skin 2D
    const tex = await Promise.resolve(fetchSkinTexture(username)).catch(() => null);
    const fig = composeSkin2D(tex);
    const scale = 14, fw = 16 * scale, fh = 32 * scale;
    const fx = Math.round(308 - fw / 2), fy = 246;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(308, fy + fh + 14, fw * 0.42, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'; ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
    ctx.drawImage(fig, 0, 0, 16, 32, fx, fy, fw, fh);
    ctx.restore();

    // Chân trang
    ctx.fillStyle = 'rgba(180, 150, 255, 0.22)';
    ctx.fillRect(48, 846, 1574, 2);
    drawCrown(ctx, 88, 875, 18);
    text(ctx, footer, 118, 876, { size: 22, maxW: 1000, minSize: 13, blur: 3 });
    text(ctx, stamp(now), 1604, 876, { size: 22, color: '#9a7bff', align: 'right', blur: 0 });

    return canvas.toBuffer('image/png');
}

module.exports = { renderListing, formatPrice, stamp };
