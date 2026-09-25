// data/seed.js
// Dữ liệu khởi tạo mẫu: seed 1 lần khi app chạy lần đầu (nếu LocalStorage rỗng).
// Thành viên A phụ trách chỉnh sửa file này khi cần thêm dữ liệu demo.

import { DB } from "../core/db.js";

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

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
    {
      id: "t-toan",
      username: "teacher",
      password: "123456",
      role: "teacher",
      fullName: "Nguyễn Văn Hùng",
      subject: "Toan",
      active: true,
    },
    {
      id: "t-van",
      username: "covan",
      password: "123456",
      role: "teacher",
      fullName: "Trần Thị Lan",
      subject: "Van",
      active: true,
    },
    {
      id: "t-anh",
      username: "coanh",
      password: "123456",
      role: "teacher",
      fullName: "Lê Minh Đức",
      subject: "Anh",
      active: true,
    },
    {
      id: "s-01",
      username: "student",
      password: "123456",
      role: "student",
      fullName: "Phạm Thu Trang",
      active: true,
    },
    {
      id: "s-02",
      username: "student2",
      password: "123456",
      role: "student",
      fullName: "Vũ Quang Huy",
      active: true,
    },
    {
      id: "s-03",
      username: "student3",
      password: "123456",
      role: "student",
      fullName: "Đặng Bảo Ngọc",
      active: true,
    },
  ]);

  DB.seedIfEmpty("classes", [
    {
      id: "c-toan-9a",
      className: "Toán 9A",
      subject: "Toan",
      grade: 9,
      teacherId: "t-toan",
      maxSlot: 20,
      schedule: [
        { dayOfWeek: 3, start: "18:00", end: "19:30" },
        { dayOfWeek: 6, start: "18:00", end: "19:30" },
      ],
      status: "open",
    },
    {
      id: "c-van-9a",
      className: "Văn 9A",
      subject: "Van",
      grade: 9,
      teacherId: "t-van",
      maxSlot: 20,
      schedule: [{ dayOfWeek: 2, start: "18:00", end: "19:30" }],
      status: "open",
    },
    {
      id: "c-anh-9a",
      className: "Anh 9A",
      subject: "Anh",
      grade: 9,
      teacherId: "t-anh",
      maxSlot: 15,
      schedule: [
        { dayOfWeek: 4, start: "19:00", end: "20:30" },
        { dayOfWeek: 7, start: "09:00", end: "10:30" },
      ],
      status: "open",
    },
    {
      id: "c-toan-9b",
      className: "Toán 9B (LT)",
      subject: "Toan",
      grade: 9,
      teacherId: "t-toan",
      maxSlot: 18,
      schedule: [{ dayOfWeek: 5, start: "18:00", end: "19:30" }],
      status: "open",
    },
  ]);

  DB.seedIfEmpty("enrollments", [
    { id: "e-1", classId: "c-toan-9a", studentId: "s-01", status: "active", registeredAt: daysFromNow(-20) },
    { id: "e-2", classId: "c-van-9a", studentId: "s-01", status: "active", registeredAt: daysFromNow(-18) },
    { id: "e-3", classId: "c-toan-9a", studentId: "s-02", status: "active", registeredAt: daysFromNow(-19) },
    { id: "e-4", classId: "c-anh-9a", studentId: "s-02", status: "active", registeredAt: daysFromNow(-15) },
    { id: "e-5", classId: "c-van-9a", studentId: "s-03", status: "active", registeredAt: daysFromNow(-14) },
    { id: "e-6", classId: "c-anh-9a", studentId: "s-03", status: "active", registeredAt: daysFromNow(-12) },
    { id: "e-7", classId: "c-toan-9b", studentId: "s-03", status: "active", registeredAt: daysFromNow(-10) },
  ]);

  DB.seedIfEmpty("sessions", [
    { id: "sess-1", classId: "c-toan-9a", date: daysFromNow(-4), title: "Hàm số bậc nhất", materials: [] },
    { id: "sess-2", classId: "c-toan-9a", date: daysFromNow(3), title: "Phương trình bậc hai", materials: ["m-1"] },
    { id: "sess-3", classId: "c-van-9a", date: daysFromNow(1), title: "Văn nghị luận xã hội", materials: [] },
    { id: "sess-4", classId: "c-anh-9a", date: daysFromNow(2), title: "Grammar: Conditional sentences", materials: ["m-2"] },
    { id: "sess-5", classId: "c-anh-9a", date: daysFromNow(-2), title: "Vocabulary: The environment", materials: [] },
    { id: "sess-6", classId: "c-toan-9b", date: daysFromNow(4), title: "Ôn tập Hình học", materials: [] },
  ]);

  DB.seedIfEmpty("attendance", [
    { id: "att-1", sessionId: "sess-1", studentId: "s-01", status: "present" },
    { id: "att-2", sessionId: "sess-1", studentId: "s-02", status: "late" },
    { id: "att-3", sessionId: "sess-5", studentId: "s-02", status: "present" },
    { id: "att-4", sessionId: "sess-5", studentId: "s-03", status: "absent" },
  ]);

  DB.seedIfEmpty("materials", [
    {
      id: "m-1",
      sessionId: "sess-2",
      fileName: "PT-bac-hai.pdf",
      fileData: "https://drive.google.com/drive/u/0/my-drive",
      uploadedAt: daysFromNow(-1),
    },
    {
      id: "m-2",
      sessionId: "sess-4",
      fileName: "Conditional-sentences.pdf",
      fileData: "https://drive.google.com/drive/u/0/my-drive",
      uploadedAt: daysFromNow(-1),
    },
  ]);

  DB.seedIfEmpty("grades", [
    { id: "g-1", classId: "c-toan-9a", studentId: "s-01", type: "Thường xuyên", score: 8.5, note: "Kiểm tra miệng" },
    { id: "g-2", classId: "c-toan-9a", studentId: "s-01", type: "Định kỳ", score: 7.5, note: "Bài 1 tiết" },
    { id: "g-3", classId: "c-toan-9a", studentId: "s-02", type: "Thường xuyên", score: 6.0, note: "Kiểm tra miệng" },
    { id: "g-4", classId: "c-van-9a", studentId: "s-01", type: "Định kỳ", score: 9.0, note: "Bài 1 tiết" },
    { id: "g-5", classId: "c-anh-9a", studentId: "s-02", type: "Thường xuyên", score: 7.0, note: "Kiểm tra 15 phút" },
  ]);

  DB.seedIfEmpty("comments", [
    {
      id: "cm-1",
      classId: "c-toan-9a",
      studentId: "s-01",
      teacherId: "t-toan",
      content: "Em có tư duy tốt, cần chăm phát biểu hơn.",
      createdAt: daysFromNow(-3),
    },
    {
      id: "cm-2",
      classId: "c-toan-9a",
      studentId: "s-02",
      teacherId: "t-toan",
      content: "Cần ôn lại dạng bài phương trình để theo kịp lớp.",
      createdAt: daysFromNow(-3),
    },
  ]);
}