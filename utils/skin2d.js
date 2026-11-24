// Ghép skin Minecraft DẠNG 2D (nhìn thẳng từ phía trước) từ ảnh texture skin 64x64 / 64x32.
// Trả về canvas 16x32 pixel (1 pixel skin = 1 pixel canvas), bên ngoài phóng to bằng nội suy "nearest" để giữ nét vuông.
const { createCanvas } = require('@napi-rs/canvas');

// Vùng mặt trước trên texture: [sx, sy, w, h]
const R = {
    head: [8, 8, 8, 8], hat: [40, 8, 8, 8],
    body: [20, 20, 8, 12], jacket: [20, 36, 8, 12],
    rArm: [44, 20, 4, 12], rSleeve: [44, 36, 4, 12],
    lArm: [36, 52, 4, 12], lSleeve: [52, 52, 4, 12],
    rLeg: [4, 20, 4, 12], rPants: [4, 36, 4, 12],
    lLeg: [20, 52, 4, 12], lPants: [4, 52, 4, 12]
};

// Skin tay nhỏ (Alex): cột pixel cuối của tay (54..55, 20..31) trong suốt hoàn toàn
// data = alpha theo lưới skin 64 chuẩn (mỗi pixel 4 byte RGBA, 64 pixel / dòng)
function isSlim(data) {
    for (let y = 20; y < 32; y++) {
        for (let x = 54; x < 56; x++) if (data[(y * 64 + x) * 4 + 3] > 0) return false;
    }
    return true;
}

function composeSkin2D(tex) {
    const out = createCanvas(16, 32);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (!tex || tex.width < 64 || tex.height < 32) return placeholderSkin(out, ctx);

    // Texture có thể lớn hơn 64 (HD): quy về tỉ lệ 64
    const k = tex.width / 64;
    const tmp = createCanvas(tex.width, tex.height);
    const t = tmp.getContext('2d');
    t.imageSmoothingEnabled = false;
    t.drawImage(tex, 0, 0);
    const data = t.getImageData(0, 0, tex.width, tex.height).data;
    const modern = tex.height >= 64 * k;
    const slim = modern && isSlim(scaleProbe(data, tex.width, k));
    const armW = slim ? 3 : 4;

    // vẽ 1 vùng texture [sx,sy,w,h] (đơn vị skin 64) vào (dx,dy) trên canvas 16x32; w tùy chỉnh (tay nhỏ), lật ngang nếu flip
    const put = (reg, dx, dy, w = reg[2], flip = false) => {
        const [sx, sy, , h] = reg;
        ctx.save();
        if (flip) { ctx.translate(dx + w, dy); ctx.scale(-1, 1); ctx.drawImage(tmp, sx * k, sy * k, w * k, h * k, 0, 0, w, h); }
        else ctx.drawImage(tmp, sx * k, sy * k, w * k, h * k, dx, dy, w, h);
        ctx.restore();
    };

    // Chân + thân trước, đầu và tay vẽ sau để chồng đúng thứ tự
    put(R.rLeg, 4, 20); put(modern ? R.lLeg : R.rLeg, 8, 20, 4, !modern);
    if (modern) { put(R.rPants, 4, 20); put(R.lPants, 8, 20); }
    put(R.body, 4, 8);
    if (modern) put(R.jacket, 4, 8);

    // Tay phải của nhân vật nằm bên TRÁI người xem
    put(R.rArm, slim ? 1 : 0, 8, armW);
    put(modern ? R.lArm : R.rArm, 12, 8, armW, !modern);
    if (modern) { put(R.rSleeve, slim ? 1 : 0, 8, armW); put(R.lSleeve, 12, 8, armW); }

    put(R.head, 4, 0);
    put(R.hat, 4, 0);
    return out;
}

// Đọc nhanh pixel alpha của texture HD theo toạ độ skin 64 (lấy mẫu góc trên trái của mỗi ô)
function scaleProbe(data, width, k) {
    if (k === 1) return data;   // texture 64 chuẩn: dùng thẳng
    const probe = new Uint8ClampedArray(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const s = ((y * k) * width + x * k) * 4, d = (y * 64 + x) * 4;
        probe[d + 3] = data[s + 3];
    }
    return probe;
}

// Không tải được skin: hình người xám tím (không đoán mặt/áo)
function placeholderSkin(out, ctx) {
    const col = '#6b5aa8', dark = '#4a3d7d';
    ctx.fillStyle = col; ctx.fillRect(4, 0, 8, 8);
    ctx.fillStyle = dark; ctx.fillRect(4, 8, 8, 12); ctx.fillRect(0, 8, 4, 12); ctx.fillRect(12, 8, 4, 12);
    ctx.fillStyle = col; ctx.fillRect(4, 20, 4, 12); ctx.fillRect(8, 20, 4, 12);
    return out;
}

module.exports = { composeSkin2D, isSlim };
