# SnapJoy Photobooth

Một photobooth chạy hoàn toàn trên trình duyệt. Ảnh và video tạo dáng được xử lý ngay trên thiết bị và không tải lên máy chủ nào — trừ khi bạn chủ động bật tính năng chia sẻ QR (xem mục **Chia sẻ ảnh và video qua mã QR**).

## Chạy thử

Camera chỉ hoạt động trong `localhost` hoặc HTTPS. Không mở trực tiếp file `index.html`.

Nếu máy đã có Python:

```powershell
python -m http.server 8080
```

Sau đó mở `http://localhost:8080` bằng Chrome, Edge hoặc Safari và cấp quyền camera.

Nếu máy đã có Node.js:

```powershell
npm install
npm start
```

`npm start` chạy máy chủ chia sẻ cục bộ (mặc định cổng 8080) và tự build `dist/`. Máy chủ này bật thêm tính năng chia sẻ ảnh/video qua mã QR cho điện thoại.

Nếu chỉ muốn xem nhanh giao diện mà không cần chia sẻ QR:

```powershell
npx serve .
```

## Triển khai lên GitHub Pages

Dự án có sẵn workflow `.github/workflows/deploy-pages.yml`. Mỗi lần mã được push lên nhánh `main`, GitHub Actions sẽ chạy `scripts/build-static.mjs`, tạo thư mục `dist/` và phát hành website tự động.

1. Tạo một GitHub repository, ví dụ `snapjoy-photobooth`, rồi push dự án lên nhánh `main`.
2. Trong repository, mở **Settings → Pages**.
3. Tại **Build and deployment → Source**, chọn **GitHub Actions**.
4. Mở tab **Actions**, chọn workflow **Deploy SnapJoy to GitHub Pages** và chờ cả hai job `build` và `deploy` hoàn tất.
5. Website sẽ có địa chỉ dạng `https://TEN_GITHUB.github.io/snapjoy-photobooth/`; trang quản trị nằm tại `https://TEN_GITHUB.github.io/snapjoy-photobooth/admin/`.

GitHub Pages tự cấp HTTPS cho tên miền `github.io`, vì vậy camera có thể yêu cầu quyền truy cập trong trình duyệt. Nếu dùng tên miền riêng, cấu hình tại **Settings → Pages → Custom domain** rồi bật **Enforce HTTPS**.

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
- Tự động quay video không âm thanh trong lúc khách tạo dáng, cho phép xem lại và tải xuống sau phiên chụp.
- Bốn phong cách màu, bốn kiểu khung (Tối giản, Film, Tình yêu, Lễ hội) và màu khung tùy chỉnh.
- Xuất PNG chất lượng cao, chia sẻ qua Web Share và in.
- Chia sẻ ảnh và video sang điện thoại bằng mã QR — chạy `npm start` trong cùng mạng Wi-Fi hoặc trỏ tới máy chủ chia sẻ công khai.
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

## Chia sẻ ảnh và video qua mã QR

Khách quét mã QR để tải ảnh PNG và video tạo dáng về điện thoại. Máy chủ chia sẻ lưu tạm file, liên kết tự hết hạn sau 30 phút rồi file bị xóa. Có hai cách chạy.

### Cách 1: máy chủ cục bộ, cùng mạng Wi-Fi

1. Chạy `npm start` trên máy photobooth rồi mở `http://localhost:8080` bằng trình duyệt.
2. Sau khi chụp xong, ở bước **Nhận ảnh** bấm **Tạo QR tải ảnh** (kèm video nếu phiên chụp có video tạo dáng).
3. Cho khách quét mã bằng camera điện thoại. Điện thoại phải kết nối cùng mạng Wi-Fi với máy photobooth.
4. Nếu máy không tự nhận địa chỉ Wi-Fi, đặt `SNAPJOY_SHARE_HOST` theo IP của máy, ví dụ `SNAPJOY_SHARE_HOST=192.168.1.20`. Đổi cổng bằng `SNAPJOY_PORT=9000`.

### Cách 2: máy chủ chia sẻ công khai, dùng cho GitHub Pages

GitHub Pages chỉ phát file tĩnh nên không chạy được máy chủ chia sẻ. Hãy triển khai `scripts/local-share-server.mjs` lên một host Node (ví dụ Render), rồi trỏ photobooth tới host đó.

1. Vào Render, chọn **New → Blueprint** và kết nối repository này. Render đọc `render.yaml` và tạo service `snapjoy-share`.
2. Kiểm tra biến `SNAPJOY_ALLOWED_ORIGIN` là địa chỉ web photobooth, ví dụ `https://leminhvu950.github.io`. Nhiều giá trị thì phân tách bằng dấu phẩy; giá trị mặc định `*` cho phép mọi origin.
3. Chờ deploy xong rồi chép địa chỉ service, ví dụ `https://snapjoy-share.onrender.com`.
4. Trong `app.js`, đặt `SHARE_API_BASE` bằng địa chỉ đó (không có dấu `/` ở cuối), rồi push lên `main` để GitHub Pages deploy lại.
5. Mở web photobooth, chụp xong và bấm **Tạo QR tải ảnh**. Khách quét mã bằng điện thoại có internet, không cần cùng mạng Wi-Fi.

Biến môi trường của máy chủ chia sẻ:

| Biến | Ý nghĩa |
| --- | --- |
| `PORT`, `SNAPJOY_PORT` | Cổng máy chủ, mặc định `8080`. Render tự đặt `PORT`. |
| `SNAPJOY_PUBLIC_URL` | Địa chỉ công khai ghi vào mã QR. Trên Render tự dùng `RENDER_EXTERNAL_URL`. |
| `SNAPJOY_SHARE_HOST` | Địa chỉ ghi vào mã QR ở chế độ cục bộ, ví dụ `192.168.1.20`. |
| `SNAPJOY_ALLOWED_ORIGIN` | Các origin được phép gọi API, phân tách bằng dấu phẩy; mặc định `*`. |
| `SNAPJOY_DATA_DIR` | Thư mục lưu thư viện frame dùng chung (`frames.json`), mặc định là `data/` trong project. |

Ở chế độ công khai, ảnh và video được tải lên host trong thời gian ngắn (tối đa 30 phút) trước khi bị xóa. Gói free của Render sẽ "ngủ" sau khoảng 15 phút không dùng, nên lần bấm QR đầu tiên có thể phải chờ máy chủ khởi động lại.

## Thêm khung tùy chỉnh

1. Mở `/admin/`, đăng nhập hoặc tạo mật khẩu ở lần dùng đầu tiên, rồi chọn **Khung ảnh**.
2. Đặt tên, chọn bố cục phù hợp và tải file PNG/WebP tối đa 8 MB.
3. Nên dùng ảnh có nền trong suốt và đúng tỷ lệ của bố cục được chọn.
4. Khung được lưu trong IndexedDB của trình duyệt và tự động gửi lên máy chủ chia sẻ, nên mọi thiết bị mở photobooth đều thấy và dùng được ngay, không cần nhập lại.

Kích thước thiết kế khuyến nghị: `1500×1000` cho 1 ảnh, `800×2400` cho dải 3 ảnh và `1100×1650` cho lưới 4 ảnh. Vùng trong suốt là nơi ảnh chụp sẽ hiện ra.

Bấm **Đồng bộ máy chủ** trong `/admin/` để gửi toàn bộ khung cục bộ lên máy chủ và tải về các khung đang có trên đó. Khi không kết nối được máy chủ, khung vẫn dùng được trên thiết bị hiện tại; dùng **Xuất file** / **Nhập file** để mang khung sang máy khác thủ công.

Máy chủ chia sẻ lưu thư viện khung tại `data/frames.json`. Gói free của Render có ổ đĩa tạm nên thư viện này có thể mất khi deploy lại.

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
