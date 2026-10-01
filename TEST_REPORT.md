# Báo cáo kiểm thử — Chess Beyond

## Tóm tắt

**56/56 kiểm tra engine/AI đạt. 35/35 kiểm tra giao diện/trình duyệt đạt.** Không ghi nhận uncaught JavaScript exceptions trong lượt kiểm tra trình duyệt.

Các kết quả chi tiết, số đo thời gian và tên từng test được lưu ở:

- `tests/engine-test-results.json`
- `tests/ui-test-results.json`

## Engine và AI

Chạy bằng Node.js. Các nhóm đã kiểm tra:

- Vị trí bắt đầu: perft đến độ sâu 5, đạt **4.865.609** nhánh ở độ sâu 5.
- Kiwipete: đến độ sâu 4, đạt **4.085.603** nhánh.
- Tàn cuộc Xe/Tốt: đến độ sâu 5, đạt **674.624** nhánh.
- Các vị trí phối hợp nhập thành, chiếu và phong cấp: đến độ sâu 4.
- Vị trí bổ sung trong tập kiểm thử perft công khai của Stockfish: độ sâu 5, đạt **11.609.488** nhánh.
- Nhập thành hai phía, hai màu; cấm nhập thành qua chiếu, đang bị chiếu, thiếu Xe; mất quyền nhập thành sau khi Xe đã đi.
- En passant hợp lệ, hết hạn, và trường hợp en passant làm lộ Vua.
- Quân bị ghim, chiếu đôi, chiếu hết, stalemate.
- Bốn lựa chọn phong cấp; phong Mã; SAN có phân biệt hai quân cùng loại.
- Hòa lặp 3/5 lần; yêu cầu hòa với nước dự định; 50/75 nước; ưu tiên chiếu hết.
- Nhận diện thiếu quân thông thường; không xử nhầm KNN vs K là thiếu lực lượng tuyệt đối.
- Replay dữ liệu lưu giữ được lịch sử và số lần lặp; các chuỗi nước ngẫu nhiên có thể undo hoàn toàn chính xác.
- PGN, chiếu hết ở cả ba mức AI, kiểm tra tính hợp lệ và không biến đổi trạng thái gốc trong quá trình tìm kiếm.

Perft là phép kiểm tra số lượng nước hợp lệ ở từng độ sâu, không phải thước đo sức cờ của AI.

## Trình duyệt và giao diện

Chạy Chromium headless, kiểm tra tương tác thực tế với các nút/ô và Blob Web Worker.

Bao gồm: 64 ô/32 quân; ảnh nạp đầy đủ; chọn Tốt e2 chỉ sáng e3/e4; không đi vào ô sai; AI trả lời; gợi ý có mũi tên nhưng không tự đi; đi lại; Xe bị chặn; hiệu ứng bắt quân và cleanup; en passant; nhập thành có cả Xe; phong cấp/cancel/phong Mã; ghim quân; cảnh báo chiếu; chơi bên Đen; reset; undo trong lúc đang animation; đổi độ khó khi AI đang tính; hủy Worker của ván cũ; phím tắt; tắt VFX; yêu cầu hòa; lưu/khôi phục payload; xử lý dữ liệu hỏng; xuất PGN; drawer mobile; đầu hàng khi AI đang tính.

Các kích thước viewport đã kiểm tra không có scroll ngang/dọc của trang gameplay, bàn luôn vuông và nằm trong màn hình:

| Loại | Kích thước |
|---|---|
| Điện thoại | 390×844 |
| Điện thoại nhỏ | 375×667 |
| Điện thoại gọn | 320×568 |
| Tablet dọc | 768×1024 |
| Điện thoại ngang | 844×390 |
| Tablet ngang | 1024×768 |
| Laptop | 1366×768 |
| Desktop ban đầu | 1440×960 |

## Giới hạn kiểm thử

Môi trường kiểm thử chặn điều hướng tới `file://` và HTTP localhost theo chính sách quản trị. Vì vậy, HTML được nạp trực tiếp vào tài liệu `about:blank` bằng Playwright `set_content`; mã game và Worker vẫn chạy thực tế. Các kiểm tra lưu/khôi phục dùng một stub tương thích getItem/setItem để kiểm tra payload và logic khôi phục trong origin này; chưa xác nhận hành vi lưu trữ thực tế của từng trình duyệt khi mở file://.

Game đóng gói toàn bộ code và 20 ảnh cần cho runtime dưới dạng nội tuyến/data URI; không cần yêu cầu tải ảnh, thư viện hoặc API từ mạng. Đường fallback cho bộ nhớ bị chặn được kiểm tra ở lượt smoke test không có stub.

Không có kiểm thử trên phần cứng iOS/Android vật lý, Safari thực hoặc mọi môi trường nhúng. Không dùng tablebase cho toàn bộ thế cờ chết đặc biệt. Độ sâu và thời gian AI thực tế phụ thuộc thiết bị/thế cờ. Các kết quả trên không phải bảo đảm tuyệt đối không có lỗi trong mọi điều kiện.
