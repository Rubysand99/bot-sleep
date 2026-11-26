# Nhật ký cập nhật

Mỗi bản cập nhật / sửa lỗi thêm 1 mục "## ..." Ở TRÊN CÙNG (mới nhất ở trên). Khi bot khởi động bản mới (version tự tăng), bot gửi embed các mục chưa thông báo vào kênh thông báo.

## 26/11 · Lệnh .tien cộng/trừ tiền
- Thêm `.tien @user +số` để cộng và `.tien @user -số` để trừ tiền trong tổng chi tiêu (BXH) của khách (Staff/Owner, không xuống dưới 0, tự cập nhật BXH + role mốc).

## 26/11 · Sửa nền card stock GIF chuyển động
- Sửa lỗi nền GIF bị đứng hình: giờ dùng đúng 2 GIF nền gốc (không làm mờ), có animation như GIF mẫu.

## 26/11 · Ảnh stock GIF, DM giao acc đầy đủ, tự đóng ticket
- Card stock giờ là **GIF động**: nền random 1 trong 2 GIF, ghi tên bot đang chạy và `made by rubynek209`.
- DM giao acc cho buyer có ảnh stock + đủ thông tin đăng nhập + Seller / Buyer / Đơn giá. Bill dùng cùng ảnh nhưng **ẩn** thông tin đăng nhập.
- Ticket đã xác nhận đơn tự đóng sau **1 giờ** nếu không ai gõ `.close`.
- `/stock acc`: bắt buộc `sotien` + `seller`, thêm các ô nhập thông tin tài khoản (trống = NON).
- Bot tự nhận **Owner / Staff / Seller theo role** (`/staff role`). Chỉ 1 ID được bấm Confirm đơn.
