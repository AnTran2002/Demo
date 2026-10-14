// modules/classes/classes.service.js — Phụ trách: Thành viên B
import { DB } from "../../core/db.js";

export function createClass(teacher, { className, schedule, maxSlot }) {
  return DB.insert("classes", {
    className,
    subject: teacher.subject, // môn tự động lấy theo giáo viên
    grade: 9,
    teacherId: teacher.id,
    maxSlot,
    schedule, // [{ dayOfWeek, start, end }]
    status: "open",
  });
}

export function listClassesByTeacher(teacherId) {
  return DB.getAll("classes").filter((c) => c.teacherId === teacherId);
}

export function getTeacherName(teacherId) {
  if (!teacherId) return "Chưa phân công";
  const users = DB.getAll("users");
  const teacher = users.find((u) => u.id === teacherId);
  return teacher ? teacher.fullName : "Chưa phân công";
}

export function listOpenClasses(subject = null) {
  const users = DB.getAll("users");
  const teacherMap = new Map(users.map((u) => [u.id, u.fullName]));
  const classes = DB.getAll("classes")
    .filter((c) => c.status === "open")
    .map((c) => ({
      ...c,
      teacherName: teacherMap.get(c.teacherId) || "Chưa phân công",
    }));
  return subject ? classes.filter((c) => c.subject === subject) : classes;
}

export function getClassById(classId) {
  const cls = DB.findById("classes", classId);
  if (!cls) return null;
  const users = DB.getAll("users");
  const teacher = users.find((u) => u.id === cls.teacherId);
  return {
    ...cls,
    teacherName: teacher ? teacher.fullName : "Chưa phân công",
  };
}

export function listAllClasses() {
  const users = DB.getAll("users");
  const teacherMap = new Map(users.map((u) => [u.id, u.fullName]));
  return DB.getAll("classes").map((c) => ({
    ...c,
    teacherName: teacherMap.get(c.teacherId) || "Chưa phân công",
  }));
}

export function setClassStatus(classId, status) {
  return DB.update("classes", classId, { status });
}

// Kiểm tra lớp học có đang mở để thao tác hay không
export function isClassOpen(classId) {
  const cls = DB.findById("classes", classId);
  return !!cls && cls.status === "open";
}

// Ném lỗi nếu cố thao tác trên lớp đã đóng/chưa duyệt
export function assertClassOpen(classId) {
  const cls = DB.findById("classes", classId);
  if (!cls) throw new Error("Lớp không tồn tại");
  if (cls.status === "closed") throw new Error("Lớp đã đóng");
  if (cls.status !== "open") throw new Error("Lớp chưa được Admin duyệt");
  return cls;
}

export function updateClassInfo(classId, patch) {
  return DB.update("classes", classId, patch);
}

export function listStudentsOfClass(classId) {
  const enrollments = DB.getAll("enrollments").filter(
    (e) => e.classId === classId && e.status === "active"
  );
  const users = DB.getAll("users");
  return enrollments
    .map((e) => users.find((u) => u.id === e.studentId) || null)
    .filter(Boolean);
}
