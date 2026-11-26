// Vẽ nhân vật Minecraft 3D (từ file skin 64x64 / 64x32) xoay quanh trục dọc, dùng canvas thường (không cần thư viện 3D).
// Mỗi khối là hộp 6 mặt; mặt quay về phía camera được vẽ theo thứ tự xa -> gần (painter's algorithm).

// Các bộ phận: [tx, ty] góc texture, [w, h, d] kích thước, [x0, y0, z0] góc nhỏ nhất, grow = độ phình của lớp áo ngoài
function parts(slim, legacy) {
    const aw = slim ? 3 : 4;
    const P = [];
    const add = (tx, ty, w, h, d, x0, y0, z0, grow = 0, flip = false) => P.push({ tx, ty, w, h, d, x0: x0 - grow, y0: y0 - grow, z0: z0 - grow, gw: w + grow * 2, gh: h + grow * 2, gd: d + grow * 2, flip });
    // thân người: x phải = bên phải màn hình, y lên, z hướng về camera. Tay phải của nhân vật nằm bên TRÁI màn hình.
    add(16, 16, 8, 12, 4, -4, 12, -2);                       // thân
    add(0, 16, 4, 12, 4, -4, 0, -2);                         // chân phải
    legacy ? add(0, 16, 4, 12, 4, 0, 0, -2, 0, true) : add(16, 48, 4, 12, 4, 0, 0, -2);   // chân trái
    add(40, 16, aw, 12, 4, -4 - aw, 12, -2);                 // tay phải
    legacy ? add(40, 16, aw, 12, 4, 4, 12, -2, 0, true) : add(32, 48, aw, 12, 4, 4, 12, -2);   // tay trái
    add(0, 0, 8, 8, 8, -4, 24, -4);                          // đầu
    // lớp áo ngoài (hat, jacket, sleeve, pants): chỉ có ở skin 64x64
    const o = 0.5;
    add(32, 0, 8, 8, 8, -4, 24, -4, o);
    if (!legacy) {
        add(16, 32, 8, 12, 4, -4, 12, -2, o);
        add(0, 32, 4, 12, 4, -4, 0, -2, o);
        add(0, 48, 4, 12, 4, 0, 0, -2, o);
        add(40, 32, aw, 12, 4, -4 - aw, 12, -2, o);
        add(48, 48, aw, 12, 4, 4, 12, -2, o);
    }
    return P;
}

// Mỗi mặt: góc trên-trái nhìn từ ngoài, trục u (sang phải trong texture), trục v (xuống trong texture), vùng texture
function faces(p, slim) {
    const { tx, ty, w, h, d, x0, y0, z0, gw, gh, gd } = p;
    const x1 = x0 + gw, y1 = y0 + gh, z1 = z0 + gd;
    // texture của hộp: top (tx+d, ty, w, d) | bottom (tx+d+w, ty, w, d) | right (tx, ty+d, d, h) | front (tx+d, ty+d, w, h) | left (tx+d+w, ty+d, d, h) | back (tx+2d+w, ty+d, w, h)
    return [
        { n: [0, 0, 1],  o: [x0, y1, z1], u: [gw, 0, 0],  v: [0, -gh, 0], t: [tx + d, ty + d, w, h] },          // trước
        { n: [0, 0, -1], o: [x1, y1, z0], u: [-gw, 0, 0], v: [0, -gh, 0], t: [tx + 2 * d + w, ty + d, w, h] },  // sau
        { n: [-1, 0, 0], o: [x0, y1, z0], u: [0, 0, gd],  v: [0, -gh, 0], t: [tx, ty + d, d, h] },              // phải nhân vật (bên trái màn hình)
        { n: [1, 0, 0],  o: [x1, y1, z1], u: [0, 0, -gd], v: [0, -gh, 0], t: [tx + d + w, ty + d, d, h] },      // trái nhân vật
        { n: [0, 1, 0],  o: [x0, y1, z0], u: [gw, 0, 0],  v: [0, 0, gd],  t: [tx + d, ty, w, d] },              // trên
        { n: [0, -1, 0], o: [x0, y0, z1], u: [gw, 0, 0],  v: [0, 0, -gd], t: [tx + d + w, ty, w, d] }           // dưới
    ];
}

// Skin tay mảnh (Alex): ô tay ở góc phải-trên của phần tay phải trong suốt
function isSlim(img, ctx) {
    if (img.height < 64) return false;
    const d = ctx.getImageData(54, 20, 1, 1).data;   // cột tay thứ 4 (chỉ có ở tay to)
    return d[3] === 0;
}

// Chuẩn bị texture: trả về { img, slim, legacy } hoặc null. createCanvas truyền từ bên ngoài để module độc lập.
function prepareSkin(texture, createCanvas) {
    if (!texture || texture.width < 64) return null;
    const legacy = texture.height < 64;
    const c = createCanvas(texture.width, texture.height);
    const x = c.getContext('2d');
    x.drawImage(texture, 0, 0);
    // chuẩn hoá về 64 px/ô (skin HD 128, 256…): vẽ lại về 64 chiều rộng
    const k = texture.width / 64;
    let img = c;
    if (k !== 1) {
        img = createCanvas(64, legacy ? 32 : 64);
        const ix = img.getContext('2d');
        ix.imageSmoothingEnabled = false;
        ix.drawImage(c, 0, 0, texture.width, texture.height, 0, 0, 64, legacy ? 32 : 64);
    }
    const slim = isSlim(img, img.getContext('2d'));
    return { img, slim, legacy, parts: parts(slim, legacy) };
}

// Vẽ nhân vật lên ctx. yaw (rad): 0 = nhìn thẳng. cx, ground: điểm giữa chân; s: số px mỗi đơn vị (cao 32 đơn vị)
function drawPlayer(ctx, skin, { cx, ground, s, yaw = 0, pitch = 0.12 }) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const rot = (x, y, z) => {
        const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
        return [x1, y * cp + z1 * sp, -y * sp + z1 * cp];
    };
    const list = [];
    for (const p of skin.parts) {
        for (const f of faces(p, skin.slim)) {
            const n = rot(...f.n);
            if (n[2] <= 0.001) continue;   // mặt quay lưng lại camera
            const o = rot(...f.o);
            const u = rot(...f.u), v = rot(...f.v);
            const cz = o[2] + (u[2] + v[2]) / 2;
            list.push({ o, u, v, cz, t: f.t, flip: p.flip && (f.n[0] === 0 && f.n[1] === 0) });
        }
    }
    list.sort((a, b) => a.cz - b.cz);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const f of list) {
        const [sx, sy2, sw, sh] = f.t;
        const px = (q) => [cx + q[0] * s, ground - q[1] * s];
        const P0 = px(f.o);
        const P1 = [P0[0] + f.u[0] * s, P0[1] - f.u[1] * s];
        const P3 = [P0[0] + f.v[0] * s, P0[1] - f.v[1] * s];
        ctx.save();
        // đường viền mặt hơi nở ra 0.6px để không hở khe giữa các mặt
        const ex = (P1[0] - P0[0]) / (sw || 1), ey = (P1[1] - P0[1]) / (sw || 1);
        ctx.transform(ex, ey, (P3[0] - P0[0]) / (sh || 1), (P3[1] - P0[1]) / (sh || 1), P0[0], P0[1]);
        if (f.flip) { ctx.translate(sw, 0); ctx.scale(-1, 1); }
        ctx.drawImage(skin.img, sx, sy2, sw, sh, -0.03, -0.03, sw + 0.06, sh + 0.06);
        ctx.restore();
    }
    ctx.restore();
}

module.exports = { prepareSkin, drawPlayer };
