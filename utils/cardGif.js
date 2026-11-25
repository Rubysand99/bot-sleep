// Card stock dạng GIF: nền là 1 trong 2 GIF trong assets/card_bg (random mỗi lần), phần chữ / giá / cape / skin vẽ đè lên.
// Bố cục thiết kế trên khung 1280x720 rồi thu nhỏ theo kích thước GIF xuất ra.
const { createCanvas, loadImage, ImageData } = require('@napi-rs/canvas');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');
const { GifReader } = require('omggif');
const path = require('path');
const fs = require('fs');
const C = require('./constants');
const cardRenderer = require('./cardRenderer');

const DESIGN_W = 1280;
const DESIGN_H = 720;
const BG_BLUR = 3;   // độ mờ nền (px trên khung thiết kế 1280x720)
const FONT = '"CardFallback", "Segoe UI", Arial, sans-serif';

let BG_DIR = path.join(__dirname, '../assets/card_bg');
if (!fs.existsSync(BG_DIR)) BG_DIR = path.join(process.cwd(), 'assets', 'card_bg');

const BASE_COLORS = [[255, 255, 255], [255, 120, 190], [59, 130, 246], [16, 185, 129], [201, 160, 220], [219, 227, 245]];

function listBackgrounds() {
    try {
        return fs.readdirSync(BG_DIR).filter(f => /\.gif$/i.test(f)).map(f => path.join(BG_DIR, f));
    } catch { return []; }
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Giá thẻ cào = giá bank cộng thêm % phí (mặc định +30%), làm tròn tới 5.000đ gần nhất
function cardPriceOf(bank) {
    const markup = Number(process.env.CARD_PRICE_MARKUP) > 0 ? Number(process.env.CARD_PRICE_MARKUP) : 1.3;
    return Math.round((bank * markup) / 5000) * 5000;
}
const vnd = (n) => `${n.toLocaleString('vi-VN')}đ`;

// Co chữ cho vừa bề ngang
function fitFont(ctx, text, startSize, maxW, minSize = 12) {
    let size = startSize;
    ctx.font = `bold ${size}px ${FONT}`;
    while (ctx.measureText(text).width > maxW && size > minSize) {
        size -= 1;
        ctx.font = `bold ${size}px ${FONT}`;
    }
    return size;
}

function wrapWords(ctx, text, maxW) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(next).width > maxW && cur) { lines.push(cur); cur = w; } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 4);
}

// Cape: emoji (kèm tên) hoặc, nếu chỉ nhập tên, ô chữ
function capeItemsOf(capesRaw) {
    const raw = String(capesRaw || '').trim();
    if (!raw || raw.toUpperCase() === 'NON') return [];
    const emojis = cardRenderer.extractAllEmojis(raw);
    if (emojis.length) return emojis.slice(0, 8).map(e => ({ name: e.name, url: e.url }));
    return raw.split(/[,\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 8).map(name => ({ name, url: null }));
}

// Vẽ toàn bộ phần KHÔNG chuyển động (trong suốt ở những chỗ muốn thấy nền) lên canvas W x H
async function buildOverlay(data, W, H) {
    const s = W / DESIGN_W;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.scale(s, s);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Làm tối nền + vignette cho chữ dễ đọc
    ctx.fillStyle = 'rgba(5, 8, 22, 0.38)';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    const vg = ctx.createRadialGradient(DESIGN_W / 2, DESIGN_H / 2, 260, DESIGN_W / 2, DESIGN_H / 2, 820);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    // Khung ngoài
    roundRect(ctx, 40, 40, 1200, 640, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const shadow = (blur = 8) => { ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 2; };
    const noShadow = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };

    // Tên bot (góc trên trái): từ cuối màu hồng
    let avatarImg = null;
    if (data.botAvatarUrl) {
        const buf = await cardRenderer.fetchBuffer(data.botAvatarUrl);
        if (buf) avatarImg = await loadImage(buf).catch(() => null);
    }
    const drawAvatar = (x, y, size) => {
        ctx.save();
        roundRect(ctx, x, y, size, size, size * 0.22);
        ctx.clip();
        if (avatarImg) ctx.drawImage(avatarImg, x, y, size, size);
        else { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, size, size); }
        ctx.restore();
    };
    drawAvatar(70, 70, 44);
    const botName = String(data.botName || 'BOT').toUpperCase().slice(0, 24);
    const parts = botName.split(/\s+/);
    const lastWord = parts.length > 1 ? parts.pop() : '';
    const firstPart = parts.join(' ') + (lastWord ? ' ' : '');
    ctx.save();
    const botSize = fitFont(ctx, botName, 28, 220, 16);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    shadow(6);
    ctx.fillStyle = '#ffd9ee';
    ctx.fillText(firstPart, 128, 93);
    if (lastWord) {
        ctx.font = `bold ${botSize}px ${FONT}`;
        ctx.fillStyle = '#ff6fb5';
        ctx.fillText(lastWord, 128 + ctx.measureText(firstPart).width, 93);
    }
    ctx.restore();

    // Rank (viên thuốc) + tên tài khoản
    const rankRaw = cardRenderer.stripEmojis(data.rank || '').toUpperCase().trim();
    const rankText = (rankRaw || 'NON').slice(0, 14);
    ctx.save();
    ctx.font = `bold 15px ${FONT}`;
    const pillW = Math.max(90, Math.ceil(ctx.measureText(rankText).width) + 40);
    roundRect(ctx, 380, 74, pillW, 28, 10);
    ctx.fillStyle = 'rgba(120,140,255,0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#d6defa';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rankText, 380 + pillW / 2, 89);
    ctx.restore();

    const accountName = String(data.username || 'NameAccount');
    ctx.save();
    fitFont(ctx, accountName, 58, 560, 24);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    shadow(10);
    ctx.fillText(accountName, 380, 134);
    ctx.restore();

    // 2 ô giá
    const bank = cardRenderer.parsePrice(data.price);
    const priceBoxes = [
        { y: 172, dot: '#3b82f6', label: 'GIÁ BANK (VNĐ)', value: vnd(bank) },
        { y: 310, dot: '#10b981', label: 'GIÁ THẺ CÀO (VNĐ)', value: vnd(cardPriceOf(bank)) }
    ];
    for (const box of priceBoxes) {
        ctx.save();
        roundRect(ctx, 380, box.y, 580, 122, 22);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(412, box.y + 32, 6, 0, Math.PI * 2);
        ctx.fillStyle = box.dot;
        ctx.fill();
        ctx.font = `bold 17px ${FONT}`;
        ctx.fillStyle = '#dbe3f5';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(box.label, 428, box.y + 33);
        fitFont(ctx, box.value, 66, 520, 28);
        ctx.fillStyle = '#ffffff';
        shadow(10);
        ctx.fillText(box.value, 412, box.y + 84);
        ctx.restore();
    }

    // Cape
    ctx.save();
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = 'rgba(235,240,255,0.72)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('COSMETICS & CAPES', 380, 453);
    ctx.restore();

    const capes = capeItemsOf(data.capes);
    if (!capes.length) {
        ctx.save();
        ctx.font = `bold 18px ${FONT}`;
        ctx.fillStyle = 'rgba(235,240,255,0.55)';
        ctx.textBaseline = 'middle';
        ctx.fillText('NON', 380, 500);
        ctx.restore();
    }
    const TILE_W = 84, TILE_H = 124, GAP = 14;
    for (let i = 0; i < capes.length; i++) {
        const cape = capes[i];
        const x = 380 + i * (TILE_W + GAP);
        const y = 472;
        ctx.save();
        roundRect(ctx, x, y, TILE_W, TILE_H, 8);
        ctx.fillStyle = 'rgba(18,22,32,0.82)';
        ctx.fill();
        ctx.restore();

        let drawn = false;
        if (cape.url) {
            const buf = await cardRenderer.fetchBuffer(cape.url);
            const img = buf ? await loadImage(buf).catch(() => null) : null;
            if (img) { cardRenderer.drawFittedCape(ctx, img, x, y, TILE_W, TILE_H, 8); drawn = true; }
        }
        ctx.save();
        if (!drawn) {
            ctx.font = `bold 15px ${FONT}`;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const lines = wrapWords(ctx, cape.name, TILE_W - 12);
            lines.forEach((ln, idx) => ctx.fillText(ln, x + TILE_W / 2, y + TILE_H / 2 + (idx - (lines.length - 1) / 2) * 19));
        }
        roundRect(ctx, x, y, TILE_W, TILE_H, 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        if (drawn) {
            ctx.font = `bold 14px ${FONT}`;
            ctx.fillStyle = '#d8def0';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let label = cape.name;
            while (ctx.measureText(label).width > TILE_W + 8 && label.length > 3) label = label.slice(0, -2);
            if (label !== cape.name) label += '…';
            shadow(4);
            ctx.fillText(label, x + TILE_W / 2, y + TILE_H + 16);
        }
        ctx.restore();
    }

    // Skin (trái)
    const hasName = accountName.toUpperCase() !== 'NON';
    const { skinImg } = await cardRenderer.fetchSkinData(hasName ? accountName : 'MHF_Steve');
    let skinTexture = null;
    if (!skinImg) skinTexture = await cardRenderer.fetchSkinTexture(hasName ? accountName : 'MHF_Steve');
    const cx = 195, ground = 545, maxW = 230, maxH = 370;
    let dw = 120, dh = 210;
    if (skinImg) {
        const ratio = Math.min(maxW / skinImg.width, maxH / skinImg.height);
        dw = Math.round(skinImg.width * ratio);
        dh = Math.round(skinImg.height * ratio);
    }
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, ground + 8, Math.round(dw * 0.5), 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,120,190,0.55)';
    ctx.fill();
    ctx.restore();
    ctx.save();
    if (skinImg) {
        ctx.drawImage(skinImg, cx - Math.round(dw / 2), ground - dh, dw, dh);
    } else if (skinTexture) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(skinTexture, 8, 8, 8, 8, cx - 60, ground - 300, 120, 120);   // chỉ có texture: vẽ đầu
    }
    ctx.restore();

    // Credit (dưới trái)
    drawAvatar(78, 636, 24);
    ctx.save();
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = 'rgba(232,170,222,0.85)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(C.CARD_CREDIT, 112, 649);
    ctx.restore();

    return canvas;
}

// Đọc từng khung của GIF nền (đã gộp khung theo disposal), trả về { rgba, width, height, delay }
function* gifFrames(buffer) {
    const reader = new GifReader(buffer);
    const w = reader.width, h = reader.height;
    const px = new Uint8ClampedArray(w * h * 4);
    let prevInfo = null, saved = null;
    for (let i = 0; i < reader.numFrames(); i++) {
        if (prevInfo) {
            if (prevInfo.disposal === 2) {
                for (let y = prevInfo.y; y < prevInfo.y + prevInfo.height; y++) {
                    px.fill(0, (y * w + prevInfo.x) * 4, (y * w + prevInfo.x + prevInfo.width) * 4);
                }
            } else if (prevInfo.disposal === 3 && saved) px.set(saved);
        }
        const info = reader.frameInfo(i);
        if (info.disposal === 3) saved = px.slice();
        reader.decodeAndBlitFrameRGBA(i, px);
        yield { rgba: px, width: w, height: h, delay: Math.max(20, (info.delay || 5) * 10) };
        prevInfo = info;
    }
}

const tick = () => new Promise(resolve => setImmediate(resolve));

// Chỉ cho 1 lần render chạy cùng lúc để không ngốn RAM / CPU khi đăng nhiều acc liên tiếp
let queue = Promise.resolve();
function serial(fn) {
    const run = queue.then(fn, fn);
    queue = run.catch(() => null);
    return run;
}

async function encode(bgBuffer, data, W, frameStep) {
    const H = Math.round(W * DESIGN_H / DESIGN_W);
    const overlay = await buildOverlay(data, W, H);

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    let src = null, srcCtx = null;

    const compose = (frame) => {
        if (!src || src.width !== frame.width || src.height !== frame.height) {
            src = createCanvas(frame.width, frame.height);
            srcCtx = src.getContext('2d');
        }
        srcCtx.putImageData(new ImageData(frame.rgba, frame.width, frame.height), 0, 0);
        // Phóng hơi lớn + làm mờ nhẹ: nền GIF độ phân giải thấp nên mịn hơn, đẹp hơn và GIF xuất ra cũng nhẹ hơn nhiều
        const scale = Math.max(W / frame.width, H / frame.height) * 1.05;
        const dw = frame.width * scale, dh = frame.height * scale;
        ctx.filter = `blur(${(BG_BLUR * W / DESIGN_W).toFixed(2)}px)`;
        ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.filter = 'none';
        ctx.drawImage(overlay, 0, 0);
        return ctx.getImageData(0, 0, W, H).data;
    };

    // Bảng màu chung cho cả GIF (nhỏ hơn + không nhấp nháy giữa các khung); lấy mẫu vài khung và thêm các màu chủ đạo của chữ
    const frames = [...gifFrames(bgBuffer)];
    const total = frames.length;
    const sampleIdx = new Set(Array.from({ length: Math.min(6, total) }, (_, k) => Math.floor(k * total / Math.min(6, total))));
    const chunks = [];
    for (const idx of sampleIdx) {
        const rgba = compose(frames[idx]);
        const sub = new Uint8Array(Math.ceil(rgba.length / 16) * 4);
        for (let p = 0, q = 0; p < rgba.length; p += 16, q += 4) { sub[q] = rgba[p]; sub[q + 1] = rgba[p + 1]; sub[q + 2] = rgba[p + 2]; sub[q + 3] = 255; }
        chunks.push(sub);
    }
    const swatch = new Uint8Array(BASE_COLORS.length * 4 * 1500);
    BASE_COLORS.forEach((c, ci) => { for (let n = 0; n < 1500; n++) { const o = (ci * 1500 + n) * 4; swatch[o] = c[0]; swatch[o + 1] = c[1]; swatch[o + 2] = c[2]; swatch[o + 3] = 255; } });
    chunks.push(swatch);
    const all = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }
    const palette = quantize(all, 256, { format: 'rgb565' });

    const gif = GIFEncoder();
    let first = true;
    let carry = 0;
    for (let i = 0; i < total; i++) {
        carry += frames[i].delay;
        if (i % frameStep !== 0) continue;
        const rgba = compose(frames[i]);
        const index = applyPalette(rgba, palette, 'rgb565');
        gif.writeFrame(index, W, H, first ? { palette, delay: carry, repeat: 0 } : { delay: carry });
        first = false;
        carry = 0;
        await tick();
    }
    gif.finish();
    return Buffer.from(gif.bytes());
}

// Trả về { buffer, name }: GIF nếu làm được, lỗi / thiếu nền GIF thì rơi về ảnh PNG tĩnh cũ
async function renderStockCard(data) {
    const gifs = listBackgrounds();
    if (gifs.length) {
        try {
            return await serial(async () => {
                const bg = fs.readFileSync(gifs[Math.floor(Math.random() * gifs.length)]);
                // Discord giới hạn dung lượng file đăng: nặng quá thì giảm kích thước / bớt khung hình
                const attempts = [[1024, 1], [800, 1], [640, 1], [640, 2]];
                let last = null;
                for (const [width, step] of attempts) {
                    last = await encode(bg, data, width, step);
                    if (last.length <= C.CARD_GIF_MAX_BYTES) break;
                }
                return { buffer: last, name: 'card.gif' };
            });
        } catch (e) {
            console.error('[CARD] Không tạo được card GIF, dùng ảnh tĩnh:', e.message);
        }
    }
    const png = await cardRenderer.renderCard(data);
    return { buffer: png, name: 'card.png' };
}

module.exports = { renderStockCard, cardPriceOf, buildOverlay };
