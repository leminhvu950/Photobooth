# SnapJoy Photobooth

Một photobooth chạy hoàn toàn trên trình duyệt. Ảnh được xử lý cục bộ và không tải lên máy chủ.

## Chạy thử

Camera chỉ hoạt động trong `localhost` hoặc HTTPS. Không mở trực tiếp file `index.html`.

Nếu máy đã có Python:

```powershell
python -m http.server 8080
```

Sau đó mở `http://localhost:8080` bằng Chrome, Edge hoặc Safari và cấp quyền camera.

Nếu máy đã có Node.js:

```powershell
npx serve .
```

## Triển khai lên Render

Dự án có sẵn `render.yaml` và script `scripts/build-static.mjs`. Render sẽ tạo thư mục `dist/`, phát hành website dưới dạng Static Site và tự triển khai lại sau mỗi lần push.

1. Đưa thư mục dự án lên một GitHub repository.
2. Trong Render, chọn **New → Blueprint** và kết nối repository đó.
3. Render sẽ đọc `render.yaml`; kiểm tra service có tên `snapjoy-photobooth` rồi chọn **Apply**.
4. Sau khi trạng thái chuyển thành **Live**, mở URL dạng `https://snapjoy-photobooth.onrender.com` và kiểm tra thêm `/admin/` ở cuối URL.
5. Để dùng tên miền riêng, mở **Settings → Custom Domains** của Static Site và làm theo bản ghi DNS Render cung cấp.

Có thể kiểm tra bản build trước khi push:

```powershell
node scripts/build-static.mjs
python -m http.server 8080 --directory dist
```

Sau đó mở `http://localhost:8080/` và `http://localhost:8080/admin/`.

## Tính năng hiện có

- Quy trình 4 bước: chọn kiểu ảnh, chọn frame tương thích, chụp ảnh và nhận ảnh.
- Camera trực tiếp, chọn camera và lật gương.
- Bố cục 1 ảnh, dải 3 ảnh hoặc lưới 4 ảnh.
- Đếm ngược 3/5/10 giây, âm báo và hiệu ứng flash.
- Bốn phong cách màu, bốn kiểu khung (Tối giản, Film, Tình yêu, Lễ hội) và màu khung tùy chỉnh.
- Xuất PNG chất lượng cao, chia sẻ qua Web Share và in.
- Lưu tùy chọn trên thiết bị, chạy responsive và hỗ trợ bàn phím.
- PWA có thể cài lên thiết bị và mở lại offline.
- Dashboard quản trị tại `/admin/`, có mật khẩu riêng trên thiết bị.
- Thống kê tổng lượt chụp, lượt hôm nay, doanh thu đã nhận và hoạt động 7 ngày.
- Danh sách phiên chụp cho phép đổi trạng thái `Đã thu`, `Chưa thu` hoặc `Miễn phí`.
- Tải lên, xem, sử dụng và xóa khung PNG/WebP riêng.
- Cài đặt tên photobooth, giá mỗi lượt và đổi mật khẩu admin.

## Trang quản trị

1. Mở `/admin/`. Ở lần đầu tiên, tạo mật khẩu admin có ít nhất 6 ký tự.
2. Đặt giá mỗi lượt tại **Cài đặt**. Một phiên chụp hoàn tất sẽ tự động được ghi vào lịch sử; nếu giá lớn hơn 0, phiên mặc định được tính là đã thu.
3. Mở **Lượt chụp** để kiểm tra lịch sử hoặc đổi trạng thái thanh toán. Chỉ các phiên ở trạng thái **Đã thu** được cộng vào doanh thu.
4. Mở **Khung ảnh** để thêm frame riêng hoặc chọn một frame rồi quay lại photobooth.

Mật khẩu, lịch sử, doanh thu, cài đặt và frame đều được lưu cục bộ trong trình duyệt hiện tại. Đây là lớp khóa dành cho kiosk trên một thiết bị, không thay thế hệ thống tài khoản phía máy chủ. Nếu quên mật khẩu, cần xóa dữ liệu trang web để thiết lập lại; thao tác này cũng xóa lịch sử và frame.

## Thêm khung tùy chỉnh

1. Mở `/admin/`, đăng nhập hoặc tạo mật khẩu ở lần dùng đầu tiên, rồi chọn **Khung ảnh**.
2. Đặt tên, chọn bố cục phù hợp và tải file PNG/WebP tối đa 8 MB.
3. Nên dùng ảnh có nền trong suốt và đúng tỷ lệ của bố cục được chọn.
4. Khung được lưu trong IndexedDB của trình duyệt hiện tại; xóa dữ liệu trang web cũng sẽ xóa các khung này.

Kích thước thiết kế khuyến nghị: `1200×1500` cho 1 ảnh, `900×1800` cho dải 3 ảnh và `1200×1600` cho lưới 4 ảnh. Vùng trong suốt là nơi ảnh chụp sẽ hiện ra.

Khi chạy cục bộ, trang quản trị nằm tại `http://localhost:8080/admin/`. Khi triển khai ở domain gốc, đường dẫn tương ứng là `https://snapjoy.com/admin/`. Hai trang phải cùng domain để dùng chung thư viện IndexedDB.

## Đưa vào kiosk thực tế

1. Mở trang bằng HTTPS hoặc `localhost` trên máy photobooth.
2. Cấp quyền camera một lần và cài PWA từ menu trình duyệt.
3. Dùng nút toàn màn hình ở góc trên bên phải.
4. Trong hộp thoại in, chọn máy in ảnh và cấu hình khổ giấy/không viền phù hợp.

Với DSLR, máy in tự động không hiện hộp thoại, thanh toán QR hoặc quản trị album trên cloud, nên bọc giao diện này bằng Electron/Tauri và thêm một dịch vụ cục bộ để điều khiển phần cứng.

## Cấu trúc

```text
index.html           Giao diện và nội dung
styles.css           Thiết kế responsive/kiosk
app.js               Camera, chụp, ghép ảnh, tải/chia sẻ/in
admin/                Dashboard lượt chụp, doanh thu, frame và cài đặt
manifest.webmanifest Cấu hình cài đặt PWA
sw.js                Bộ nhớ đệm offline
icon.svg              Biểu tượng ứng dụng
```
