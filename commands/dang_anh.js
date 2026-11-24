const { SlashCommandBuilder } = require('discord.js');
const { runStock } = require('./stock');

// Giống /stock acc: tạo kênh theo giá (✅・150K・1-cape) trong danh mục STOCK_ID, đăng embed có ảnh mẫu MFA + 2 nút (Buy / Cách mua).
// Khác: ảnh là mẫu listing (skin 2D, danh sách cape, giá) và embed không có Note.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('dang_anh')
        .setDescription('Đăng bán acc bằng ảnh mẫu MFA: tạo kênh theo giá + nút Buy (như /stock, không Note)')
        .addStringOption(o => o.setName('username').setDescription('Tên tài khoản Minecraft').setRequired(true))
        .addStringOption(o => o.setName('price').setDescription('Giá bán (vd: 150k, 140000, 1.2M)').setRequired(true))
        .addStringOption(o => o.setName('capes').setDescription('Emoji capes (để trống = lấy từ kho nếu đã /add_acc)').setRequired(false)),

    async execute(interaction) {
        return runStock(interaction, { listing: true });
    }
};
