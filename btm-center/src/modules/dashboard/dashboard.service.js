// modules/dashboard/dashboard.service.js
// Tổng hợp dữ liệu hiển thị cho từng Dashboard theo vai trò.
import { DB } from "../../core/db.js";

export function getAdminStats() {
  const users = DB.getAll("users");
  return {
    totalTeachers: users.filter((u) => u.role === "teacher").length,
    totalStudents: users.filter((u) => u.role === "student").length,
    totalClasses: DB.getAll("classes").length,
  };
}

export function getTeacherSchedule(teacherId) {
  return DB.getAll("classes").filter((c) => c.teacherId === teacherId);
}

export function getStudentSchedule(studentId) {
  const enrollments = DB.getAll("enrollments").filter(
    (e) => e.studentId === studentId && e.status === "active"
  );
  const classes = DB.getAll("classes");
  return enrollments.map((e) => classes.find((c) => c.id === e.classId));
}
