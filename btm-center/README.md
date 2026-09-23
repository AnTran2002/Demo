# BTM Center — Quản lý Trung tâm Dạy học

## Cài đặt
```bash
npm install
npm run dev       # chạy dev server
npm run build     # build production
```

## Cấu trúc thư mục

```
src/
├── core/                  # Hạ tầng dùng chung — KHÔNG ai được sửa tuỳ tiện, bàn bạc trước khi đổi
│   ├── db.js              # Lớp trừu tượng LocalStorage (get/save/insert/update/remove)
│   ├── router.js          # Router SPA dựa trên hash
│   └── session.js         # Quản lý phiên đăng nhập hiện tại
│
├── data/
│   ├── constants.js       # Hằng số: môn học, khối, trạng thái...
│   └── seed.js            # Dữ liệu khởi tạo mẫu (admin mặc định...)
│
├── modules/                       # Logic nghiệp vụ (services), tách theo module
│   ├── auth/auth.service.js       # [Thành viên A] Đăng ký / đăng nhập
│   ├── users/users.service.js     # [Thành viên B] Quản lý tài khoản (Admin)
│   ├── classes/classes.service.js # [Thành viên B] Mở lớp, danh sách lớp
│   ├── enrollment/enrollment.service.js # [Thành viên C] Đăng ký học
│   ├── sessions/sessions.service.js     # [Thành viên C] Buổi học, điểm danh
│   ├── materials/materials.service.js   # [Thành viên D] Tài liệu đính kèm
│   ├── grades/grades.service.js         # [Thành viên D] Điểm số
│   ├── comments/comments.service.js     # [Thành viên D] Nhận xét
│   └── dashboard/dashboard.service.js   # Dữ liệu tổng hợp cho dashboard từng vai trò
│
├── pages/                          # Giao diện (render HTML + gắn sự kiện), theo route
│   ├── auth/login.page.js
│   ├── auth/register.page.js
│   ├── admin/admin-dashboard.page.js
│   ├── teacher/teacher-dashboard.page.js
│   └── student/student-dashboard.page.js
│
├── styles/style.css
├── assets/                 # ảnh, icon (hiện trống)
└── main.js                 # Điểm khởi động: seed data + đăng ký route
```

## Nguyên tắc làm việc nhóm (song song, tránh đụng code)
- **Không sửa `core/db.js`, `core/router.js`, `core/session.js`** trừ khi cả nhóm thống nhất (do A phụ trách).
- Mỗi thành viên chỉ code trong `modules/<tên-module>/` và `pages/<role>/` được phân công.
- Muốn thêm entity mới → báo nhóm để cập nhật `data/seed.js` chung, tránh đụng key LocalStorage.
- Mọi thao tác dữ liệu đều đi qua `DB.*` trong `core/db.js`, không gọi `localStorage` trực tiếp ở nơi khác.

## Tài khoản mặc định (seed)
- Admin: `admin` / `admin123`

# TỔNG HỢP TÀI LIỆU PHÂN TÍCH

## Đồ án: Hệ thống Quản lý Trung tâm Dạy học BTM

> Tài liệu này tổng hợp toàn bộ nội dung đã thống nhất qua các vòng trao đổi (BA + PM + Technical Lead), làm nền tảng để soạn SRS chính thức.

**Nhóm:** 4 sinh viên | **Thời gian:** 4 tuần **Công nghệ:** HTML, CSS, Vanilla JavaScript, JSON/LocalStorage (không framework, không backend thật)

---

## 1. BỐI CẢNH & PHẠM VI TỔNG QUÁT

- Đối tượng học: **chỉ học sinh khối 9**
- Môn học: **Toán, Văn, Anh**
- 3 cấp phân quyền đăng nhập: **Admin – Giáo viên – Học sinh**
  - Admin: **không đăng ký**, tài khoản được seed sẵn
  - Giáo viên & Học sinh: có form đăng ký riêng
- Mỗi giáo viên **đăng ký kèm 1 môn giảng dạy duy nhất**, không đổi được, và **1 giáo viên chỉ dạy 1 môn**
- Lớp học có **lịch cố định theo tuần** (VD: 20h–22h tối thứ 3 và thứ 6)
- Có điểm danh, tiêu đề bài học theo buổi, tài liệu đính kèm, quản lý điểm, nhận xét học sinh
- Không có: thanh toán thật, backend/database thật, API thật

---

## 2. MVP SCOPE

### Must Have

- Đăng nhập phân quyền 3 cấp (Admin/Giáo viên/Học sinh)
- Đăng ký tài khoản (chỉ Giáo viên & Học sinh); Giáo viên đăng ký kèm chọn môn giảng dạy
- Giáo viên mở lớp (môn tự động theo hồ sơ, lịch cố định, sĩ số)
- Học sinh đăng ký học lớp (chỉ khối 9, 3 môn)
- Điểm danh theo buổi học
- Tiêu đề bài học theo từng buổi
- Đính kèm & tải tài liệu học tập theo buổi
- Quản lý & xem điểm học sinh
- Nhận xét học sinh
- Admin quản lý tài khoản & danh sách lớp
- Dashboard riêng theo vai trò: Admin (thống kê), Giáo viên (lịch giảng dạy), Học sinh (lịch học + lớp đang mở)

### Should Have

- Lịch học dạng calendar/list theo tuần
- Tìm kiếm/lọc lớp theo môn

### Could Have

- Thống kê tỷ lệ chuyên cần
- Export điểm (CSV/print)
- Banner nhắc buổi học sắp tới

### Out of Scope

- Thanh toán học phí thật
- Backend/Database/API server thật
- Chat real-time, video call
- Gửi email/SMS thật, quên mật khẩu qua email
- 1 tài khoản có nhiều vai trò

---

## 3. QUY TRÌNH NGHIỆP VỤ CHÍNH (BUSINESS FLOW)

1. **Giáo viên đăng ký** → chọn 1 môn giảng dạy (Toán/Văn/Anh) → tài khoản gắn cố định môn này → đăng nhập
2. **Giáo viên mở lớp**: đặt tên lớp, lịch cố định (thứ + giờ), sĩ số tối đa — môn học tự động lấy theo hồ sơ giáo viên
3. **Học sinh đăng ký** tài khoản → đăng nhập → xem danh sách lớp đang mở (lọc theo môn) → đăng ký học 1 lớp
4. **Trong buổi học**: Giáo viên tạo buổi học → nhập tiêu đề bài học → điểm danh học sinh → đính kèm tài liệu
5. Giáo viên **nhập điểm** và **viết nhận xét** cho học sinh
6. Học sinh xem: lịch học, tài liệu (tải về), điểm, nhận xét, lịch sử điểm danh
7. Admin: quản lý tài khoản (khoá/mở), xem toàn bộ lớp học, xem thống kê tổng quan
8. **Dashboard** hiển thị theo vai trò ngay khi đăng nhập:
   - Giáo viên → lịch giảng dạy (các lớp đang dạy, buổi học sắp tới, trạng thái điểm danh)
   - Học sinh → lịch học đã đăng ký + danh sách lớp đang mở để đăng ký thêm

---

## 4. DANH SÁCH MODULE

| # | Module | Người phụ trách |
| --- | --- | --- |
| M1 | Auth & Phân quyền (Đăng ký/Đăng nhập/Session) | A |
| M2 | Quản lý người dùng (Admin) | B |
| M3 | Quản lý lớp học (Giáo viên tạo/sửa lớp, môn tự động theo GV) | B |
| M4 | Đăng ký học (Học sinh chọn lớp) | C |
| M5 | Buổi học: điểm danh + tiêu đề bài học | C |
| M6 | Tài liệu đính kèm | D |
| M7 | Điểm số | D |
| M8 | Nhận xét học sinh | D |
| M9 | Dashboard theo từng vai trò | A/B/C phối hợp |

---

## 5. CHỨC NĂNG CHI TIẾT THEO MODULE

**M1 – Auth**

- Đăng ký Giáo viên: username, password, họ tên, **chọn 1 môn giảng dạy (bắt buộc, cố định)**
- Đăng ký Học sinh: username, password, họ tên (mặc định khối 9)
- Đăng nhập/Đăng xuất, lưu session
- Route guard theo vai trò; Admin không có form đăng ký

**M2 – Quản lý người dùng (Admin)**

- Danh sách tài khoản, lọc theo vai trò
- Khoá/mở khoá tài khoản
- Xem lớp đang dạy/đang học của từng tài khoản

**M3 – Quản lý lớp học**

- Tạo lớp: tên lớp, lịch cố định (thứ + giờ bắt đầu/kết thúc), sĩ số tối đa
- **Môn học tự động = môn đã đăng ký của giáo viên** (không cho chọn tự do)
- 1 giáo viên có thể mở nhiều lớp, nhưng cùng 1 môn
- Sửa/đóng lớp, xem danh sách học sinh trong lớp

**M4 – Đăng ký học**

- Xem danh sách lớp đang mở, lọc theo môn
- Đăng ký lớp (check sĩ số còn trống)
- Huỷ đăng ký (trước buổi học đầu tiên)

**M5 – Buổi học**

- Tạo buổi học theo ngày cụ thể (thủ công)
- Nhập tiêu đề bài học cho buổi
- Điểm danh: Có mặt / Vắng / Trễ theo từng học sinh

**M6 – Tài liệu**

- Đính kèm tài liệu vào 1 buổi học cụ thể (base64 hoặc link)
- Học sinh xem & tải về tài liệu của buổi đã đăng ký

**M7 – Điểm số**

- Nhập điểm theo lớp/học sinh (1 hoặc vài cột điểm)
- Học sinh xem điểm của mình theo từng lớp

**M8 – Nhận xét**

- Giáo viên viết nhận xét học sinh
- Học sinh xem nhận xét

**M9 – Dashboard**

- Admin: tổng số GV/HS/lớp
- Giáo viên: **"Lịch giảng dạy"** — danh sách lớp đang dạy, lịch tuần, buổi học sắp tới, trạng thái điểm danh
- Học sinh: **"Lịch học của tôi"** (lớp đã đăng ký, buổi sắp tới) + **"Lớp đang mở"** (danh sách lớp còn chỗ, lọc theo môn, đăng ký nhanh)

---

## 6. DỮ LIỆU (Data Model)

```json
users: [
  { id, username, password, role: "admin|teacher|student",
    fullName, active: true,
    subject: "Toan|Van|Anh"   // chỉ có ở giáo viên, cố định sau khi đăng ký
  }
]

classes: [
  { id, className, subject, grade: 9, teacherId, maxSlot,
    schedule: [{ dayOfWeek, start, end }], status: "open|closed" }
]

enrollments: [
  { id, classId, studentId, status: "active|cancelled", registeredAt }
]

sessions: [
  { id, classId, date, title, materials: [materialId,...] }
]

attendance: [
  { id, sessionId, studentId, status: "present|absent|late" }
]

materials: [
  { id, sessionId, fileName, fileData/fileUrl, uploadedAt }
]

grades: [
  { id, classId, studentId, type, score, note }
]

comments: [
  { id, classId, studentId, teacherId, content, createdAt }
]
```

- Mỗi entity = 1 key LocalStorage riêng
- Toàn bộ thao tác qua lớp trừu tượng `db.js` dùng chung (get/save/insert/update/delete) để 4 người code song song không xung đột

---

## 7. PHÂN CÔNG 4 THÀNH VIÊN

| Thành viên | Vai trò | Module phụ trách |
| --- | --- | --- |
| A – Lead/Core | Kiến trúc chung: db.js, router, session, auth, khung layout | M1, M9 (khung) |
| B | Quản lý người dùng & lớp học | M2, M3 |
| C | Đăng ký học & buổi học/điểm danh | M4, M5 |
| D | Tài liệu, điểm số, nhận xét | M6, M7, M8 |

Điều kiện làm song song: A dựng `db.js` + schema JSON chuẩn ngay tuần 1 để B/C/D code độc lập theo đúng cấu trúc dữ liệu đã chốt.

---

## 8. ROADMAP 4 TUẦN

| Tuần | Nội dung |
| --- | --- |
| 1 | Chốt schema, viết db.js/router/session; Login-Register (kèm chọn môn GV); seed dữ liệu mẫu |
| 2 | B: CRUD lớp học, quản lý user (Admin); C: đăng ký học, tạo buổi học; D: khung tài liệu/điểm/nhận xét |
| 3 | C: điểm danh hoàn chỉnh; D: upload tài liệu, nhập điểm, nhận xét hoàn chỉnh; B: dashboard Admin/GV; A: dashboard HS |
| 4 | Test toàn bộ luồng (happy path + lỗi), sửa bug, chuẩn hoá UI/UX, chuẩn bị demo, buffer dự phòng |

---

## 9. KỊCH BẢN DEMO

**Happy Path (5–10 phút)**

1. Đăng nhập Giáo viên → tạo lớp "Toán 9A" (lịch thứ 3 & 6, 20h–22h)
2. Đăng ký tài khoản Học sinh → đăng nhập → đăng ký học "Toán 9A"
3. Giáo viên tạo buổi học, nhập tiêu đề, điểm danh, đính kèm tài liệu
4. Giáo viên nhập điểm + nhận xét
5. Học sinh xem lịch học, tải tài liệu, xem điểm & nhận xét (qua Dashboard "Lịch học của tôi")
6. Học sinh xem tab "Lớp đang mở" để đăng ký thêm lớp khác
7. Admin xem Dashboard tổng quan, danh sách tài khoản/lớp

**Trường hợp lỗi**

1. Đăng ký trùng username
2. Đăng ký học khi lớp đã đủ sĩ số
3. Học sinh cố truy cập trang Giáo viên → bị chặn (role guard)
4. Giáo viên cố tạo lớp khác môn đã đăng ký → bị chặn (môn khoá theo hồ sơ)
5. Admin không có lựa chọn đăng ký (chỉ đăng nhập)

---

## 10. GHI CHÚ / RỦI RO CẦN LƯU Ý TRƯỚC KHI VIẾT SRS

- Upload tài liệu bằng base64 có thể vượt giới hạn LocalStorage (\~5–10MB) → cân nhắc giới hạn dung lượng file hoặc dùng link
- Việc tự sinh buổi học theo lịch cố định hàng tuần phức tạp hơn tạo thủ công → MVP nên cho **tạo buổi học thủ công theo từng ngày**
- Có thể gộp UI Dashboard Giáo viên/Học sinh dùng chung 1 component lịch để tiết kiệm công sức
- Việc duyệt tài khoản giáo viên bởi Admin (nếu có) nên **bỏ qua ở MVP**, cho active ngay sau đăng ký để giảm độ phức tạp luồng nghiệp vụ

---

*Tài liệu tổng hợp này là cơ sở đầu vào để soạn SRS chính thức (mục tiêu, phạm vi, yêu cầu chức năng/phi chức năng, data model, use case).*
