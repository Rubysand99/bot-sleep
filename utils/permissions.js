const { cfg, isExtraStaff, isExtraOwner } = require('./runtime');

const isValidSnowflake = (id) => typeof id === 'string' && /^\d{17,20}$/.test(id.trim());

// Owner gốc: đúng OWNER_ID trong biến môi trường (chỉ người này thêm / xóa được Owner phụ)
function isPrimaryOwner(userId) {
    const ownerId = process.env.OWNER_ID;
    return isValidSnowflake(ownerId) && String(userId) === ownerId.trim();
}

// Người này có role đã đặt cho mục `key` (OWNER_ROLE_ID / STAFF_ROLE_ID / SELLER_ROLE_ID, đặt bằng /staff role) ở server này không
function memberHasRole(member, key, guild) {
    const roleId = cfg(key, guild || member?.guild);
    return isValidSnowflake(roleId) && Boolean(member?.roles?.cache?.has(roleId.trim()));
}

// Owner gốc, Owner phụ (thêm bằng /owner add) hoặc người có role Owner (/staff role loai:Owner) đều có đủ quyền Owner
// guild = server (đối tượng hoặc ID). Owner phụ / role Owner chỉ có quyền ở server mà họ được thêm; Owner gốc có quyền ở mọi server.
// Role Owner: tìm trong bộ nhớ thành viên của server (người đang gõ lệnh / nhắn tin luôn có sẵn trong đó).
function isOwnerId(userId, guild) {
    if (isPrimaryOwner(userId) || isExtraOwner(userId, guild)) return true;
    const member = guild?.members?.cache?.get?.(String(userId));
    return member ? memberHasRole(member, 'OWNER_ROLE_ID', guild) : false;
}

// Người có quyền Owner: dùng khi đã có sẵn đối tượng member
function isOwnerMember(member) {
    if (!member) return false;
    return isOwnerId(member.id, member.guild) || memberHasRole(member, 'OWNER_ROLE_ID', member.guild);
}

// Owner, hoặc có role Staff, hoặc role Owner, hoặc được Owner thêm bằng /staff add
function checkStaffOrOwner(member) {
    if (!member) return false;
    return isOwnerMember(member) || memberHasRole(member, 'STAFF_ROLE_ID', member.guild) || isExtraStaff(member.id, member.guild);
}

// Role Seller (/staff role loai:Seller): được đăng bán acc và đứng tên seller, nhưng không có quyền Staff
function isSellerMember(member) {
    return Boolean(member) && memberHasRole(member, 'SELLER_ROLE_ID', member.guild);
}

// Người được đăng bán / đứng tên seller: Owner, Staff hoặc Seller
function canSell(member) {
    return checkStaffOrOwner(member) || isSellerMember(member);
}

module.exports = { isValidSnowflake, isPrimaryOwner, isOwnerId, isOwnerMember, checkStaffOrOwner, isSellerMember, canSell };
