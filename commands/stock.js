const { 
    SlashCommandBuilder, 
    AttachmentBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType,
    EmbedBuilder, 
    MessageFlags,
    PermissionFlagsBits,
    OverwriteType 
} = require('discord.js');
const cardGif = require('../utils/cardGif');
const db = require('../utils/db');
const C = require('../utils/constants');
const { formatPriceDisplay } = require('../utils/money');
const { buildCardRow } = require('../utils/cardButtons');
const emojis = require('../utils/emojis');
const { canSell } = require('../utils/permissions');
const { cfg } = require('../utils/runtime');
const { buildStockNote } = require('../utils/stockNote');
const { parseAccountFields } = require('../utils/accountForm');
const crypto = require('crypto');

const EMOJI_RE = /<(?:a)?:[a-zA-Z0-9_]+:[0-9]+>/g;
const NON = 'NON';

// Cape nhập cách nhau bằng dấu phẩy (emoji hoặc tên). Trả về { text (lưu DB, '' nếu trống), emojis (vẽ lên card), count }
function parseCapes(raw) {
    const text = String(raw || '').trim();
    if (!text || text.toUpperCase() === NON) return { text: '', emojis: [], count: 0 };
    const emojis = Array.from(new Set(text.match(EMOJI_RE) || []));
    if (emojis.length) return { text: emojis.join(' '), emojis, count: emojis.length };
    const names = text.split(/[,\n]+/).map(x => x.trim()).filter(Boolean);
    return { text: names.join(', '), emojis: [], count: names.length };
}

// Ô nhập riêng luôn được ưu tiên hơn nhapnhanh; trống cả hai thì ''
const pick = (own, quick) => (String(own || '').trim() || String(quick || '').trim());

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stock')
        .setDescription('Quản lý hiển thị kho tài khoản')
        .addSubcommand(subcommand =>
            subcommand
                .setName('acc')
                .setDescription('Đăng bán tài khoản Minecraft và tùy chọn tạo kênh')
                // 2 giá trị bắt buộc
                .addStringOption(o => o.setName('sotien').setDescription('Số tiền bán (vd: 100k, 140000, 1.2M)').setRequired(true))
                .addUserOption(o => o.setName('seller').setDescription('Người bán (Owner, Staff hoặc Seller)').setRequired(true))
                // Tùy chọn
                .addBooleanOption(o => o.setName('kenh').setDescription('Tạo kênh mới theo giá trong danh mục Kho stock (mặc định: có)'))
                .addStringOption(o => o.setName('nhapnhanh').setDescription('Dán thông tin một tài khoản; ô nhập riêng được ưu tiên'))
                .addStringOption(o => o.setName('username').setDescription('Username Minecraft; bỏ trống là NON'))
                .addStringOption(o => o.setName('primaryemail').setDescription('Primary Email; bỏ trống là NON'))
                .addStringOption(o => o.setName('recoverycode').setDescription('Recovery Code; bỏ trống là NON'))
                .addStringOption(o => o.setName('securityemail').setDescription('Security Email; bỏ trống là NON'))
                .addStringOption(o => o.setName('password').setDescription('Password; bỏ trống là NON'))
                .addStringOption(o => o.setName('secretkey').setDescription('Secret Key; bỏ trống là NON'))
                .addStringOption(o => o.setName('capes').setDescription('Danh sách cape, cách nhau bằng dấu phẩy; bỏ trống là NON'))
                .addStringOption(o => o.setName('rank').setDescription('Rank; bỏ trống là NON'))
        ),

    resolveStockTarget,

    async execute(interaction) {
        return runStock(interaction);
    }
};

// /stock acc: tạo kênh theo giá trong danh mục STOCK_ID, đăng card (ảnh + Note + nút Buy / Cách mua).
async function runStock(interaction) {
    {
        if (!canSell(interaction.member)) {
            return await interaction.reply({ 
                content: '❌ Bạn không có quyền đăng bán tài khoản (chỉ dành cho Owner, Staff hoặc Seller)!', 
                flags: MessageFlags.Ephemeral 
            });
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        try {
            const opt = (name) => interaction.options.getString(name) || '';
            const price = opt('sotien').trim();
            const sellerUser = interaction.options.getUser('seller');
            const createChannel = interaction.options.getBoolean('kenh') !== false;

            // Seller phải là Owner / Staff / Seller (theo role của server này)
            const sellerMember = await interaction.guild.members.fetch(sellerUser.id).catch(() => null);
            if (!canSell(sellerMember)) {
                return await interaction.editReply({
                    content: `❌ <@${sellerUser.id}> không phải Owner / Staff / Seller nên không thể đứng bán!`
                });
            }
            const sellerId = sellerUser.id;

            // Thông tin tài khoản: ô nhập riêng > nhapnhanh
            const quick = parseAccountFields(opt('nhapnhanh'));
            const typedName = pick(opt('username'), quick.username);
            const hasName = Boolean(typedName) && typedName.toUpperCase() !== NON;
            // Không có username thì hiện NON trên card, nhưng cần mã riêng để nút Buy / kho không bị trùng giữa các acc
            const username = hasName ? typedName : NON;
            const accountKey = hasName ? typedName : `non${crypto.randomBytes(3).toString('hex')}`;

            const credentials = {
                primaryEmail: pick(opt('primaryemail'), quick.credentials.primaryEmail),
                recoveryCode: pick(opt('recoverycode'), quick.credentials.recoveryCode),
                securityEmail: pick(opt('securityemail'), quick.credentials.securityEmail),
                password: pick(opt('password'), quick.credentials.password),
                secretKey: pick(opt('secretkey'), quick.credentials.secretKey)
            };
            for (const k of Object.keys(credentials)) if (credentials[k].toUpperCase() === NON) credentials[k] = '';
            const hasCredentialsNow = Object.values(credentials).some(Boolean);

            const storedAcc = await db.getAccount(accountKey);
            if (storedAcc?.status === 'PROCESSING') {
                return await interaction.editReply({
                    content: '⏳ Tài khoản này đang có đơn giao dịch, không thể đăng lại card lúc này!'
                });
            }

            // Tách các emoji nếu người dùng vô tình dán vào ô rank
            const rawRank = pick(opt('rank'), quick.rank);
            const rankEmojis = (rawRank.match(EMOJI_RE) || []).join(' ');
            const rank = rawRank.replace(EMOJI_RE, '').trim() || NON;

            // Capes: ô riêng > nhapnhanh > cape đã lưu trong kho > emoji lẫn trong rank
            let capesInfo = parseCapes(pick(opt('capes'), quick.capes));
            if (!capesInfo.count && storedAcc?.capes) capesInfo = parseCapes(storedAcc.capes);
            if (!capesInfo.count && rankEmojis) capesInfo = parseCapes(rankEmojis);
            const capes = capesInfo.text;

            const botUser = interaction.client?.user;
            const { buffer: imageBuffer, name: cardFileName } = await cardGif.renderStockCard({
                username,
                price,
                rank,
                capes,
                botName: botUser?.displayName || botUser?.username || 'BOT',
                botAvatarUrl: botUser?.displayAvatarURL?.({ extension: 'png', size: 128 }) || null
            });

            if (!imageBuffer) {
                return await interaction.editReply({ content: '❌ Không thể tạo ảnh card!' });
            }

            // Lưu tài khoản TRƯỚC khi đăng card. Nếu giữa chừng có người vừa mở đơn (PROCESSING) thì dừng,
            // không bao giờ ghi đè trạng thái đang giao dịch về AVAILABLE.
            const saved = await db.upsertAccount(
                { username: accountKey, price, rank, capes, sellerId, status: 'AVAILABLE' },
                hasCredentialsNow ? credentials : null
            );
            if (!saved) {
                return await interaction.editReply({
                    content: '⏳ Tài khoản này vừa có người mở đơn giao dịch, không thể đăng lại card lúc này!'
                });
            }

            const attachment = new AttachmentBuilder(imageBuffer, { 
                name: cardFileName,
                description: `Minecraft Card: ${username}`
            });

            // Gói card trong Embed và thêm dòng Seller
            const stockNote = buildStockNote({ guild: interaction.guild });
            const embed = new EmbedBuilder()
                .setDescription(`${emojis.text('info', interaction.guildId)} **Seller:** <@${sellerId}>` + (stockNote ? `\n\n${stockNote}` : ''))
                .setImage(`attachment://${cardFileName}`)
                .setColor('#2b2d31');

            const row = buildCardRow('available', accountKey, interaction.guildId);

            const capeCount = capesInfo.count;
            const priceDisplay = formatPriceDisplay(price);

            // Xác định vị trí đăng (danh mục STOCK_ID: tạo kênh mới theo giá; kênh: đăng thẳng; chưa đặt: đăng tại chỗ)
            const { targetChannel, isDifferentChannel } = await resolveStockTarget(interaction, `✅・${priceDisplay}・${capeCount}-cape`, { createChannel });

            let replyMessage;
            if (isDifferentChannel) {
                replyMessage = await targetChannel.send({
                    embeds: [embed],
                    files: [attachment],
                    components: [row]
                });

                await interaction.editReply({
                    content: `✅ **Đã tạo kênh và đăng card \`${accountKey}\` thành công!** Xem tại: <#${targetChannel.id}>`
                });
            } else {
                replyMessage = await interaction.editReply({ 
                    embeds: [embed],
                    files: [attachment],
                    components: [row]
                });
            }

            // Cập nhật thông tin vào DB
            await db.updateAccount(accountKey, {
                cardMessageId: replyMessage.id,
                cardChannelId: replyMessage.channelId
            });

            if (!hasCredentialsNow && !storedAcc?.hasCredentials) {
                await interaction.followUp({
                    content: '⚠️ Tài khoản này **chưa có thông tin đăng nhập** trong kho. ' +
                             'Hãy nhập thêm `password`, `primaryemail`... (hoặc dùng `/add_acc`), nếu không khi khách mua bot sẽ không tự gửi DM được.' +
                             (hasName ? '' : `\nMã acc trong kho: \`${accountKey}\` (card hiện NON).`),
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            } else if (!hasName) {
                await interaction.followUp({
                    content: `ℹ️ Mã acc trong kho: \`${accountKey}\` (card hiện NON).`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            }

        } catch (error) {
            console.error('[LỖI STOCK ACC]:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ Đã xảy ra lỗi: ${error.message}` }).catch(() => null);
            }
        }
    }
}

// Tìm nơi đăng card theo STOCK_ID. Dùng chung cho /stock acc và /dang_anh.
// createChannel=false: danh mục STOCK_ID không tạo kênh mới, đăng ngay tại kênh đang gõ lệnh.
// Trả về { targetChannel, isDifferentChannel }; channelName = tên kênh nếu STOCK_ID là danh mục (sẽ tạo kênh mới).
async function resolveStockTarget(interaction, channelName, { createChannel = true } = {}) {
    const ownerId = process.env.OWNER_ID;
    const staffRoleId = cfg('STAFF_ROLE_ID', interaction.guild);
    const stockId = cfg('STOCK_ID', interaction.guild);
    let targetChannel = interaction.channel;
    let isDifferentChannel = false;

    if (stockId && /^\d{17,20}$/.test(stockId.trim())) {
        try {
            const cleanStockId = stockId.trim();
            const target = interaction.guild.channels.cache.get(cleanStockId) || 
                           await interaction.guild.channels.fetch(cleanStockId).catch(() => null);

            if (target) {
                if (target.type === ChannelType.GuildText || target.type === ChannelType.GuildAnnouncement) {
                    targetChannel = target;
                    isDifferentChannel = (targetChannel.id !== interaction.channelId);
                } else if (target.type === ChannelType.GuildCategory && createChannel) {
                    
                    const permissionOverwrites = [
                        {
                            id: interaction.guild.roles.everyone.id,
                            type: OverwriteType.Role,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                            deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
                        },
                        {
                            id: interaction.client.user.id,
                            type: OverwriteType.Member,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.EmbedLinks,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.ManageMessages
                            ]
                        },
                        {
                            id: interaction.user.id,
                            type: OverwriteType.Member,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.ManageMessages,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.EmbedLinks,
                                PermissionFlagsBits.ReadMessageHistory
                            ]
                        }
                    ];

                    if (staffRoleId && /^\d{17,20}$/.test(staffRoleId.trim())) {
                        permissionOverwrites.push({
                            id: staffRoleId.trim(),
                            type: OverwriteType.Role,
                            deny: [
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.ManageMessages
                            ]
                        });
                    }

                    if (ownerId && /^\d{17,20}$/.test(ownerId.trim()) && ownerId.trim() !== interaction.user.id) {
                        permissionOverwrites.push({
                            id: ownerId.trim(),
                            type: OverwriteType.Member,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.ManageMessages,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.EmbedLinks,
                                PermissionFlagsBits.ReadMessageHistory
                            ]
                        });
                    }

                    targetChannel = await interaction.guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        parent: target.id,
                        permissionOverwrites
                    });
                    isDifferentChannel = true;
                }
            }
        } catch (err) {
            console.error('[LỖI STOCK_ID]:', err);
        }
    }
    return { targetChannel, isDifferentChannel };
}
