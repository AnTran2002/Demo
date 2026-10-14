// modules/sessions/sessions.service.js — Phụ trách: Thành viên C
import { DB } from "../../core/db.js";
import { assertClassOpen } from "../classes/classes.service.js";

export function createSession(classId, { date, title } = {}) {
  // Lớp đã đóng/chưa duyệt => không thể tạo buổi học mới
  assertClassOpen(classId);
  return DB.insert("sessions", { classId, date, title, materials: [] });
}

export function listSessionsByClass(classId) {
  return DB.getAll("sessions").filter((s) => s.classId === classId);
}

export function markAttendance(sessionId, studentId, status, note = "") {
  const session = DB.findById("sessions", sessionId);
  if (session) {
    const cls = DB.findById("classes", session.classId);
    if (cls && cls.status !== "open") {
      throw new Error(cls.status === "closed" ? "Lớp đã đóng" : "Lớp chưa được Admin duyệt");
    }
  }
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
