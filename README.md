# Drew AutoBuy

Bot Discord bán tài khoản Minecraft: card ảnh, ticket, VietQR, giao hàng qua DM. Dữ liệu lưu ở MongoDB.

## Chạy 2 bot cho 2 server (BOT_PROFILE)
Cùng một code, mỗi server một bot riêng (token riêng), chọn bằng biến `BOT_PROFILE`. File mẫu: `.env.drew.example`, `.env.cartone.example`.

| Tính năng | `drew` (server Drew) | `cartone` (server Cartone) |
|---|---|---|
| Auto buy (BUY, ticket, Confirm, kho acc, VietQR, `/stock`, `/dang_anh`, `/add_acc`, `/set_qr`, `/restock`, `/skin`, `/moc_role`, `.panel`, `.close`, `.resend`, `.vietqr`, nhắc vouch) | ✅ | ✅ |
| Bảng xếp hạng + ghi doanh thu (`.bxh`, `/leaderboard`, `.done`, `/done`), **dữ liệu riêng từng server** | ✅ | ✅ |
| `sold`, `/set_kenhsold`, `.taokenh`, `.xoakenh` | ✅ | ✅ |
| Auto react legit (3 emoji) | ✅ | ✅ |
| Đếm số legit + đổi tên kênh `『✅』𝙑𝙤𝙪𝙘𝙝𝙚𝙨-<số>` (mặc định, chỉnh được bằng `/config legit_dem`) | ❌ (chỉ react) | ✅ (đếm) |
| Tên thương hiệu trong embed / DM | Drew Store | Zin Yeah Store |

- `.done @user <số tiền>` dùng được ở **mọi kênh** (vd `.done @khách 150k`). Riêng trong ticket đã ghi doanh thu (Confirm hoặc `.done` trước đó) thì bị chặn để không cộng trùng.
- `.close` (Staff/Owner): đóng được ticket trong DB **và mọi kênh có chữ `ticket` trong tên** (không phân biệt hoa thường). Kênh không có chữ ticket thì bot bỏ qua; người không phải Staff gõ `.close` ở kênh ticket sẽ bị từ chối.

- Ở chế độ `drew` / `cartone`, đếm legit chỉ khác ở giá trị **mặc định** (drew tắt, cartone bật). Cả hai đều bật / tắt được bằng `/config legit_dem`, lưu riêng từng server. Không đặt `BOT_PROFILE` (hoặc `full`) thì chạy như bản cũ, đủ mọi tính năng.
- `ALLOWED_GUILD_IDS=<id server>`: bot chỉ phục vụ server đó, bỏ qua mọi server khác (bot vẫn có thể ở server khác chỉ để dùng emoji).
- Bot không có tính năng nào thì lệnh slash đó **không được đăng ký** (lệnh cũ tự biến mất sau lần khởi động đầu), nút / lệnh prefix tương ứng bị bỏ qua.
- **Dữ liệu:** cho cả 2 bot dùng chung `MONGODB_URI`, `MONGODB_DB`, `MAIN_GUILD_ID`, `DATA_ENCRYPTION_KEY`, `OWNER_ID` như cũ thì dữ liệu mỗi server (khách, bxh, legit đếm, cấu hình) vẫn nguyên, không phải chuyển gì. Mỗi bot chỉ đọc / ghi dữ liệu của server mình.
- **Triển khai (VPS):** chạy 2 tiến trình cùng một code, mỗi bot một file env riêng (`.env.drew`, `.env.cartone`) khác `DISCORD_TOKEN`, `CLIENT_ID`, `BOT_PROFILE`, `ALLOWED_GUILD_IDS`, chỉ định file bằng `ENV_FILE` (xem mục *Deploy trên VPS*). Application Discord của mỗi bot đều phải bật **Message Content Intent**.
- **Emoji legit:** 3 emoji react là emoji của Drew Store. Bot Cartone phải ở chung server chứa emoji đó (đặt `ALLOWED_GUILD_IDS` để nó không hoạt động ở đó), hoặc up emoji vào server Cartone rồi đặt `LEGIT_REACT_EMOJIS`. Chạy `/config check_emoji` để kiểm tra.
- **Sao lưu `DATA_ENCRYPTION_KEY`** ở nơi an toàn (trình quản lý mật khẩu, ngoài VPS). Mất khóa là mất toàn bộ thông tin đăng nhập acc trong kho; đổi khóa thì acc cũ không giải mã được. Cả 2 bot phải dùng cùng một khóa.
- `DONE_MAX_AMOUNT` (mặc định 100000000): số tiền tối đa cho một lần `.done` / `/done` / dòng `.nhapbxh`, chặn gõ thừa số 0.
- `.close` chỉ đóng kênh có chữ `ticket` trong tên **và** không phải kênh hệ thống đã cấu hình (transcript, bill, kho, legit, hướng dẫn, danh mục sold).
- **Version tự tăng:** mỗi lần bot khởi động với code đã đổi (index.js, utils/, commands/, package.json) thì version tăng 0.1 và bot tự ghi vào **mô tả** của mình (`version: 1.3`, hiện ở phần About Me của bot). Restart hoặc deploy lại cùng code thì không tăng; chỉ sửa README / test cũng không tăng. Version lưu trong MongoDB nên 2 bot dùng chung DB luôn cùng số và chỉ tăng đúng 1 lần dù khởi động cùng lúc. Biến tùy chọn: `VERSION_STEP` (mặc định `0.1`, đặt `1` để tăng 1), `VERSION_START` (số khởi đầu khi DB chưa có, mặc định `1`), `VERSION_DESCRIPTION=off` (tắt).
- `npm test` có thêm `tests/profile.test.js` và `tests/profile-behavior.test.js` (mô phỏng tin nhắn cho từng chế độ).

## Cài đặt
1. `npm install`
2. Sao chép `.env.example` thành `.env` rồi điền giá trị (**không bao giờ commit `.env`**).
3. Tạo `DATA_ENCRYPTION_KEY`:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   Sao lưu khóa này. Mất khóa thì không đọc lại được thông tin đăng nhập đã mã hóa.
4. Discord Developer Portal → Bot → bật **Message Content Intent** (bắt buộc, bot cần đọc `.close`, `sold`, `+1 legit`).
5. `npm start`

## Biến môi trường (file `.env` trên VPS)
**Bắt buộc:** `DISCORD_TOKEN`, `CLIENT_ID`, `OWNER_ID`, `MONGODB_URI` (chuỗi kết nối MongoDB), `DATA_ENCRYPTION_KEY`

**Nên có:** `STAFF_ROLE_ID`, `STOCK_ID`, `TICKET_CATEGORY_ID`, `SOLD_CATEGORY_ID`, `BILL_ID`, `TRANSCRIPT_ID`, `AUTOREACTER_VOUCH` (kênh legit),
`KENH_VOUCH`, `KENH_YOUTUBE`, `KENH_2FA`, `KENH_LOCK`, `LINK_QR`, `LEGIT_START`, `VOUCH_MENTION_ID`

**Tùy chọn:** `BOT_PROFILE` (`drew` | `cartone`, xem mục *Chạy 2 bot*), `ALLOWED_GUILD_IDS`, `BXH_COOLDOWN_SEC` (30), `MAIN_GUILD_ID` (server chính, mặc định `1462789815333289986`, xem mục *Dữ liệu theo server*), `MONGODB_DB` (mặc định `autobuy`), `MAX_OPEN_TICKETS` (2), `LEGIT_COOLDOWN_SEC` (20), `LEGIT_REACT_EMOJIS`, `EMOJI_INFO/ONLINE/OFFLINE`

Các biến kênh/danh mục và `STAFF_ROLE_ID` cũng đặt được ngay trong Discord bằng `/config` và `/staff` (chỉ Owner), giá trị đặt bằng lệnh ưu tiên hơn biến môi trường.

## Dữ liệu theo server
Mỗi server có dữ liệu riêng: **khách + bảng xếp hạng + tổng tiền, kho tài khoản, ticket, QR (`/set_qr`), nhắc vouch**.
- **Server chính** (`MAIN_GUILD_ID`) dùng database cũ (`MONGODB_DB`), nên toàn bộ dữ liệu trước đây tự thuộc về server này, không phải chuyển gì.
- Server khác tự tạo database `<MONGODB_DB>_<ID server>` ở lần đầu bot hoạt động ở đó (tài khoản MongoDB cần quyền tạo database).
- Cấu hình (`/config`, `/staff`, `/owner`, bộ đếm legit, mốc role...) vẫn lưu chung trong `settings` vì khóa của chúng đã có ID server.
- Role mốc chi tiêu chỉ cấp ở server nơi khách mua, dựa trên tổng tiền của server đó.
- `npm run migrate` luôn ghi vào server chính.

### Phân quyền theo server
- **Owner gốc** (`OWNER_ID`) có quyền Owner ở **mọi** server.
- **Owner phụ** (`/owner add`) và **Staff** (`/staff add`, `/staff role`) chỉ có quyền ở **server nơi được thêm**. Chạy các lệnh này ngay trong server cần phân quyền.
- Danh sách chung cũ (`STAFF_USERS`, `OWNER_USERS`) tự chuyển thành danh sách của server chính ở lần khởi động đầu tiên sau khi cập nhật.
- `.bxh` giới hạn mỗi người 1 lần / 30 giây (đổi bằng biến `BXH_COOLDOWN_SEC`, `0` = tắt). Staff/Owner không bị giới hạn.

## Ticket
- Ticket **chỉ đóng khi Staff/Owner gõ `.close`** trong kênh ticket. Khách nhắn "legit" không làm ticket bị xóa.
- Nếu đơn đã Confirm mà DM chưa gửi được thì staff không đóng được (Owner đóng cưỡng bức được). Bấm **Gửi lại thông tin** hoặc gõ `.resend`.
- Mỗi khách mở tối đa `MAX_OPEN_TICKETS` đơn chưa xác nhận cùng lúc.

## Emoji của bot (`/emoji`)
Bot dùng 6 vị trí emoji: `online` (nút BUY / Cách mua), `offline` (dòng "Acc đã được bán"), `info` (dòng Seller trên card) và `legit1`, `legit2`, `legit3` (3 reaction legit). Ưu tiên **emoji custom** cho đẹp, emoji thường chỉ là phương án cuối khi emoji custom không dùng được.
- `/emoji check`: kiểm tra từng vị trí, bot có thấy emoji không, đang dùng emoji nào (và vị trí nào đang phải dùng emoji thường).
- `/emoji set vitri:<vị trí> emoji:<...>`: đặt emoji cho server này. Nhập bằng cách chọn từ bảng emoji, hoặc gõ **tên** emoji của server (vd `canhxanh`), hoặc dán mã `<:tên:id>` / ID. Bot từ chối emoji custom mà nó không thấy, để không gây lỗi `COMPONENT_INVALID_EMOJI`.
- `/emoji list`: xem các emoji custom của server mà bot dùng được. `/emoji reset vitri:<vị trí|all>`: về mặc định.
- Lưu riêng từng server trong MongoDB, không cần sửa `.env` hay khởi động lại. Nếu server chưa đặt thì dùng biến `EMOJI_ONLINE` / `EMOJI_OFFLINE` / `EMOJI_INFO` / `LEGIT_REACT_EMOJIS` (hoặc giá trị mặc định trong code). Chỉ Owner dùng được.

## Kênh legit
Tin có **`+1` kèm chữ `legit` hoặc `vouch`** (ở bất kỳ vị trí nào, hoa / thường đều được) thì bot: +1 bộ đếm, react 3 emoji (CanhXanh, minecraft_accept, CanhXanh), và đổi tên kênh thành `『✅』𝙑𝙤𝙪𝙘𝙝𝙚𝙨-<số>`.
Các cách viết đều nhận: `+1 legit @shop`, `+1legit @shop`, `legit +1 @shop`, `+ 1 legit`, `+1 vouch`, `+1 lgit`, `**+1 legit**`, `Cảm ơn shop, +1 legit @shop`... Không tính tin thiếu `+1` (ví dụ "shop này legit không?") hoặc chỉ có `+1` mà không có chữ legit / vouch. Muốn bắt buộc phải tag người bán thì đặt `LEGIT_REQUIRE_MENTION=true`. Muốn đổi tên kênh mà không sửa code thì đặt biến `LEGIT_CHANNEL_PREFIX` (mặc định `『✅』𝙑𝙤𝙪𝙘𝙝𝙚𝙨-`).
Discord chỉ cho đổi tên kênh 2 lần / 10 phút nên bot đổi tối đa 1 lần / ~5 phút (luôn lấy số mới nhất).
Bot cần ở server chứa các emoji trên, và có quyền Manage Channels, Add Reactions, Use External Emojis trong kênh legit.
Chỉnh số hiện tại bằng `/config legit_count so:632` (legit kế tiếp là 633).
Nếu thiếu emoji: chạy `/config check_emoji` để biết emoji nào bot không thấy và quyền còn thiếu. Khi 1 emoji lỗi, bot thả emoji thường thay thế để luôn đủ 3 reaction.

## Debug khi 1 server không react emoji
Bot chạy nhiều server thì **mỗi server phải có kênh legit riêng**. Kênh legit KHÔNG đặt bằng biến trong `.env`: mỗi server tự đặt bằng lệnh (chạy NGAY TRONG server đó):
`/config set muc:Kênh legit kenh:#kênh-legit`
Cách tìm nguyên nhân:
1. Chạy `/config debug` trong server không react: bot liệt kê kênh legit đang dùng, quyền còn thiếu, emoji nào không thấy, và các tin legit gần nhất bot đã nhận / bỏ qua (kèm lý do).
2. Xem log (`pm2 logs <tên bot>`). Mỗi dòng có dạng `thời gian [MỨC] [THẺ] nội dung key=value ...`, các thẻ quan trọng:
   - `[CHANDOAN]` chẩn đoán từng server lúc khởi động (thiếu kênh / thiếu quyền / emoji lỗi).
   - `[LEGIT]` mỗi tin legit: nhận tin, react từng emoji (kèm mã lỗi Discord và gợi ý), kết quả cuối, đổi tên kênh.
     Dòng `Có tin đúng mẫu "+1 legit" nhưng KHÔNG phải kênh legit của server này` = server đó chưa đặt kênh legit.
     Dòng `content RỖNG` = chưa bật Message Content Intent.
   - `[GATEWAY]`, `[RATELIMIT]` kết nối và giới hạn tốc độ; `[GUILD]` bot vào / rời server.
3. Đổi mức log bằng biến `LOG_LEVEL` (`debug` | `info` | `warn` | `error`).

## Role theo mốc chi tiêu
Khi tổng tiền khách đã mua (Confirm hoặc `.done`) đạt một mốc, bot tự cấp role tương ứng cho khách (ở mọi server có cấu hình mốc và khách đang ở trong server đó). Mỗi server cấu hình riêng (chỉ Owner):
- `/moc_role add tien:500k role:@Bạc` thêm / sửa mốc (nhập `500k`, `1tr`, `2.000.000`...). Cùng số tiền thì đổi role.
- `/moc_role remove tien:500k` xóa mốc (không gỡ role đã cấp). `/moc_role list` xem mốc và cảnh báo role lỗi.
- `/moc_role che_do`: **giữ tất cả** role các mốc đã đạt (mặc định) hoặc **chỉ giữ role mốc cao nhất** (gỡ role mốc thấp hơn).
- `/moc_role sync` quét mọi khách trong dữ liệu và cấp bù role (chạy 1 lần sau khi cài mốc, hoặc khi khách vào server sau khi đã mua).
- `/moc_role kiemtra khach:@user` xem tổng chi tiêu, mốc đã đạt và mốc kế tiếp của khách.
Bot cần quyền **Manage Roles** và role của bot phải nằm **cao hơn** các role mốc (Server Settings → Roles). Kết quả cấp role hiện ngay trong embed `.done` / tin giao dịch thành công, và có log thẻ `[MOC]`.

## Sau khi done đơn: tặng role, emoji tin legit, bill
- **Tặng role:** Owner đặt bằng `/config role_done role:@Role` (để trống ô role = tắt; xem trong `/config show`). Mỗi lần Confirm / `.done` / `/done`, bot tặng role này cho khách, **khách đã có rồi thì bỏ qua**. Role của bot phải nằm **cao hơn** role cần tặng, bot cần quyền Manage Roles.
- **Emoji tin legit:** sau khi done, bot tìm tin `+1 legit` mới nhất của khách trong kênh legit và thả 3 emoji legit + emoji tiền (`💰`). Khách legit **sau** khi đã mua thì tin legit đó cũng được thả thêm emoji tiền. Đổi emoji bằng `LEGIT_MONEY_EMOJI`, đặt `off` để tắt.
- **Bill:** embed gồm Buyer (mention + username), Seller, đơn giá, tài khoản stock, Rank, Capes, phương thức thanh toán, kênh (ticket + card), thời gian và khối **Note**. Khối Note (nằm trong embed card ở kênh stock, không nằm trong bill; không có dòng Card) đặt bằng biến, dòng nào chưa đặt kênh thì bị bỏ qua: kênh `BILL_KENH_DIEUKHOAN`, `BILL_KENH_DOITHONGTIN`, `BILL_KENH_2FA` (hoặc kênh 2FA của `/config`), `BILL_KENH_LUUY`; emoji `BILL_EMOJI_SET|NOTE|SETTINGS|KEY|WARNING` (mặc định emoji thường, nên dùng emoji của server bạn: `<:tên:id>`); `BILL_NOTE` (ghi chú chung), `BILL_FOOTER` (dòng nhỏ cuối Note).
- **Danh mục Sold tự mở rộng:** danh mục Sold đủ 50 kênh thì bot tự dùng / tạo `Sold 1`, `Sold 2`, ... (cùng quyền với danh mục gốc, thứ tự tăng dần) và chuyển kênh đã bán vào đó. Bot cần quyền Manage Channels.
- **Kênh mặc định:** kênh bill (`BILL_ID`) và 4 kênh của Note (điều khoản, cách đổi thông tin, nếu có 2fa, lưu ý) có sẵn trong `utils/constants.js` > `DEFAULT_CHANNELS`. Chỉ dùng khi chưa đặt biến / `/config` và kênh đó nằm trong server đang xử lý; biến `.env` hoặc `/config` luôn được ưu tiên.
- **`/dang_anh username price [capes]`:** giống `/stock acc` (lưu acc vào kho, tạo kênh tên theo giá trong danh mục `STOCK_ID`, đăng embed có ảnh + 2 nút Buy / Cách mua), nhưng ảnh là mẫu MFA listing (skin Minecraft 2D, danh sách cape, giá với đồng tiền vàng, không có thương hiệu shop) và embed không có Note. Chân trang ảnh đổi bằng `LISTING_FOOTER`. Nền ảnh `assets/listing_bg.png` tạo bằng `node scripts/gen-listing-bg.js`, font Jersey 15 (OFL) trong `assets/fonts`.
- **Card stock:** nền / viền ảnh card chuyển sang tông tím (`assets/bg1.png`), đồng tiền giữ màu vàng.

## Danh sách lệnh
**Prefix (gõ trong chat)**
| Lệnh | Ai dùng | Tác dụng |
|---|---|---|
| `.help` | mọi người | xem hướng dẫn (Staff/Owner thấy thêm lệnh) |
| `.av [@user \| id]` | mọi người | xem avatar |
| `.vietqr <số tiền> [ghi chú]` | Staff/Owner | tạo mã VietQR nhanh |
| `sold` (không có dấu chấm) | Staff/Owner (người tạo acc hoặc Owner) | đánh dấu kênh bán hàng đã bán ngoài hệ thống |
| `.done <@khách \| id> <số tiền> [số đơn]` | Staff/Owner | ghi doanh thu cho khách, cập nhật bảng xếp hạng (chống cộng trùng trong ticket) |
| `.taokenh <tên>` (hoặc `taokenh <tên>`) | Staff/Owner | tạo kênh mới `✅・tên`; bot hiện menu để chọn danh mục |
| `.xoakenh #kênh \| <id>` (hoặc `xoakenh ...`) | Staff/Owner | xóa kênh (chặn kênh hệ thống trong `/config` và card còn hàng / đang có đơn) |
| `.close` | Staff/Owner, trong ticket | đóng ticket |
| `.resend` | Staff/Owner/seller, trong ticket | gửi lại thông tin đăng nhập qua DM |
| `+1 legit @người_bán ...` | khách, trong kênh legit | không phải lệnh: bot tự đếm, react, đổi tên kênh |

**Slash**
| Lệnh | Ai dùng |
|---|---|
| `/add_acc`, `/stock acc`, `/dang_anh`, `/set_qr`, `/restock`, `/done`, `/leaderboard`, `/sticky set\|remove`, `/skin`, `/taokenh ten [danhmuc]`, `/xoakenh kenh\|id` | Staff/Owner |
| `/set_kenhsold`, `/config set\|clear\|show\|role_done\|debug\|legit_dem\|legit_count\|check_emoji`, `/staff add\|remove\|list\|role`, `/moc_role add\|remove\|list\|che_do\|sync\|kiemtra` | Owner |
| `/owner list`, `/bot_avatar [doi_ten]` | Owner |
| `/owner add\|remove` | Owner gốc (`OWNER_ID`) |

**Nút:** Confirm, Gửi lại thông tin (trong ticket), BUY, Cách mua (trên card), Làm mới (bảng xếp hạng).

## Lệnh cho Owner
- `/bot_avatar`: đổi **avatar bot** thành icon của server đang gõ lệnh (ảnh tĩnh PNG). Thêm `doi_ten:True` để đổi luôn **tên bot** thành tên thương hiệu của bot (bot Cartone / profile `cartone` giờ là **Zin Yeah Store**). Avatar và tên là của cả tài khoản bot, Discord giới hạn khoảng 2 lần đổi tên / giờ nên bot không tự đổi lúc khởi động.
- `/owner add|remove|list`: thêm / bớt **Owner phụ** (đủ quyền Owner). Chỉ Owner gốc (`OWNER_ID`) thêm / bớt được, Owner gốc không thể bị bỏ.
- `/staff add|remove|list|role`: quản lý Staff.
- `/config set|clear|show|legit_count`: quản lý kênh / danh mục của bot.
- `/config legit_dem bat|tat`: bật / tắt đếm số legit, lưu riêng theo ID từng server (mặc định: bot drew tắt, bot cartone / full bật). Server tắt: bot vẫn react emoji nhưng không đếm số và không đổi tên kênh. Server bật: đếm, react và đổi tên kênh như bình thường.
- Kênh legit đặt riêng cho từng server bằng `/config set muc:Kênh legit` (chạy ở server đó). Bộ đếm số legit cũng tách riêng theo server.
- Mỗi lần bot khởi động / deploy, bot tự quét lại kênh legit của tất cả server (100 tin mới nhất): tin đúng mẫu `+1 legit @người_bán ...` chưa được react thì react bù (server bật đếm thì đếm số theo thứ tự cũ → mới rồi đổi tên kênh), đồng thời cập nhật lại bảng xếp hạng.
- `.done` (hoặc `/done`): cộng doanh thu cho khách và sửa ngay bảng xếp hạng của mọi server. Mỗi ticket chỉ ghi doanh thu đúng 1 lần (dùng chung với nút Confirm).
- `/set_kenhsold danhmuc`: danh mục chứa kênh đã bán.

## Chuyển dữ liệu từ bản cũ (JSON)
`npm run migrate -- <thư_mục_bot_cũ>` (an toàn khi chạy lại, không ghi đè dữ liệu đã có).
Xong thì xóa thư mục bot cũ vì có chứa mật khẩu dạng chữ thường.

## Deploy trên VPS
- Cần Node.js >= 18 và MongoDB (cài trên VPS hoặc dùng Atlas); đặt `MONGODB_URI` trong file env.
- `git clone`, `npm install`, copy `.env.example` thành `.env` (hoặc `.env.drew.example` thành `.env.drew`, `.env.cartone.example` thành `.env.cartone`) rồi điền biến ở trên.
- Chạy 1 bot: `pm2 start index.js --name autobuy` (hoặc `npm start`). Chạy 2 bot: `ENV_FILE=.env.drew pm2 start index.js --name bot-drew` và `ENV_FILE=.env.cartone pm2 start index.js --name bot-cartone`, rồi `pm2 save` và `pm2 startup` để tự chạy lại khi VPS khởi động.
- Cập nhật code: `git pull && npm install && pm2 restart all`. Dữ liệu nằm trong MongoDB nên cập nhật hay đổi VPS không mất.
- Ổ đĩa VPS giữ nguyên giữa các lần chạy, nhưng vẫn **sao lưu MongoDB** (`mongodump`) và `DATA_ENCRYPTION_KEY`.
- Không commit `node_modules`, `.env`, `data/`, `kho.json` (đã có trong `.gitignore`).

## Kiểm thử
`npm test` chạy mô phỏng toàn bộ luồng mua bán (không cần Discord hay MongoDB thật).

## Thông tin đăng nhập tài khoản
- Lưu mã hóa AES-256-GCM (khóa dẫn xuất bằng scrypt), không lưu nguyên văn form. Dữ liệu mã hóa phiên bản cũ vẫn đọc được.
- Giao cho khách qua DM thành công thì bị xóa khỏi kho. DM lỗi thì giữ lại để staff bấm "Gửi lại thông tin".

- **Báo lỗi giao acc:** khi giao thông tin / hoàn tất đơn gặp lỗi (không giải mã được kho, không tìm thấy buyer, DM thất bại, lỗi giữa chừng khi Confirm hoặc `.resend`, không xóa được thông tin sau khi giao, không cập nhật card SOLD, không gửi được bill), bot nhắn riêng cho Owner và người bán kèm lý do. Lỗi không phải do buyer tắt DM thì còn đăng cảnh báo và gọi role staff ngay trong ticket. Cảnh báo không bao giờ chứa thông tin đăng nhập; chi tiết lỗi ghi ở log với nhãn `GIAO_ACC`.

- **`.setqr @user MB 0123456789 TEN CHU TK`** (chỉ Owner): cài thông tin VietQR hộ người khác, tương đương họ tự gõ `/set_qr`. Xem lại bằng `.setqr xem @user`. Số tài khoản 6-20 chữ số, tên chủ tài khoản tự viết hoa.
