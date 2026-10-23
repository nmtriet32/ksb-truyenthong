# KSB Dashboard – Truyền thông 2027

Trang trình bày nội bộ, chạy trên localhost, đọc dữ liệu trực tiếp từ Google Sheet
**"Kế hoạch truyền thông 2027"**. Sửa Sheet → trang tự cập nhật (mặc định mỗi 60 giây, hoặc bấm **Làm mới**).

## 1. Chạy trên máy

**Cách A – VS Code (khuyên dùng)**
1. VS Code → *File → Open Folder…* → chọn thư mục `KSB-Dashboard`.
2. Cài tiện ích **Live Server** (thanh bên trái → Extensions → tìm "Live Server" của Ritwick Dey → Install).
3. Bấm **Go Live** ở góc dưới bên phải → trình duyệt mở `http://localhost:5500`.

**Cách B – nhấp đúp `start.bat`** (cần Node.js hoặc Python trên máy).

**Cách C – Terminal trong VS Code:** `node server.js`

Trang chạy được cả khi không có mạng: font, thư viện biểu đồ và bản chụp dữ liệu (23/10/2026) đều nằm sẵn trong thư mục.

## 2. Kết nối real-time với Google Sheet (làm 1 lần, ~5 phút)

Sheet vẫn giữ chế độ riêng tư. Trang đọc dữ liệu qua một Apps Script chạy bằng tài khoản của anh.

1. Mở Sheet → **Tiện ích mở rộng → Apps Script**.
2. Xóa nội dung mặc định, dán toàn bộ file `apps-script/Code.gs`.
3. Sửa dòng `const TOKEN = 'DOI-CHUOI-NAY';` thành một chuỗi bí mật, ví dụ `ksb-2027-x7Qp`.
4. Bấm **Lưu**, chọn hàm `testDoGet` → **Chạy** → cấp quyền khi Google hỏi (đây là quyền cho chính script của anh).
5. **Triển khai → Tùy chọn triển khai mới** → biểu tượng bánh răng → **Ứng dụng web**
   - Thực thi dưới dạng: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
6. Sao chép **URL ứng dụng web** (kết thúc bằng `/exec`).
7. Mở `assets/js/config.js`, điền:
   ```js
   APPS_SCRIPT_URL: 'https://script.google.com/macros/s/....../exec',
   TOKEN: 'ksb-2027-x7Qp',
   ```
8. Tải lại trang. Góc trên bên phải chuyển sang chấm xanh **"Trực tiếp từ Sheet"**.

> Ai có cả URL lẫn TOKEN mới đọc được dữ liệu, vì vậy không gửi hai thông tin này ra ngoài.
> Khi sửa `Code.gs`, cần **Triển khai → Quản lý các bản triển khai → Chỉnh sửa → Phiên bản mới** để thay đổi có hiệu lực.

Trạng thái kết nối:

| Biểu tượng | Ý nghĩa |
|---|---|
| Chấm xanh "Trực tiếp từ Sheet" | Đang đọc dữ liệu mới nhất |
| Chấm cam "Bản chụp…" | Chưa cấu hình Apps Script, đang dùng bản chụp 23/10/2026 |
| Chấm đỏ "Mất kết nối…" | Không gọi được Apps Script, đang dùng bản lưu gần nhất |

## 3. Trình chiếu cho lãnh đạo

- Bấm **▶ Trình chiếu** hoặc phím **P**: ẩn menu, toàn màn hình, chữ lớn hơn.
- **← / →** chuyển lần lượt qua 22 trang, **Esc** thoát, **R** làm mới dữ liệu.
- Di chuột vào biểu đồ, chấm trên ma trận rủi ro để xem chi tiết.

## 4. Menu và nguồn dữ liệu

Trang chủ tổng hợp từ mọi tab. Mỗi menu chính có một trang tổng quan và các trang con trong dropdown.

| Menu | Trang con | Đọc từ tab |
|---|---|---|
| 01 Thương hiệu | Thương hiệu công ty · Thương hiệu cá nhân | Thương hiệu công ty, Thương hiệu cá nhân, Tổng quan, Series hàng tháng |
| 02 Truyền thông | Đối ngoại: Báo chí · Tài trợ · Chương trình sự kiện bên ngoài; Truyền thông đối nội; Kênh truyền thông số | CP 2026 · Dữ liệu gốc, CP 2026 · Tổng hợp, CP 2024–2025, Theo dõi báo chí, NS Phân phối, NS Nội bộ & lưu trữ, Sự kiện 2027, Lịch nội dung 2027, Khung kênh 2027, Lịch bài KSB/Đất Cuốc T11–12/2026 |
| 03 Sự kiện | Nội bộ · Đối ngoại · Cổ đông · Kỷ niệm (lọc theo cột Loại); trang Lễ, Tết mở từ trang tổng quan | Sự kiện 2027, Phim 35 năm, Ngày lễ 2027, Lịch nội dung 2027 |
| 04 Quản trị rủi ro | Thương hiệu KSB · Lãnh đạo · HĐSX Kinh doanh · Tình hình tài chính | Rủi ro truyền thông, Rà soát 2027, Ngày lễ 2027 |
| 05 Hoạt động dự kiến | Hỗ trợ công tác hội · ESG · CSR | Hoạt động dự kiến, Lịch nội dung 2027 |
| 06 Ngân sách (cần mật khẩu) | Tổng quan · Chi đối ngoại · Nội bộ, chiến dịch và hoạt động | NS …, CP …, cột ngân sách của Sự kiện 2027 và Hoạt động dự kiến |

Sáu tab mới được thêm vào Sheet cho các menu này: **Thương hiệu công ty, Thương hiệu cá nhân, Sự kiện 2027,
Theo dõi báo chí, Rủi ro truyền thông, Hoạt động dự kiến**. Thêm dòng ở các tab đó là trang tự cập nhật.

**Lưu ý khi sửa Sheet:** trang nhận diện bảng theo **tên cột tiêu đề** (ví dụ `STT`, `Ngày đăng`, `Trạng thái`).
Thêm dòng, sửa nội dung, đổi trạng thái thoải mái; chỉ tránh đổi tên cột tiêu đề và tên tab.

**Nếu đã triển khai Apps Script từ bản trước:** dán lại `apps-script/Code.gs` (bản mới đọc thêm tab chi phí gốc,
đã xóa trắng cột số điện thoại người liên hệ), rồi **Triển khai → Quản lý các bản triển khai → Chỉnh sửa → Phiên bản mới**.

## 5. Cấu trúc thư mục

```
KSB-Dashboard/
├─ index.html              trang chính
├─ assets/css/             style.css (bố cục), theme.css (màu theo mảng, ảnh nền), fonts.css
├─ assets/js/config.js     ← chỗ điền URL Apps Script, TOKEN, chu kỳ làm mới
├─ assets/js/app.js        đọc dữ liệu và dựng các trang
├─ assets/vendor/          Chart.js (đóng gói sẵn)
├─ assets/fonts/           font Be Vietnam Pro
├─ assets/img/logo-ksb.png logo KSB (dùng nguyên file, không chỉnh sửa)
├─ assets/img/photos/      ảnh lấy từ Google Drive của bộ phận truyền thông (thay ảnh: giữ đúng tên file)
├─ data/snapshot.js        bản chụp dữ liệu CÔNG KHAI (đã bỏ mọi số tiền)
├─ data/budget.enc.js      bản chụp ngân sách đã mã hóa, chỉ mở bằng mật khẩu
├─ apps-script/Code.gs     dán vào Apps Script của Sheet
└─ server.js, start.bat    chạy localhost không cần VS Code
```

## 6. Mục Ngân sách và mật khẩu

- Mọi số tiền (ngân sách, chi phí, hợp đồng, thanh toán) chỉ nằm ở menu **06 · Ngân sách**. Các trang khác chỉ có thẻ dẫn sang.
- Không có mật khẩu: trang không tải dữ liệu ngân sách. Bản chụp ngân sách `data/budget.enc.js` được mã hóa AES-256,
  nên kể cả khi ai đó tải file về cũng không đọc được.
- Nhập đúng mật khẩu một lần thì xem được đến khi đóng trình duyệt. Nút **Khóa lại** trên trang ngân sách để khóa ngay.
- Khi nối real-time: chạy hàm `datMatKhauNganSach` trong Apps Script (sửa mật khẩu trong hàm trước khi chạy).
  Apps Script chỉ trả dữ liệu ngân sách khi nhận đúng mật khẩu; sai 10 lần trong 1 giờ thì tạm khóa.
- Đổi mật khẩu: nhờ Claude tạo lại `budget.enc.js` với mật khẩu mới, đồng thời chạy lại `datMatKhauNganSach`.

## 7. Đưa lên GitHub Pages (link công khai)

1. Đăng nhập github.com → **New repository** → đặt tên (ví dụ `ksb-truyenthong`) → **Public** → Create.
2. Trong repo mới bấm **uploading an existing file** → kéo toàn bộ NỘI DUNG thư mục `KSB-Dashboard`
   (gồm `index.html`, `.nojekyll`, các thư mục `assets`, `data`, `apps-script`…) vào → **Commit changes**.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, thư mục `/ (root)` → **Save**.
4. Chờ 1–2 phút, link có dạng `https://<tên-tài-khoản>.github.io/ksb-truyenthong/`.
5. Cập nhật giao diện về sau: vào repo → **Add file → Upload files** → kéo file mới đè lên → Commit.

Lưu ý: repo công khai nên ai có link đều xem được các mục 01–05 (không có số tiền). Mục 06 cần mật khẩu.
Không bao giờ đưa mật khẩu vào file nào trong thư mục này.
