# CHESS BEYOND — Neon Arena

Game cờ vua offline bằng HTML, CSS và JavaScript thuần. Bộ quân và chất liệu chiến trường được xử lý từ hai ảnh tham chiếu người dùng cung cấp.

## Chạy game

Mở **game.html** bằng trình duyệt hiện đại. Tất cả JavaScript, CSS và hình ảnh cần cho gameplay đã được nhúng trong file này. Không cần npm, backend, CDN hay kết nối mạng. Có thể chép riêng game.html sang thư mục khác để chơi.

Trên điện thoại, cần mở bằng trình duyệt có khả năng chạy HTML/JavaScript; màn hình xem trước file của ứng dụng quản lý tệp không nhất thiết chạy game. File cũng có thể được đặt trên một máy chủ web tĩnh thông thường.

Bản lưu thuộc bộ nhớ của trình duyệt hiện tại. Khi chạy bằng file://, phạm vi lưu trữ có thể khác giữa các trình duyệt hoặc thay đổi khi đổi đường dẫn file. Nếu bộ nhớ bị chặn, game vẫn chạy và hiển thị cảnh báo không lưu được. Dùng nút PGN để giữ biên bản trận đấu. Bản này xuất PGN, chưa có giao diện nhập PGN.

## Điều khiển

Chạm/click quân của bạn, rồi chạm/click ô đích. Ô tròn xanh biểu thị nước đi hợp lệ; khung hồng biểu thị ô có thể bắt quân. Chọn lại quân hoặc nhấn Escape để bỏ chọn. Quân không được di chuyển theo cách làm lộ Vua.

- Gợi ý nước đi: tìm kiếm cho bên người chơi, đánh dấu ô xuất phát/đích và mũi tên. Không tự đi thay người chơi.
- Đi lại: trả lại lượt trước của người chơi; hủy an toàn AI/hiệu ứng còn đang chạy.
- Xoay bàn: đổi bên quan sát, không đổi bên chơi hoặc lượt đi.
- Hiệu ứng: bật/tắt hiệu ứng chiến đấu. Không có sát thương hoặc cơ chế ngoài luật cờ vua.
- Ván mới: chọn độ khó và chơi Trắng/Đen. Trắng luôn đi trước. Phe người chơi luôn có màu xanh dương–hồng.
- Hòa / Đầu hàng / PGN: trong bảng nhật ký; trên mobile mở nút menu góc trên phải.

Phím tắt: H = gợi ý, U = đi lại, F = xoay bàn, N = ván mới, Escape = đóng/bỏ chọn. Các phím mũi tên điều hướng khi đang focus bàn cờ; Enter/Space chọn ô.

## Luật được triển khai

Bàn 8×8; mỗi bên đủ 16 quân; di chuyển và bắt quân theo luật thông thường. Có chiếu, chiếu hết, chặn nước tự chiếu, ghim quân, chiếu đôi, nhập thành hai phía, bắt Tốt qua đường đúng thời điểm, phong cấp với đủ bốn lựa chọn Hậu/Xe/Tượng/Mã và hoàn tác các nước đặc biệt.

Hòa được xử lý như sau:

- Hết nước hợp lệ nhưng không bị chiếu (stalemate).
- Thiếu quân ở các trường hợp được nhận biết: chỉ hai Vua; Vua và một Tượng/Mã đấu với Vua; tất cả quân ngoài Vua đều là Tượng trên cùng màu ô.
- Lặp cùng vị trí 5 lần hoặc 75 nước mỗi bên không đi Tốt/bắt quân: tự động hòa, chiếu hết được xét trước.
- Lặp 3 lần hoặc 50 nước: yêu cầu hòa bằng nút Hòa, gồm cả khai báo một nước đi dự định sẽ thỏa điều kiện. AI tự yêu cầu hòa khi đủ điều kiện.

Không dùng tablebase để nhận biết toàn bộ các thế cờ chết đặc biệt có nhiều quân/chốt khóa. Không có Chess960, đồng hồ thi đấu, quy tắc chạm quân bắt buộc hay trọng tài giải đấu. Đây là game casual chơi với AI cục bộ, không phải máy chủ thi đấu cờ vua.

## Ba mức AI

| Mức | Chính sách |
|---|---|
| Dễ | Tìm kiếm 1 lớp, cố ý có độ biến thiên ở các lựa chọn; vẫn nhận biết chiếu hết ngay. |
| Trung bình | Iterative deepening, alpha–beta tối đa 3 lớp, mở rộng chuỗi bắt quân; ngân sách khoảng 850 ms. |
| Khó | Tối đa 5 lớp, mở rộng chuỗi bắt quân sâu hơn, sắp xếp nước và bảng transposition; ngân sách khoảng 2.100 ms. |

Gợi ý dùng tìm kiếm riêng, tối đa 5 lớp với ngân sách khoảng 1.500 ms. Độ sâu hoàn thành phụ thuộc thế cờ và thiết bị. Các mức không được gán Elo và không bảo đảm tìm được nước tối ưu tuyệt đối. Game không dùng Stockfish hoặc chess.js; luật và AI là mã tự chứa trong source.

Tính toán chạy trong Blob Web Worker để tránh khóa giao diện. Nếu trình duyệt không cho tạo Worker, game thông báo chuyển sang chế độ tương thích với ngân sách tìm kiếm ngắn hơn; sức cờ có thể giảm trong chế độ đó. Kết quả AI luôn được kiểm tra lại tính hợp lệ trước khi đi.

## Hiệu ứng tấn công

Tốt: tia ngắn. Mã: đường nhảy và vệt chém cong. Tượng: luồng năng lượng cong. Xe: tia thẳng dày. Hậu: ngôi sao năng lượng nhiều cánh. Vua: dấu ấn năng lượng bốn cánh. Các pha bắt quân có vòng xung kích, hạt vỡ và fade-out quân bị bắt; nước nhập thành có chuyển động cả Vua lẫn Xe.

Các hiệu ứng chỉ là phần trình diễn. Game không có âm thanh, tài khoản hay dữ liệu gửi lên máy chủ.

## Cấu trúc source

```text
Chess-Beyond/
  game.html                 # Bản chạy độc lập, mở trực tiếp
  README.md
  CREDITS.txt
  TEST_REPORT.md
  assets/
    blue-*.png              # 6 mẫu quân phe Lam, PNG alpha thật
    purple-*.png            # 6 mẫu quân phe Tím, PNG alpha thật
    arena-surround.webp     # Viền chiến trường đã xóa bàn và quân cũ
    tile-*.webp              # Chất liệu ô bàn cờ
    backdrop.webp
    manifest.json
  source/
    template.html           # HTML và CSS chưa nhúng dữ liệu ảnh
    engine.js               # Bộ luật 0x88, make/unmake, SAN, PGN, hòa
    ai.js                   # AI tìm kiếm có giới hạn thời gian
    app.js                  # Giao diện, Worker, lưu trữ, animation
    build.py                # Đóng gói thành một HTML bằng Python chuẩn
    test-engine.js          # Bộ kiểm tra luật và AI, chạy bằng Node.js
  tests/
    engine-test-results.json
    ui-test-results.json
  previews/
    desktop.png
    mobile.png
```

Ảnh từng quân dùng canvas 256×416, có alpha thật, cùng điểm neo đáy. Asset sheet đầu vào có 5 loại mỗi phe; Tốt được tách từ ảnh chiến trường, rồi đổi màu cho phe Lam. Vì nguồn Tốt nhỏ hơn, chi tiết Tốt không cao bằng các quân còn lại. Các sprite và góc nhìn được giữ theo bộ tham chiếu, không dùng quân cờ mặc định thay thế.

## Chỉnh sửa và đóng gói lại

Sửa các file trong `source/` hoặc thay ảnh trong `assets/`, giữ nguyên tên ảnh và canvas/điểm neo để quân không lệch vị trí. Sau đó chạy:

```bash
python3 source/build.py
```

Trên Windows có thể dùng `python source/build.py`. Không cần cài thư viện Python. `game.html` được tạo lại, có thể chạy mà không cần các thư mục source/assets đi kèm.

Để chạy kiểm tra luật/AI (cần Node.js):

```bash
node source/test-engine.js
```

Chỉ sửa game.html vẫn được, nhưng lần build tiếp theo sẽ ghi đè thay đổi đó. Nên sửa bản nguồn tương ứng rồi build.

## Kiểm thử

Chi tiết nằm trong TEST_REPORT.md. Kết quả tại thời điểm đóng gói: **56/56 kiểm tra luật/AI và 35/35 kiểm tra trình duyệt đạt**. Có kiểm tra nhiều triệu nhánh nước đi, các luật đặc biệt, hủy tác vụ AI, phong cấp, lưu/khôi phục payload, xuất PGN và kích thước mobile/tablet/desktop.

Chưa kiểm thử trực tiếp trên iPhone/iPad vật lý. Thông tin giới hạn môi trường kiểm thử được ghi rõ trong báo cáo; kiểm thử không phải bảo đảm tuyệt đối cho mọi thiết bị/thế cờ.
