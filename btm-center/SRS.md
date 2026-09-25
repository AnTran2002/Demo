TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)
Hệ thống Quản lý Trung tâm Dạy học BTM
Phiên bản: 1.1 (MVP – cập nhật sau khi tổng hợp tài liệu) Công nghệ: HTML, CSS, Vanilla JavaScript, JSON/LocalStorage Nhóm thực hiện: 4 thành viên | Thời gian: 4 tuần

1. GIỚI THIỆU
   1.1 Mục đích
   Xây dựng ứng dụng web quản lý trung tâm dạy học thêm, hỗ trợ Quản trị viên, Giáo viên và Học sinh quản lý lớp học, đăng ký học, điểm danh, tài liệu học tập, điểm số và nhận xét.
   1.2 Phạm vi
   Chỉ áp dụng cho học sinh khối lớp 9
   Chỉ hỗ trợ 3 môn học: Toán, Văn, Anh
   Không xử lý thanh toán thật, không có backend/database/API server thật
   Dữ liệu lưu trữ bằng LocalStorage, định dạng JSON
   1.3 Đối tượng sử dụng
   Vai trò
   Mô tả
   Admin
   Quản trị hệ thống, quản lý tài khoản và lớp học. Không có chức năng đăng ký, tài khoản khởi tạo sẵn (seed)
   Giáo viên
   Đăng ký tài khoản (kèm chọn môn giảng dạy), mở lớp, điểm danh, chấm điểm, nhận xét học sinh
   Học sinh
   Đăng ký tài khoản, đăng ký học lớp, xem lịch học, tài liệu, điểm, nhận xét

1.4 Thuật ngữ
Lớp học (Class): một lớp dạy 1 môn, 1 giáo viên phụ trách, lịch học cố định theo tuần
Buổi học (Session): một buổi học cụ thể trong lớp, có ngày và tiêu đề bài học
Đăng ký học (Enrollment): việc học sinh ghi danh vào một lớp học

2. TỔNG QUAN HỆ THỐNG
   2.1 Actor & vai trò
   Admin → Quản lý tài khoản, quản lý lớp học toàn hệ thống, xem thống kê tổng quan
   Giáo viên → Mở lớp, điểm danh, nhập điểm, nhận xét, xem "Lịch giảng dạy"
   Học sinh → Đăng ký học, xem "Lịch học của tôi" và "Lớp đang mở", xem tài liệu/điểm/nhận xét
   2.2 Ràng buộc nghiệp vụ cốt lõi
   Mỗi tài khoản chỉ có 1 vai trò duy nhất
   Mỗi giáo viên đăng ký kèm 1 môn giảng dạy cố định ngay lúc đăng ký; không thể đổi sau này (trừ khi Admin can thiệp thủ công)
   Một giáo viên có thể mở nhiều lớp, nhưng tất cả cùng 1 môn đã đăng ký — môn của lớp tự động gán theo hồ sơ giáo viên, không cho chọn tự do khi tạo lớp
   Một học sinh có thể đăng ký nhiều lớp thuộc nhiều môn khác nhau
   Admin không đăng ký; tài khoản Admin được seed sẵn trong dữ liệu khởi tạo
   Buổi học được giáo viên tạo thủ công theo từng ngày (không tự sinh lịch tự động), để giảm độ phức tạp xử lý

3. YÊU CẦU CHỨC NĂNG
   3.1 Module Auth & Phân quyền (M1)
   Mã
   Chức năng
   Mô tả
   FR-1.1
   Đăng ký giáo viên
   username, password, họ tên, chọn 1 môn giảng dạy (bắt buộc, cố định)
   FR-1.2
   Đăng ký học sinh
   username, password, họ tên; mặc định khối 9
   FR-1.3
   Đăng nhập
   Xác thực username/password, điều hướng theo vai trò
   FR-1.4
   Đăng xuất
   Xoá session hiện tại
   FR-1.5
   Phân quyền truy cập
   Chặn truy cập trang sai vai trò (route guard); Admin không có form đăng ký

3.2 Module Quản lý người dùng – Admin (M2)
Mã
Chức năng
FR-2.1
Xem danh sách tài khoản, lọc theo vai trò
FR-2.2
Khoá / mở khoá tài khoản
FR-2.3
Xem chi tiết lớp đang dạy/đang học của từng tài khoản

3.3 Module Quản lý lớp học (M3)
Mã
Chức năng
FR-3.1
Giáo viên tạo lớp: tên lớp, lịch cố định (thứ, giờ bắt đầu/kết thúc), sĩ số tối đa. Môn học tự động lấy theo hồ sơ giáo viên, không hiển thị lựa chọn môn khác
FR-3.2
Giáo viên sửa/đóng lớp
FR-3.3
Xem danh sách học sinh trong lớp

3.4 Module Đăng ký học (M4)
Mã
Chức năng
FR-4.1
Học sinh xem danh sách lớp đang mở, lọc theo môn
FR-4.2
Học sinh đăng ký học 1 lớp (kiểm tra sĩ số còn trống)
FR-4.3
Học sinh huỷ đăng ký (trước buổi học đầu tiên)

3.5 Module Buổi học – Điểm danh (M5)
Mã
Chức năng
FR-5.1
Giáo viên tạo buổi học theo ngày cụ thể (thủ công)
FR-5.2
Giáo viên nhập tiêu đề bài học cho buổi
FR-5.3
Giáo viên điểm danh từng học sinh: Có mặt / Vắng / Trễ

3.6 Module Tài liệu (M6)
Mã
Chức năng
FR-6.1
Giáo viên đính kèm tài liệu vào 1 buổi học cụ thể
FR-6.2
Học sinh xem và tải về tài liệu của buổi học đã đăng ký

3.7 Module Điểm số (M7)
Mã
Chức năng
FR-7.1
Giáo viên nhập điểm cho học sinh theo lớp
FR-7.2
Học sinh xem điểm của mình theo từng lớp

3.8 Module Nhận xét (M8)
Mã
Chức năng
FR-8.1
Giáo viên viết nhận xét cho học sinh
FR-8.2
Học sinh xem nhận xét của giáo viên

3.9 Module Dashboard (M9)
Mã
Chức năng
Vai trò
FR-9.1
Xem tổng số giáo viên, học sinh, lớp học
Admin
FR-9.2
"Lịch giảng dạy": danh sách lớp đang dạy, lịch theo tuần, buổi học sắp tới, trạng thái điểm danh (đã/chưa điểm danh)
Giáo viên
FR-9.3
"Lịch học của tôi": các lớp đã đăng ký, buổi học sắp tới gần nhất
Học sinh
FR-9.4
"Lớp đang mở": danh sách lớp còn chỗ để đăng ký, lọc theo môn, có thể đăng ký nhanh
Học sinh

4. YÊU CẦU PHI CHỨC NĂNG
   Mã
   Yêu cầu
   NFR-1
   Giao diện responsive cơ bản, dùng được trên trình duyệt phổ biến
   NFR-2
   Dữ liệu lưu trong LocalStorage, không mất khi tải lại trang
   NFR-3
   Thao tác chính phản hồi tức thời (client-side, không cần chờ mạng)
   NFR-4
   Code tổ chức theo module rõ ràng (core/data/modules/pages) để 4 thành viên làm song song không xung đột
   NFR-5
   Validate cơ bản: bắt buộc nhập, trùng username, giới hạn sĩ số, ràng buộc 1 giáo viên/1 môn

5. YÊU CẦU DỮ LIỆU (Data Model)
   users: { id, username, password, role, fullName, active,
   subject } // chỉ có ở giáo viên, cố định sau đăng ký
   classes: { id, className, subject, grade: 9, teacherId, maxSlot, schedule[], status }
   enrollments: { id, classId, studentId, status, registeredAt }
   sessions: { id, classId, date, title, materials[] }
   attendance: { id, sessionId, studentId, status }
   materials: { id, sessionId, fileName, fileData/fileUrl, uploadedAt }
   grades: { id, classId, studentId, type, score, note }
   comments: { id, classId, studentId, teacherId, content, createdAt }

Mỗi entity lưu tại 1 key riêng trong LocalStorage; mọi thao tác đi qua lớp trừu tượng db.js dùng chung (get/save/insert/update/delete).

6. USE CASE CHÍNH (tóm tắt)
   Mã
   Use case
   Actor
   UC-01
   Đăng ký tài khoản (kèm chọn môn nếu là Giáo viên)
   Giáo viên, Học sinh
   UC-02
   Đăng nhập
   Tất cả
   UC-03
   Mở lớp học (môn tự động theo hồ sơ)
   Giáo viên
   UC-04
   Đăng ký học lớp
   Học sinh
   UC-05
   Tạo buổi học & điểm danh
   Giáo viên
   UC-06
   Đính kèm & tải tài liệu
   Giáo viên, Học sinh
   UC-07
   Nhập & xem điểm
   Giáo viên, Học sinh
   UC-08
   Nhận xét học sinh
   Giáo viên, Học sinh
   UC-09
   Xem Dashboard theo vai trò (thống kê / lịch giảng dạy / lịch học + lớp mở)
   Tất cả
   UC-10
   Quản lý tài khoản/lớp học
   Admin

7. RÀNG BUỘC HỆ THỐNG
   Không dùng framework, không dùng backend/server thật
   Không xử lý thanh toán, không tích hợp API bên ngoài
   Chỉ hỗ trợ khối 9, 3 môn Toán/Văn/Anh
   1 giáo viên = 1 môn cố định; 1 tài khoản = 1 vai trò cố định
   Buổi học tạo thủ công theo ngày, không tự sinh lịch lặp

8. PHẠM VI KHÔNG THỰC HIỆN (Out of Scope)
   Thanh toán học phí thật
   Backend, Database, API server thật
   Chat real-time, video call trực tuyến
   Gửi email/SMS thật, quên mật khẩu qua email
   Đa vai trò trên 1 tài khoản
   Tự động sinh buổi học lặp lại theo lịch cố định (MVP tạo thủ công)

9. RỦI RO & LƯU Ý TRIỂN KHAI
   Đính kèm tài liệu bằng base64 có thể vượt giới hạn LocalStorage (~5–10MB) → nếu vượt, chuyển sang lưu link tài liệu (VD: Google Drive) thay vì upload file thật
   Dashboard Giáo viên và Học sinh có thể dùng chung 1 component lịch (calendar/list), chỉ khác nguồn dữ liệu, để tiết kiệm công sức phát triển UI
   Không có bước Admin duyệt tài khoản giáo viên — tài khoản active ngay sau khi đăng ký, nhằm giảm độ phức tạp luồng nghiệp vụ trong phạm vi MVP
