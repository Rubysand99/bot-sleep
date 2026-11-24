// Kiểm thử ảnh "đăng ảnh kèm giá" (chạy độc lập: node tests/listing.test.js)
const assert = require('assert');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const root = path.join(__dirname, '..');
const { composeSkin2D, isSlim } = require(path.join(root, 'utils/skin2d'));
const { renderListing, formatPrice, stamp } = require(path.join(root, 'utils/listingRenderer'));

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('  ✅ ' + name); };
const pix = (canvas, x, y) => Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data);

// Skin giả: mỗi vùng 1 màu riêng để biết ghép đúng chỗ
function fakeSkin({ legacy = false, slim = false } = {}) {
    const c = createCanvas(64, legacy ? 32 : 64), x = c.getContext('2d');
    const f = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    f('#ff0000', 8, 8, 8, 8);      // mặt
    f('#00ff00', 20, 20, 8, 12);   // thân
    f('#0000ff', 44, 20, 4, 12);   // tay phải (bên trái người xem)
    f('#ffff00', 4, 20, 4, 12);    // chân phải
    if (!legacy) {
        f('#00ffff', 36, 52, 4, 12);   // tay trái
        f('#ff00ff', 20, 52, 4, 12);   // chân trái
        f('#ffffff', 40, 8, 2, 2);     // lớp mũ: góc trên trái của đầu
        if (slim) { x.clearRect(54, 20, 2, 12); }
        else f('#808080', 54, 20, 2, 12);
    }
    return c;
}
const hex = (r, g, b) => [r, g, b, 255];

(async () => {
    console.log('\nSkin 2D:');
    await t('ghép đúng vị trí đầu, thân, tay, chân (skin 64x64)', () => {
        const s = composeSkin2D(fakeSkin());
        assert.equal(s.width, 16); assert.equal(s.height, 32);
        assert.deepStrictEqual(pix(s, 7, 4), hex(255, 0, 0));      // đầu
        assert.deepStrictEqual(pix(s, 7, 12), hex(0, 255, 0));     // thân
        assert.deepStrictEqual(pix(s, 1, 12), hex(0, 0, 255));     // tay phải ở bên trái
        assert.deepStrictEqual(pix(s, 14, 12), hex(0, 255, 255));  // tay trái ở bên phải
        assert.deepStrictEqual(pix(s, 5, 26), hex(255, 255, 0));   // chân phải
        assert.deepStrictEqual(pix(s, 10, 26), hex(255, 0, 255));  // chân trái
        assert.deepStrictEqual(pix(s, 4, 0), hex(255, 255, 255), 'lớp mũ phủ lên đầu');
    });
    await t('skin cũ 64x32: tay / chân trái lấy từ tay / chân phải', () => {
        const s = composeSkin2D(fakeSkin({ legacy: true }));
        assert.deepStrictEqual(pix(s, 14, 12), hex(0, 0, 255));
        assert.deepStrictEqual(pix(s, 10, 26), hex(255, 255, 0));
    });
    await t('skin tay nhỏ (Alex): tay rộng 3 pixel, nhận diện đúng', () => {
        assert.equal(isSlim(fakeSkin().getContext('2d').getImageData(0, 0, 64, 64).data), false);
        assert.equal(isSlim(fakeSkin({ slim: true }).getContext('2d').getImageData(0, 0, 64, 64).data), true);
        const s = composeSkin2D(fakeSkin({ slim: true }));
        assert.equal(pix(s, 0, 12)[3], 0, 'cột ngoài cùng trống');
        assert.deepStrictEqual(pix(s, 1, 12), hex(0, 0, 255));
    });
    await t('không có skin: vẽ hình người dự phòng (không lỗi)', () => {
        const s = composeSkin2D(null);
        assert.equal(pix(s, 7, 4)[3], 255);
    });

    console.log('\nẢnh listing:');
    await t('giá viết gọn + giờ Việt Nam', () => {
        assert.equal(formatPrice('150k'), '150K');
        assert.equal(formatPrice('150000'), '150K');
        assert.equal(formatPrice('1.2M'), '1.2M');
        assert.equal(formatPrice('140'), '140K');
        assert.equal(formatPrice('liên hệ'), 'LIÊN HỆ');
        assert.equal(stamp(new Date('2025-11-21T03:27:41Z')), '10:27:41 21/11/2025');
    });
    await t('render ra PNG 1671x941, tải cape + skin qua hàm truyền vào; 9 cape chỉ vẽ 8', async () => {
        const urls = [];
        const cape = createCanvas(10, 16); cape.getContext('2d').fillRect(1, 1, 8, 14);
        const buf = await renderListing({
            username: 'flnqdé', price: '150k',
            capes: Array.from({ length: 9 }, (_, i) => `<:Cape${i}:11111111111111111${i}>`).join(' ')
        }, {
            fetchBuffer: async (u) => { urls.push(u); return cape.toBuffer('image/png'); },
            fetchSkinTexture: async (n) => { assert.equal(n, 'flnqdé'); return fakeSkin(); },
            now: new Date('2025-11-21T03:27:41Z')
        });
        const img = await loadImage(buf);
        assert.equal(img.width, 1671); assert.equal(img.height, 941);
        assert.equal(urls.length, 8);
    });
    await t('không cape / tải skin lỗi / tên rất dài vẫn render được', async () => {
        const buf = await renderListing({ username: 'A'.repeat(40), price: 'abc', capes: '' }, {
            fetchBuffer: async () => null, fetchSkinTexture: async () => { throw new Error('mạng lỗi'); }
        });
        assert.ok(buf.length > 10000);
    });
    await t('chân trang đổi bằng LISTING_FOOTER, mặc định không có tên shop', async () => {
        const src = require('fs').readFileSync(path.join(root, 'utils/listingRenderer.js'), 'utf8');
        assert.ok(!/drew\s*store/i.test(src), 'code ảnh không chứa thương hiệu Drew Store');
        process.env.LISTING_FOOTER = 'Chân trang riêng';
        try { assert.ok((await renderListing({ username: 'x', price: '1k' }, { fetchBuffer: async () => null, fetchSkinTexture: async () => null })).length > 1000); }
        finally { delete process.env.LISTING_FOOTER; }
    });
    console.log(`\n${pass} kiểm thử đạt.`);
})().catch(e => { console.error('\n❌', e); process.exit(1); });
