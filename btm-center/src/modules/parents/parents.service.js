// modules/parents/parents.service.js
// Nghiệp vụ liên kết phụ huynh <-> học sinh.
// Liên kết chỉ dựa trên id (mã học sinh); KHÔNG sao chép dữ liệu học sinh sang
// tài khoản phụ huynh — mọi dashboard phụ huynh đều đọc chung các entity
// (enrollments, grades, sessions, attendance, comments, materials) theo studentId.

import { DB } from "../../core/db.js";

// Lấy học sinh đang được tài khoản phụ huynh này liên kết (null nếu không còn liên kết).
export function getLinkedStudent(parentId) {
  const parent = DB.findById("users", parentId);
  if (!parent || parent.role !== "parent" || !parent.studentId) return null;
  return DB.findById("users", parent.studentId);
}

export function listParentsOfStudent(studentId) {
  return DB.getAll("users").filter(
    (u) => u.role === "parent" && u.studentId === studentId
  );
}

// Danh sách học sinh có thể được liên kết: học sinh đang hoạt động và CHƯA có phụ huynh liên kết.
export function listStudentsAvailableForLink() {
  return DB.getAll("users").filter(
    (u) =>
      u.role === "student" &&
      u.active &&
      listParentsOfStudent(u.id).length === 0
  );
}

// Gán (hoặc thay đổi) học sinh liên kết cho tài khoản phụ huynh.
// Ràng buộc: học sinh phải tồn tại, là học sinh, đang hoạt động và chưa có phụ huynh khác liên kết.
export function linkParentToStudent(parentId, studentId) {
  const parent = DB.findById("users", parentId);
  if (!parent || parent.role !== "parent") {
    throw new Error("Tài khoản phụ huynh không tồn tại");
  }
  const student = assertStudentLinkable(studentId);
  return DB.update("users", parentId, { studentId: student.id });
}

// Hủy liên kết giữa tài khoản phụ huynh và học sinh hiện tại.
export function unlinkParent(parentId) {
  const parent = DB.findById("users", parentId);
  if (!parent || parent.role !== "parent") {
    throw new Error("Tài khoản phụ huynh không tồn tại");
  }
  return DB.update("users", parentId, { studentId: null });
}

// Kiểm tra mã học sinh trước khi đăng ký tài khoản phụ huynh.
// Trả về user học sinh tương ứng, ném lỗi nếu mã không hợp lệ.
export function assertStudentLinkable(studentId) {
  const code = String(studentId ?? "").trim();
  if (!code) throw new Error("Vui lòng nhập mã học sinh cần liên kết");

  const student = DB.findById("users", code);
  if (!student) throw new Error("Mã học sinh không tồn tại");
  if (student.role !== "student") {
    throw new Error(`Mã "${code}" không thuộc tài khoản học sinh`);
  }
  if (!student.active) throw new Error(`Tài khoản học sinh ${student.fullName} đã bị khoá`);
  if (listParentsOfStudent(student.id).length > 0) {
    throw new Error(`Học sinh ${student.fullName} đã có tài khoản phụ huynh được liên kết`);
  }
  return student;
}