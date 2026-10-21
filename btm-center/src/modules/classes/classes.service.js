// modules/classes/classes.service.js — Phụ trách: Thành viên B
import { DB } from "../../core/db.js";

// ------------------------------------------------------------------
// Quy tắc nghiệp vụ của hệ thống về lớp học
// ------------------------------------------------------------------
// Mỗi lớp chỉ được học tối đa 2 buổi trong 1 tuần.
export const MAX_SESSIONS_PER_WEEK = 2;
// Mỗi lớp chỉ nhận tối đa 20 học sinh.
export const MAX_STUDENTS_PER_CLASS = 20;

// Sức chứa thực tế của một lớp (luôn bị chặn trần 20 học sinh)
export function getClassCapacity(cls) {
  const declared = Number(cls?.maxSlot) || 0;
  const capacity = declared > 0 ? declared : MAX_STUDENTS_PER_CLASS;
  return Math.min(capacity, MAX_STUDENTS_PER_CLASS);
}

// Chuẩn hoá & kiểm tra lịch học cố định trong tuần (1 - 2 buổi)
export function normalizeSchedule(schedule) {
  if (!Array.isArray(schedule) || !schedule.length) {
    throw new Error("Lớp học phải có ít nhất 1 buổi học trong tuần");
  }
  if (schedule.length > MAX_SESSIONS_PER_WEEK) {
    throw new Error(`Mỗi lớp chỉ được học tối đa ${MAX_SESSIONS_PER_WEEK} buổi trong tuần`);
  }

  const usedDays = new Set();
  return schedule.map((s) => {
    const dayOfWeek = Number(s?.dayOfWeek);
    const start = String(s?.start || "").trim();
    const end = String(s?.end || "").trim();

    if (!dayOfWeek) throw new Error("Ngày học không hợp lệ");
    if (!start || !end) throw new Error("Giờ bắt đầu và giờ kết thúc không hợp lệ");
    if (start >= end) throw new Error("Giờ kết thúc phải sau giờ bắt đầu");
    if (usedDays.has(dayOfWeek)) {
      throw new Error("Mỗi ngày trong tuần chỉ được học 1 buổi");
    }
    usedDays.add(dayOfWeek);

    return { dayOfWeek, start, end };
  });
}

export function createClass(teacher, { className, schedule, maxSlot }) {
  const slots = normalizeSchedule(schedule);
  const capacity = getClassCapacity({ maxSlot });

  return DB.insert("classes", {
    className,
    subject: teacher.subject, // môn tự động lấy theo giáo viên
    grade: 9,
    teacherId: teacher.id,
    maxSlot: capacity,
    schedule: slots, // [{ dayOfWeek, start, end }] — tối đa 2 buổi/tuần
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

// Trạng thái hợp lệ của một lớp học
export const CLASS_STATUSES = ["pending", "open", "closed"];

// Đổi trạng thái lớp. Chỉ được gọi qua luồng phê duyệt yêu cầu của Admin
// (module classes/class-requests.service.js) — Admin không đóng lớp trực tiếp.
export function setClassStatus(classId, status) {
  if (!CLASS_STATUSES.includes(status)) throw new Error("Trạng thái lớp không hợp lệ");
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
