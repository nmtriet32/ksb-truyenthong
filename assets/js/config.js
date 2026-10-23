/* =========================================================
   CẤU HÌNH KSB DASHBOARD
   Chỉ cần sửa file này khi kết nối dữ liệu real-time.
   ========================================================= */
window.KSB_CONFIG = {
  // URL ứng dụng web Apps Script (kết thúc bằng /exec). Để trống = dùng bản chụp dự phòng.
  APPS_SCRIPT_URL: '',

  // Chuỗi bí mật, phải giống hệt TOKEN trong apps-script/Code.gs
  TOKEN: '',

  // Tự làm mới dữ liệu sau mỗi bao nhiêu giây (tối thiểu 30)
  REFRESH_SECONDS: 60,

  // Link mở nhanh Sheet gốc
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1qX3GrI2wOGJoLNst-PwfANLG6QQKoHtFkR08Sf9uc4U/edit',

  // Mốc thời gian dùng cho đếm ngược
  MILESTONES: {
    series01: '2027-01-15',   // Người KSB số 01
    anniversary: '2028-01-01' // tháng KSB tròn 35 năm (ngày chính xác chờ xác nhận)
  }
};
