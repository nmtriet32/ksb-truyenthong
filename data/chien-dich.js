/* Chiến dịch trong mục Nội dung. Chỉ chứa phần chữ (nội dung, ý nghĩa, cách triển khai, được/mất).
   KHÔNG ghi số tiền ở đây: repo công khai. Ngân sách của chiến dịch đọc từ tab Sheet ghi ở `budgetTab`
   (tên tab bắt đầu bằng "NS" nên chỉ gửi ra trang khi nhập đúng mật khẩu).
   Thêm chiến dịch mới: thêm 1 phần tử vào mảng + 1 dòng trong NAV (app.js, nhóm "Chiến dịch"). Cập nhật: 25/11/2026. */
window.KSB_CAMPAIGNS = [
  {
    id: 'nguoi-ksb',
    name: 'Người KSB',
    year: '2027',
    status: 'Đề xuất, chờ chị Mơ chọn phương án',
    budgetTab: 'NS Người KSB · 2 PA',
    tagline: 'Lặng lẽ cho đi, bền bỉ dựng xây.',
    meaning: 'Người KSB là những người đã gắn bó hàng chục năm với công ty: người thợ ở mỏ, người làm ở văn phòng, ở khu công nghiệp. Sự vững vàng của KSB được dựng nên từ sự bền bỉ của họ. Chiến dịch đưa hình ảnh KSB về con người cụ thể, có câu chuyện, và tích lũy tư liệu cho phim tài liệu 35 năm (01/2028).',
    quarters: [
      { k: 'Q1 · Gốc', v: 'Những người đặt nền', w: 'Lặng lẽ', c: '#0a4e9b' },
      { k: 'Q2 · Thân', v: 'Sức bền vượt khó', w: 'Bền bỉ', c: '#2563a8' },
      { k: 'Q3 · Lá', v: 'Việc thầm lặng nuôi cả cây', w: 'Cho đi', c: '#1a7f4b' },
      { k: 'Q4 · Hoa', v: 'Thế hệ tiếp nối', w: 'Dựng xây', c: '#ed1c24' }
    ],
    formats: [
      { t: 'E-magazine', d: '1 số mỗi tháng trên trang chủ đề "Người KSB" ở ksb.vn: bài dài, ảnh lớn, trích dẫn nổi, 1 video ngắn nhúng, đọc tốt trên điện thoại.' },
      { t: 'Clip quý', d: '1 clip 3:40–4:00 mỗi quý tổng hợp câu chuyện của quý, kèm bản dọc 60 giây cho Reels, TikTok, YouTube Shorts.' },
      { t: 'Phân phối', d: 'Website là bản gốc → fanpage KSB và KCN Đất Cuốc chia sẻ; quảng cáo mỗi số và mỗi clip; báo chí đăng lại câu chuyện nổi bật.' },
      { t: 'Nội bộ', d: 'Poster đề cử nhân vật, poster giới thiệu clip tại văn phòng, mỏ, KCN; chiếu clip tại mỏ; lưu trữ footage 3 bản.' }
    ],
    rules: [
      'Không đưa "khai thác, khoáng sản, bất động sản" lên tiêu đề, ảnh đại diện của series',
      'Người ở công trường trong khung hình phải đủ bảo hộ; cán bộ an toàn duyệt hình trước khi đăng',
      'Nhân vật ký giấy đồng ý sử dụng hình ảnh (mẫu do Pháp chế soạn)',
      'Giọng kể mộc, ấm, để nhân vật tự nói bằng lời của họ'
    ],
    process: [
      ['Tuần −6', 'Chốt nhân vật chính và dự phòng; tiền phỏng vấn'],
      ['Tuần −5', 'Bộ câu hỏi, kịch bản quay, lịch quay; giấy đồng ý'],
      ['Tuần −4', 'Phỏng vấn, quay, chụp chân dung; ảnh cũ của nhân vật'],
      ['Tuần −3', 'Viết bài; dựng nháp video'],
      ['Tuần −2', 'Duyệt nội bộ, an toàn lao động; nhân vật xem lại'],
      ['Tuần −1', 'Dàn trang; phụ đề; bản ngắn mạng xã hội'],
      ['Tuần 0', 'Phát hành đồng loạt website, fanpage, YouTube'],
      ['Tuần +1', 'Đo lường; lưu file gốc vào kho tư liệu phim 35 năm']
    ],
    options: [
      {
        k: 'PA 01', t: 'Tiết kiệm', rec: true,
        how: 'Phòng Truyền thông tự làm, thuê lẻ khâu kỹ thuật',
        rows: [
          ['E-magazine', 'Phòng TT phỏng vấn, viết, dàn trang trên template WordPress dựng 1 lần; thuê thợ chụp ½ ngày mỗi số'],
          ['Clip quý', 'Phòng TT viết kịch bản, dựng theo Chuẩn video KSB ver 1; thuê quay phim 2 ngày/quý, flycam 2 buổi/năm'],
          ['Phân phối', 'Phòng TT chạy quảng cáo; 2 bài báo (quý 1 ra mắt, quý 4 tổng kết)']
        ],
        pros: ['Chi phí bằng khoảng 1/3 PA 02', 'Kịp số 01 (15/01/2027): bắt đầu ngay khi duyệt', 'Nhân vật cởi mở với người quen, câu chuyện thật'],
        cons: ['Phòng TT tốn khoảng 84 ngày công/năm (ước tính)', 'Chất lượng hình phụ thuộc thợ thuê lẻ', 'Dễ trễ khi trùng việc lớn (Tết, ĐHĐCĐ, phim 35 năm)']
      },
      {
        k: 'PA 02', t: 'Thuê agency', rec: false,
        how: 'Agency sản xuất trọn gói, KSB chọn nhân vật và duyệt',
        rows: [
          ['E-magazine', 'Agency biên tập, viết, chụp, dàn trang; thiết kế template và nhận diện series riêng'],
          ['Clip quý', 'Agency làm kịch bản, ekip quay 3 ngày/quý, flycam, dựng, nhạc, bản dọc'],
          ['Phân phối', 'Agency đặt 4 bài báo (1 bài/quý); Phòng TT chạy quảng cáo fanpage']
        ],
        pros: ['Chất lượng hình ảnh đồng đều, chuyên nghiệp', 'Giảm tải cho phòng TT (2 người)'],
        cons: ['Chi phí gấp khoảng 3 lần PA 01', 'Cần khoảng 3 tuần chọn agency: không kịp số 01', 'Agency cần thời gian hiểu KSB và nhân vật']
      }
    ],
    recommend: 'Làm PA 01 từ quý 1 để kịp số 01–03. Hết quý 1 đo kết quả; nếu clip chưa đạt, chuyển riêng clip quý Q2–Q4 sang thuê ngoài.',
    kpis: ['12/12 số e-magazine đúng hạn', '4 clip quý', '12 nhân vật và gia đình được ghi nhận', 'Kho phỏng vấn, ảnh, footage cho phim 35 năm', 'Lượt đọc, lượt xem: chốt sau khi có mức nền 2026'],
    decide: ['Chọn PA 01 hay PA 02', 'Nhân vật số 01 (người gắn bó lâu nhất)', 'Mục tiêu lượt đọc, lượt xem cho KPI']
  }
];
