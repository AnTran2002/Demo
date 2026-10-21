// modules/sessions/sessions.service.js — Phụ trách: Thành viên C
import { DB } from "../../core/db.js";
import { assertClassOpen } from "../classes/classes.service.js";
import { addDays, formatDate, todayStr, weekdayLabel, weekdayOf } from "../../data/constants.js";

// Các thứ trong tuần lớp học có buổi học cố định (2..8)
export function getScheduledWeekdays(cls) {
  return [...new Set((cls?.schedule || []).map((s) => Number(s.dayOfWeek)))].sort(
    (a, b) => a - b,
  );
}

// Buổi học bắt buộc phải nằm đúng ngày trong lịch học cố định đã đăng ký của lớp
export function assertDateInSchedule(cls, date) {
  const days = getScheduledWeekdays(cls);
  if (!days.length) {
    throw new Error("Lớp học chưa có lịch học cố định trong tuần để tạo buổi học");
  }
  const dow = weekdayOf(date);
  if (!days.includes(dow)) {
    throw new Error(
      `Ngày ${formatDate(date)} (${weekdayLabel(dow)}) không thuộc lịch học cố định của lớp ` +
        `(${days.map(weekdayLabel).join(", ")})`,
    );
  }
}

// Ngày bắt đầu tìm kiếm buổi học hợp lệ: không sớm hơn hôm nay và sau buổi học cuối cùng
function sessionSearchCursor(classId, fromDate) {
  const sessions = listSessionsByClass(classId);
  const lastDate = sessions.reduce((max, s) => (s.date > max ? s.date : max), "");
  let cursor = fromDate;
  if (lastDate) {
    const afterLast = addDays(lastDate, 1);
    if (afterLast > cursor) cursor = afterLast;
  }
  return cursor;
}

// Danh sách các ngày hợp lệ sắp tới theo lịch học cố định (bỏ qua ngày đã có buổi học)
export function listUpcomingScheduledDates(classId, fromDate = todayStr(), count = 6) {
  const cls = DB.findById("classes", classId);
  if (!cls) return [];
  const days = getScheduledWeekdays(cls);
  if (!days.length) return [];

  const used = new Set(listSessionsByClass(classId).map((s) => s.date));
  const cursor = sessionSearchCursor(classId, fromDate);
  const result = [];

  for (let i = 0; i < 120 && result.length < count; i++) {
    const d = addDays(cursor, i);
    if (days.includes(weekdayOf(d)) && !used.has(d)) result.push(d);
  }
  return result;
}

// Ngày hợp lệ kế tiếp — dùng để tự động chọn khi thêm buổi học
export function getNextSessionDate(classId, fromDate = todayStr()) {
  return listUpcomingScheduledDates(classId, fromDate, 1)[0] || null;
}

export function createSession(classId, { date, title, room } = {}) {
  // Lớp đã đóng/chưa duyệt => không thể tạo buổi học mới
  const cls = assertClassOpen(classId);
  // Buổi học chỉ được tạo từ hôm nay trở đi, không thể tạo lùi ngày trong quá khứ
  if (!date) throw new Error("Vui lòng chọn ngày học");
  if (date < todayStr()) {
    throw new Error("Không thể tạo buổi học trong quá khứ — chỉ có thể tạo buổi học từ hôm nay trở đi");
  }
  // Buổi học phải theo đúng lịch học cố định của lớp
  assertDateInSchedule(cls, date);

  return DB.insert("sessions", { classId, date, title, room, materials: [] });
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
