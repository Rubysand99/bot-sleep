# Nhật ký cập nhật

Mỗi bản cập nhật / sửa lỗi thêm 1 mục "## ..." Ở TRÊN CÙNG (mới nhất ở trên). Khi bot khởi động bản mới (version tự tăng), bot gửi embed các mục chưa thông báo vào kênh thông báo.

## 26/11 · Phản hồi lệnh slash hiện công khai
- Mọi phản hồi của lệnh slash (kể cả báo lỗi, từ chối quyền) giờ ai trong kênh cũng thấy. Phản hồi khi bấm nút vẫn chỉ người bấm thấy.

## 26/11 · Bot Zin Yeah Store thả 5 emoji legit
- Bot Zin Yeah Store react tin legit bằng 5 emoji theo đúng thứ tự mới (thêm vị trí `legit4`, `legit5` trong `/emoji`). Bot Drew giữ nguyên 3 emoji.

## 26/11 · Nhân vật xoay trong GIF stock
- Nhân vật Minecraft trong GIF stock giờ xoay đủ 1 vòng (vẽ 3D từ file skin), bỏ vệt sáng. Không tải được skin thì dùng ảnh tĩnh như cũ.

## 26/11 · Lệnh /test_stock
- Thêm `/test_stock [username] [price] [rank] [capes]`: tạo thử ảnh stock GIF để xem trước (Staff/Owner, không đăng acc, kết quả chỉ mình bạn thấy).

## 26/11 · Embed giao acc theo mẫu, GIF có vệt sáng chạy
- Embed DM giao acc viết lại theo mẫu: Username / Rank / Capes, rồi Primary Email / Recovery Code / Security Email / Password / Secret Key (ô trống = NON), dòng `+1 legit @seller giá username`, kèm nút TOS / Secure / Sec 2FA / Tránh Lock (link tới kênh đã đặt).
- GIF stock thêm vệt sáng chạy ngang card để chuyển động luôn thấy rõ.

## 26/11 · Lệnh .tien cộng/trừ tiền
- `.tien @user số` (không dấu) để ĐẶT thẳng số tiền của khách.
- Thêm `.tien @user +số` để cộng và `.tien @user -số` để trừ tiền trong tổng chi tiêu (BXH) của khách (Staff/Owner, không xuống dưới 0, tự cập nhật BXH + role mốc).

## 26/11 · Sửa nền card stock GIF chuyển động
- Sửa lỗi nền GIF bị đứng hình: giờ dùng đúng 2 GIF nền gốc (không làm mờ), có animation như GIF mẫu.

## 26/11 · Ảnh stock GIF, DM giao acc đầy đủ, tự đóng ticket
- Card stock giờ là **GIF động**: nền random 1 trong 2 GIF, ghi tên bot đang chạy và `made by rubynek209`.
- DM giao acc cho buyer có ảnh stock + đủ thông tin đăng nhập + Seller / Buyer / Đơn giá. Bill dùng cùng ảnh nhưng **ẩn** thông tin đăng nhập.
- Ticket đã xác nhận đơn tự đóng sau **1 giờ** nếu không ai gõ `.close`.
- `/stock acc`: bắt buộc `sotien` + `seller`, thêm các ô nhập thông tin tài khoản (trống = NON).
- Bot tự nhận **Owner / Staff / Seller theo role** (`/staff role`). Chỉ 1 ID được bấm Confirm đơn.
