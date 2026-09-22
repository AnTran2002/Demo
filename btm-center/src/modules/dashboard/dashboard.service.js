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

// Dữ liệu tổng hợp riêng cho từng Dashboard (đã redesign giao diện)

export function getAdminOverview() {
  const users = DB.getAll("users");
  const classes = DB.getAll("classes");
  const enrollments = DB.getAll("enrollments");

  const teacherNameOf = (id) =>
    users.find((u) => u.role === "teacher" && u.id === id)?.fullName || "—";
  const enrolledCount = (classId) =>
    enrollments.filter((e) => e.classId === classId && e.status === "active").length;

  return {
    totalTeachers: users.filter((u) => u.role === "teacher").length,
    totalStudents: users.filter((u) => u.role === "student").length,
    totalClasses: classes.length,
    openClasses: classes.filter((c) => c.status === "open").length,
    users,
    classes: classes.map((c) => ({
      ...c,
      teacherName: teacherNameOf(c.teacherId),
      enrolled: enrolledCount(c.id),
    })),
  };
}

export function getTeacherOverview(teacherId) {
  const classes = getTeacherSchedule(teacherId);
  const enrolledCount = (classId) =>
    DB.getAll("enrollments").filter(
      (e) => e.classId === classId && e.status === "active"
    ).length;

  const withCounts = classes.map((c) => ({ ...c, enrolled: enrolledCount(c.id) }));
  return {
    totalClasses: withCounts.length,
    totalStudents: withCounts.reduce((sum, c) => sum + c.enrolled, 0),
    classes: withCounts,
  };
}

export function getStudentOverview(studentId) {
  const enrollments = DB.getAll("enrollments").filter(
    (e) => e.studentId === studentId && e.status === "active"
  );
  const classes = DB.getAll("classes");
  const enrolledIds = new Set(enrollments.map((e) => e.classId));
  const enrolledCount = (classId) =>
    DB.getAll("enrollments").filter(
      (e) => e.classId === classId && e.status === "active"
    ).length;

  const myClasses = enrollments
    .map((e) => {
      const cls = classes.find((c) => c.id === e.classId);
      return cls
        ? { ...cls, enrollmentId: e.id, enrolled: enrolledCount(cls.id) }
        : null;
    })
    .filter(Boolean);

  const myEnrollmentId = (classId) =>
    enrollments.find((e) => e.classId === classId)?.id;

  const openClasses = classes
    .filter((c) => c.status === "open")
    .map((c) => ({
      ...c,
      enrolled: enrolledCount(c.id),
      isEnrolled: enrolledIds.has(c.id),
      enrollmentId: myEnrollmentId(c.id),
    }));

  return { myClasses, openClasses };
}
