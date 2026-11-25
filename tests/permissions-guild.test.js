// Kiểm tra Staff / Owner phụ tách theo từng server (chỉ cần db + config + permissions, MongoDB giả).
process.env.DATA_ENCRYPTION_KEY = 'test-key-test-key-test-key-1234';
process.env.MONGODB_URI = 'mongodb://fake';
process.env.MAIN_GUILD_ID = 'MAIN';
process.env.OWNER_ID = '111111111111111111';
delete process.env.STAFF_ROLE_ID;

const assert = require('assert');
const Module = require('module');
const { FakeMongoClient } = require('./fakeMongo');
const origLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === 'mongodb') return { MongoClient: FakeMongoClient };
    return origLoad.call(this, request, ...rest);
};
const db = require('../utils/db');
const cfg = require('../utils/config');
const runtime = require('../utils/runtime');
const { isOwnerId, isOwnerMember, checkStaffOrOwner, isSellerMember, canSell } = require('../utils/permissions');

const member = (id, guildId) => ({ id, guild: { id: guildId }, roles: { cache: { has: () => false } } });
const A = '800000000000000001', B = '800000000000000002', PRIMARY = '111111111111111111';

(async () => {
    await db.connect();

    // Dữ liệu cũ (danh sách chung) chuyển về server chính khi nạp cấu hình
    await db.saveSetting('STAFF_USERS', [A]);
    await db.saveSetting('OWNER_USERS', [B]);
    await cfg.loadConfig();
    assert.equal(runtime.isExtraStaff(A, 'MAIN'), true);
    assert.equal(runtime.isExtraStaff(A, 'OTHER'), false);
    assert.equal(isOwnerId(B, 'MAIN'), true);
    assert.equal(isOwnerId(B, 'OTHER'), false);
    assert.equal(await db.getSetting('STAFF_USERS'), null, 'khóa chung cũ phải bị xóa sau khi chuyển');
    assert.deepEqual(await db.getSetting('STAFF_USERS@MAIN'), [A]);

    // Thêm Staff ở server khác không ảnh hưởng server chính
    assert.equal(await cfg.addStaffUser(B, 'OTHER'), true);
    assert.equal(await cfg.addStaffUser(B, 'OTHER'), false);
    assert.equal(checkStaffOrOwner(member(B, 'OTHER')), true);
    assert.equal(checkStaffOrOwner(member(B, 'MAIN')), true, 'B là Owner phụ của MAIN nên vẫn có quyền ở MAIN');
    assert.equal(checkStaffOrOwner(member(A, 'OTHER')), false, 'Staff của MAIN không có quyền ở OTHER');
    assert.equal(checkStaffOrOwner(member(A, 'MAIN')), true);

    // Owner gốc có quyền ở mọi server
    assert.equal(isOwnerId(PRIMARY, 'MAIN'), true);
    assert.equal(isOwnerId(PRIMARY, 'OTHER'), true);
    assert.equal(isOwnerId(PRIMARY), true);
    // Không truyền server thì Owner phụ KHÔNG có quyền
    assert.equal(isOwnerId(B), false);

    // Xóa
    assert.equal(await cfg.removeStaffUser(B, 'OTHER'), true);
    assert.equal(checkStaffOrOwner(member(B, 'OTHER')), false);
    assert.equal(await db.getSetting('STAFF_USERS@OTHER'), null);

    // Lưu bền: nạp lại sau khi khởi động
    await cfg.addOwnerUser(A, 'OTHER');
    await cfg.loadConfig();
    assert.equal(isOwnerId(A, 'OTHER'), true);
    assert.equal(isOwnerId(A, 'THIRD'), false);

    // Tự nhận Owner / Staff / Seller theo role (mỗi server đặt riêng, role ở server khác không có tác dụng)
    const R_OWNER = '900000000000000001', R_STAFF = '900000000000000002', R_SELLER = '900000000000000003';
    await cfg.setConfig('OWNER_ROLE_ID', R_OWNER, 'RG');
    await cfg.setConfig('STAFF_ROLE_ID', R_STAFF, 'RG');
    await cfg.setConfig('SELLER_ROLE_ID', R_SELLER, 'RG');
    const C1 = '800000000000000011', C2 = '800000000000000012', C3 = '800000000000000013', C4 = '800000000000000014';
    const rg = { id: 'RG', members: { cache: new Map() } };
    const withRoles = (id, roles, g = rg) => {
        const m = { id, guild: g, roles: { cache: { has: (r) => roles.includes(r) } } };
        g.members?.cache.set(id, m);
        return m;
    };
    const mOwner = withRoles(C1, [R_OWNER]), mStaff = withRoles(C2, [R_STAFF]), mSeller = withRoles(C3, [R_SELLER]), mNone = withRoles(C4, []);
    assert.equal(isOwnerMember(mOwner), true); assert.equal(isOwnerId(C1, rg), true, 'isOwnerId nhận role Owner');
    assert.equal(checkStaffOrOwner(mOwner), true);
    assert.equal(isOwnerId(C2, rg), false); assert.equal(checkStaffOrOwner(mStaff), true);
    assert.equal(isSellerMember(mSeller), true); assert.equal(canSell(mSeller), true);
    assert.equal(checkStaffOrOwner(mSeller), false, 'Seller không có quyền Staff');
    assert.equal(isOwnerId(C3, rg), false);
    assert.equal(canSell(mNone), false); assert.equal(canSell(mStaff), true); assert.equal(canSell(mOwner), true);
    // role ở server này không có tác dụng ở server khác
    const other = { id: 'ROLE_OTHER', members: { cache: new Map() } };
    assert.equal(isOwnerId(C1, withRoles(C1, [R_OWNER], other)), false);
    assert.equal(canSell(withRoles(C3, [R_SELLER], other)), false);
    // bỏ role khỏi người thì mất quyền ngay (không cần khởi động lại)
    const m2 = { id: C4, guild: rg, roles: { cache: { has: () => false } } };
    rg.members.cache.set(C4, m2);
    assert.equal(isOwnerId(C4, rg), false);
    assert.equal(canSell(m2), false);

    console.log('✅ permissions-guild: tất cả kiểm tra đạt');
    await db.close();
})().catch(e => { console.error('❌', e); process.exit(1); });
