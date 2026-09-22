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
