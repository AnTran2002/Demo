// modules/sessions/sessions.service.js — Phụ trách: Thành viên C
import { DB } from "../../core/db.js";

export function createSession(classId, { date, title }) {
  return DB.insert("sessions", { classId, date, title, materials: [] });
}

export function replaceSession(sessionId, { date, title }) {
  const session = DB.findById("sessions", sessionId);
  if (!session) throw new Error("Không tìm thấy buổi học cần đổi lịch");
  if (!date) throw new Error("Ngày học không hợp lệ");

  const materials = DB.getAll("materials").filter((item) => item.sessionId === sessionId);
  const replacement = DB.insert("sessions", {
    classId: session.classId,
    date,
    title,
    materials: materials.map((item) => item.id),
  });

  DB.saveAll(
    "materials",
    DB.getAll("materials").map((item) =>
      item.sessionId === sessionId ? { ...item, sessionId: replacement.id } : item
    )
  );
  DB.saveAll(
    "attendance",
    DB.getAll("attendance").filter((item) => item.sessionId !== sessionId)
  );
  DB.remove("sessions", sessionId);

  return replacement;
}

export function listSessionsByClass(classId) {
  return DB.getAll("sessions").filter((s) => s.classId === classId);
}

export function markAttendance(sessionId, studentId, status, note = "") {
  const existing = DB.getAll("attendance").find(
    (a) => a.sessionId === sessionId && a.studentId === studentId
  );
  if (existing) {
    return DB.update("attendance", existing.id, { status, note });
  }
  return DB.insert("attendance", { sessionId, studentId, status, note });
}

export function listAttendanceBySession(sessionId) {
  return DB.getAll("attendance").filter((a) => a.sessionId === sessionId);
}

export function getSessionById(sessionId) {
  return DB.findById("sessions", sessionId);
}

export function listUpcomingSessionsByClass(classId, fromDate) {
  const today = fromDate || new Date().toISOString().slice(0, 10);
  return DB.getAll("sessions")
    .filter((s) => s.classId === classId && s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function hasAttendance(sessionId) {
  return DB.getAll("attendance").some((a) => a.sessionId === sessionId);
}

export function listAttendanceOfStudent(studentId) {
  return DB.getAll("attendance").filter((a) => a.studentId === studentId);
}
