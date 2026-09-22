// modules/enrollment/enrollment.service.js — Phụ trách: Thành viên C
import { DB } from "../../core/db.js";

export function enroll(studentId, classId) {
  const cls = DB.findById("classes", classId);
  if (!cls) throw new Error("Lớp không tồn tại");

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
  return DB.update("enrollments", enrollmentId, { status: "cancelled" });
}

export function listClassesOfStudent(studentId) {
  const enrollments = DB.getAll("enrollments").filter(
    (e) => e.studentId === studentId && e.status === "active"
  );
  const classes = DB.getAll("classes");
  return enrollments.map((e) => classes.find((c) => c.id === e.classId));
}
