// Tạo nền cho ảnh "đăng ảnh kèm giá": cảnh Minecraft ban đêm, làm mờ + phủ tông tím.
// Chạy 1 lần:  node scripts/gen-listing-bg.js   (kết quả: assets/listing_bg.png, đã commit sẵn, bot chỉ đọc file này)
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

const W = 1671, H = 941;       // cùng kích thước ảnh mẫu
const GW = 209, GH = 118;      // lưới pixel nhỏ (mỗi ô ~ 8px) rồi phóng to + làm mờ

// Bộ sinh số ngẫu nhiên cố định: chạy lại luôn ra cùng một ảnh
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = rng(20251121);

const small = createCanvas(GW, GH);
const g = small.getContext('2d');
g.imageSmoothingEnabled = false;
const px = (x, y, w, h, c, a = 1) => { g.globalAlpha = a; g.fillStyle = c; g.fillRect(x, y, w, h); g.globalAlpha = 1; };

// Bầu trời
const sky = g.createLinearGradient(0, 0, 0, 78);
sky.addColorStop(0, '#0a0d26');
sky.addColorStop(0.6, '#1c1848');
sky.addColorStop(1, '#3a2a6e');
g.fillStyle = sky;
g.fillRect(0, 0, GW, GH);

// Sao
for (let i = 0; i < 70; i++) px(Math.floor(rand() * GW), Math.floor(rand() * 40), 1, 1, '#d9ccff', 0.35 + rand() * 0.5);

// Mây khối
for (let i = 0; i < 9; i++) {
    const cx = Math.floor(rand() * GW), cy = 4 + Math.floor(rand() * 26), len = 18 + Math.floor(rand() * 26);
    px(cx, cy, len, 3, '#4b3f86', 0.55);
    px(cx + 4, cy - 2, len - 10, 2, '#4b3f86', 0.45);
    px(cx + 2, cy + 3, len - 6, 2, '#2f2862', 0.5);
}

// Núi 2 lớp (bậc thang)
function ridge(base, peakX, peakH, width, color, alpha) {
    for (let x = 0; x < GW; x++) {
        const d = Math.abs(x - peakX) / width;
        const h = Math.max(0, Math.round(peakH * (1 - d)) + Math.floor(rand() * 2));
        if (h > 0) px(x, base - h, 1, h + 2, color, alpha);
    }
}
ridge(72, 62, 40, 62, '#2a2559', 0.9);
ridge(72, 118, 52, 48, '#1d1a45', 1);
ridge(72, 30, 24, 40, '#231f4f', 1);

// Nhà (góc phải) có cửa sổ sáng đèn
const hx = 150, hy = 28;
px(hx, hy + 12, 46, 26, '#2a2430');                 // thân nhà
px(hx - 3, hy + 8, 52, 5, '#17131f');               // mái
px(hx + 3, hy + 3, 40, 6, '#1d1826');
px(hx + 10, hy - 3, 26, 7, '#17131f');
px(hx + 36, hy - 6, 4, 8, '#201b29');               // ống khói
for (const [wx, wy] of [[hx + 6, hy + 17], [hx + 17, hy + 17], [hx + 28, hy + 17], [hx + 17, hy + 27]]) {
    px(wx, wy, 6, 6, '#ffb84a', 0.95);
    px(wx + 1, wy + 1, 4, 4, '#ffd98a', 0.9);
}
px(hx + 38, hy + 25, 5, 13, '#120f18');             // cửa

// Cây (khối lá tối)
function tree(x, top, w, h) {
    px(x + Math.floor(w / 2) - 1, top + h - 2, 3, 22, '#2a1d2b');
    for (let i = 0; i < 5; i++) {
        const lw = w - i * 2 + Math.floor(rand() * 3);
        px(x + Math.floor((w - lw) / 2), top + i * 4, lw, 5, i % 2 ? '#183a2b' : '#1e4630');
    }
}
tree(6, 12, 24, 22); tree(30, 26, 20, 18); tree(86, 40, 18, 14); tree(190, 44, 16, 14); tree(70, 34, 16, 14);

// Mặt đất: cỏ ô vuông + đất
for (let y = 72; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
        const n = rand();
        const dark = (x + y) % 2 === 0;
        let c = dark ? '#1c3a24' : '#24472b';
        if (y > 96) c = dark ? '#162f1f' : '#1d3b26';
        if (n < 0.06) c = '#2f5a35';
        if (n > 0.97) c = '#12281a';
        px(x, y, 1, 1, c);
    }
}
// Lối đi đất
for (let y = 74; y < GH; y++) {
    const x0 = 118 + Math.floor((y - 74) * 0.9), len = 14 + Math.floor((y - 74) * 0.35);
    px(x0, y, len, 1, y % 2 ? '#3b2d3a' : '#43343f');
}

// Hoa tím
const flowerCols = ['#a45cff', '#c58bff', '#8a4dff', '#e2b0ff'];
for (let i = 0; i < 70; i++) {
    const x = Math.floor(rand() * GW), y = 70 + Math.floor(rand() * (GH - 72));
    const c = flowerCols[Math.floor(rand() * flowerCols.length)];
    px(x, y, 1, 1, c, 0.9);
    if (rand() < 0.4) px(x, y + 1, 1, 1, '#1f5a35', 0.9);
}

// Phóng to + làm mờ nhẹ (nội suy), rồi phủ tông tím + tối viền
const out = createCanvas(W, H);
const o = out.getContext('2d');
o.imageSmoothingEnabled = true;
o.imageSmoothingQuality = 'high';
o.drawImage(small, 0, 0, GW, GH, 0, 0, W, H);
try { o.filter = 'blur(6px)'; o.drawImage(out, 0, 0); o.filter = 'none'; } catch {}

o.globalCompositeOperation = 'source-over';
o.fillStyle = 'rgba(60, 28, 130, 0.30)';
o.fillRect(0, 0, W, H);
const vg = o.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.95);
vg.addColorStop(0, 'rgba(5, 3, 18, 0)');
vg.addColorStop(1, 'rgba(5, 3, 18, 0.62)');
o.fillStyle = vg;
o.fillRect(0, 0, W, H);

const dest = path.join(__dirname, '..', 'assets', 'listing_bg.png');
fs.writeFileSync(dest, out.toBuffer('image/png'));
console.log('Đã tạo', dest, `(${Math.round(fs.statSync(dest).size / 1024)} KB)`);
