// modules/dashboard/dashboard.service.js
// Tổng hợp dữ liệu hiển thị cho từng Dashboard theo vai trò.
import { DB } from "../../core/db.js";
import { todayStr } from "../../data/constants.js";

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

function enrolledCountOf(classId) {
  return DB.getAll("enrollments").filter(
    (e) => e.classId === classId && e.status === "active"
  ).length;
}

function listSessions(classId) {
  return DB.getAll("sessions")
    .filter((s) => s.classId === classId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function upcomingSession(classId) {
  const today = todayStr();
  const next = listSessions(classId).find((s) => s.date >= today);
  return next || null;
}

export function sessionAttendanceInfo(sessionId) {
  const records = DB.getAll("attendance").filter((a) => a.sessionId === sessionId);
  return {
    done: records.length > 0,
    marked: records.length,
  };
}

export function getTeacherName(teacherId) {
  if (!teacherId) return "Chưa phân công";
  const users = DB.getAll("users");
  const teacher = users.find((u) => u.id === teacherId);
  return teacher ? teacher.fullName : "Chưa phân công";
}

function enrichClass(c) {
  const sessions = listSessions(c.id);
  return {
    ...c,
    teacherName: getTeacherName(c.teacherId),
    enrolled: enrolledCountOf(c.id),
    sessions,
    nextSession: sessions.find((s) => s.date >= todayStr()) || null,
  };
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

export function getAdminAccountClasses(user) {
  if (user.role === "teacher") {
    return getTeacherSchedule(user.id).map(enrichClass);
  }
  if (user.role === "student") {
    const classes = DB.getAll("classes");
    return DB.getAll("enrollments")
      .filter((e) => e.studentId === user.id && e.status === "active")
      .map((e) => classes.find((c) => c.id === e.classId))
      .filter(Boolean)
      .map(enrichClass);
  }
  return [];
}

export function getTeacherOverview(teacherId) {
  const classes = getTeacherSchedule(teacherId).map(enrichClass);

  return {
    totalClasses: classes.length,
    totalStudents: classes.reduce((sum, c) => sum + c.enrolled, 0),
    classes,
  };
}

export function getTeacherWeekSchedule(teacherId) {
  return getTeacherSchedule(teacherId)
    .filter((c) => c.status === "open")
    .map(enrichClass);
}

export function getStudentOverview(studentId) {
  const allEnrollments = DB.getAll("enrollments");
  const enrollments = allEnrollments.filter(
    (e) => e.studentId === studentId && e.status === "active"
  );
  const classes = DB.getAll("classes");
  const enrolledIds = new Set(enrollments.map((e) => e.classId));
  const enrolledCounts = new Map();
  for (const enrollment of allEnrollments) {
    if (enrollment.status !== "active") continue;
    enrolledCounts.set(
      enrollment.classId,
      (enrolledCounts.get(enrollment.classId) || 0) + 1
    );
  }
  const enrolledCount = (classId) => enrolledCounts.get(classId) || 0;

  const myClasses = enrollments
    .map((e) => {
      const cls = classes.find((c) => c.id === e.classId);
      return cls
        ? {
            ...enrichClass(cls),
            teacherName: getTeacherName(cls.teacherId),
            enrollmentId: e.id,
            enrolled: enrolledCount(cls.id),
          }
        : null;
    })
    .filter((c) => c && c.status === "open");

  const myEnrollmentId = (classId) =>
    enrollments.find((e) => e.classId === classId)?.id;

  const openClasses = classes
    .filter((c) => c.status === "open")
    .map((c) => ({
      ...c,
      teacherName: getTeacherName(c.teacherId),
      enrolled: enrolledCount(c.id),
      isEnrolled: enrolledIds.has(c.id),
      enrollmentId: myEnrollmentId(c.id),
    }));

  return { myClasses, openClasses };
}