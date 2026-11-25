// Đọc form dán (từng dòng "Nhãn: giá trị"). Thông tin đăng nhập tách riêng để mã hóa, KHÔNG lưu nguyên văn.
// Không bắt buộc có Username (dùng cho /stock acc: bỏ trống = NON).
function parseAccountFields(rawText) {
    const empty = { username: '', capes: '', rank: '', credentials: {}, hasCredentials: false };
    if (!rawText) return empty;

    const extract = (pattern) => {
        const regex = new RegExp(`(?:^|\\n)\\s*${pattern}\\s*:\\s*(.*)`, 'i');
        const match = rawText.match(regex);
        return match ? match[1].trim() : '';
    };

    const credentials = {
        recoveryCode: extract('Recovery Code'),
        primaryEmail: extract('Primary Email'),
        securityEmail: extract('Security Email'),
        secretKey: extract('Secret Key'),
        password: extract('Password')
    };
    const hasCredentials = Object.values(credentials).some(Boolean);

    return { username: extract('Username'), capes: extract('Capes'), rank: extract('Rank'), credentials, hasCredentials };
}

// Form của /add_acc: bắt buộc có dòng Username
function parseAccountForm(rawText) {
    const parsed = parseAccountFields(rawText);
    return parsed.username ? parsed : null;
}

function maskEmail(email) {
    if (!email) return 'N/A';
    const [name, domain] = String(email).split('@');
    if (!domain) return '***';
    return `${name.slice(0, 2)}***@${domain}`;
}

module.exports = { parseAccountForm, parseAccountFields, maskEmail };
