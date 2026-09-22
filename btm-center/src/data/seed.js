// data/seed.js
// Dữ liệu khởi tạo mẫu: seed 1 lần khi app chạy lần đầu (nếu LocalStorage rỗng).
// Thành viên A phụ trách chỉnh sửa file này khi cần thêm dữ liệu demo.

import { DB } from "../core/db.js";

export function seedDatabase() {
  DB.seedIfEmpty("users", [
    {
      id: "admin-01",
      username: "admin",
      password: "admin123",
      role: "admin",
      fullName: "Quản trị viên",
      active: true,
    },
  ]);

  DB.seedIfEmpty("classes", []);
  DB.seedIfEmpty("enrollments", []);
  DB.seedIfEmpty("sessions", []);
  DB.seedIfEmpty("attendance", []);
  DB.seedIfEmpty("materials", []);
  DB.seedIfEmpty("grades", []);
  DB.seedIfEmpty("comments", []);
}
