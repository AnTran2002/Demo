// modules/enrollment/enrollment.service.js — Phụ trách: Thành viên C
import { DB } from "../../core/db.js";

export function enroll(studentId, classId) {
  const cls = DB.findById("classes", classId);
  if (!cls) throw new Error("Lớp không tồn tại");
  if (cls.status !== "open") throw new Error("Lớp đã đóng");

  const already = DB.getAll("enrollments").some(
    (e) => e.classId === classId && e.studentId === studentId && e.status === "active"
  );
  if (already) throw new Error("Bạn đã đăng ký lớp này");

  const enrollments = DB.getAll("enrollments").filter(
    (e) => e.classId === classId && e.status === "active"
  );
  if (enrollments.length >= cls.maxSlot) {
    throw new Error("Lớp đã đủ sĩ số");
  }

  return DB.insert("enrollments", {
    classId,
    studentId,
    status: "active",
    registeredAt: new Date().toISOString(),
  });
}

export function cancelEnrollment(enrollmentId) {
  const enrollment = DB.findById("enrollments", enrollmentId);
  if (enrollment) {
    const hasSession = DB.getAll("sessions").some((s) => s.classId === enrollment.classId);
    if (hasSession) {
      throw new Error("Lớp đã có buổi học — không thể hủy đăng ký");
    }
  }
  return DB.update("enrollments", enrollmentId, { status: "cancelled" });
}

export function listClassesOfStudent(studentId) {
  const enrollments = DB.getAll("enrollments").filter(
    (e) => e.studentId === studentId && e.status === "active"
  );
  const classes = DB.getAll("classes");
  return enrollments.map((e) => classes.find((c) => c.id === e.classId));
}

export function listEnrollmentsByClass(classId) {
  return DB.getAll("enrollments").filter(
    (e) => e.classId === classId && e.status === "active"
  );
}

export function isEnrolled(studentId, classId) {
  return DB.getAll("enrollments").some(
    (e) => e.studentId === studentId && e.classId === classId && e.status === "active"
  );
}

export function getEnrollment(studentId, classId) {
  return (
    DB.getAll("enrollments").find(
      (e) => e.studentId === studentId && e.classId === classId && e.status === "active"
    ) || null
  );
}
