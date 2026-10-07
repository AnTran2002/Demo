// modules/notifications/notifications.service.js
// Nghiệp vụ thông báo cho phụ huynh, dựa trên đúng dữ liệu dùng chung với giáo viên.
//
// - ĐIỂM DANH: KHÔNG tạo bản ghi thông báo riêng. Thông báo được DỰNG LẠI từ
//   btm_attendance + btm_sessions + btm_classes mỗi lần phụ huynh mở trang.
//   Nhờ vậy dữ liệu phụ huynh và giáo viên luôn là một và không bao giờ lệch nhau.
// - YÊU CẦU HỦY MÔN: phải lưu trạng thái (chờ / đồng ý / từ chối) nên mới có entity
//   riêng btm_cancel_requests — đây là sự kiện mới, không phải bản sao dữ liệu.

import { DB } from "../../core/db.js";
import { getStudentOverview } from "../dashboard/dashboard.service.js";
import { cancelEnrollment } from "../enrollment/enrollment.service.js";
import { getClassById } from "../classes/classes.service.js";
import {
  listSessionsByClass,
  listAttendanceOfStudent,
} from "../sessions/sessions.service.js";
import { formatDate, subjectLabel, ATTENDANCE_LABELS } from "../../data/constants.js";

const REQ_ENTITY = "cancel_requests";

const dateOf = (v) => String(v || "").slice(0, 10);

// ---------------------------------------------------------------- yêu cầu hủy môn

// Học sinh gửi yêu cầu hủy 1 lớp — phụ huynh phải xác nhận mới hủy thật.
export function requestCancelClass(studentId, classId) {
  const cls = getClassById(classId);
  if (!cls) throw new Error("Lớp không tồn tại");

  const row = getStudentOverview(studentId).myClasses.find((c) => c.id === classId);
  if (!row) throw new Error("Bạn không đang học lớp này");
  if (getPendingRequest(studentId, classId)) {
    throw new Error("Đã có yêu cầu hủy lớp này đang chờ phụ huynh xác nhận");
  }
  if (listSessionsByClass(classId).length > 0) {
    throw new Error("Lớp đã có buổi học — không thể hủy đăng ký");
  }

  return DB.insert(REQ_ENTITY, {
    studentId,
    classId,
    enrollmentId: row.enrollmentId,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}

export function getPendingRequest(studentId, classId) {
  return (
    DB.getAll(REQ_ENTITY).find(
      (r) => r.studentId === studentId && r.classId === classId && r.status === "pending"
    ) || null
  );
}

export function listRequestsOfStudent(studentId) {
  return DB.getAll(REQ_ENTITY)
    .filter((r) => r.studentId === studentId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function listPendingRequestsOfStudent(studentId) {
  return listRequestsOfStudent(studentId).filter((r) => r.status === "pending");
}

// Phụ huynh quyết định: "approved" | "rejected".
// Khi đồng ý gọi cancelEnrollment() để tôn trọng quy tắc sẵn có của hệ thống
// (lớp đã có buổi học thì không được hủy) — không vòng qua để phá logic.
export function decideCancelRequest(requestId, decision) {
  const req = DB.findById(REQ_ENTITY, requestId);
  if (!req) throw new Error("Yêu cầu hủy môn không tồn tại");
  if (req.status !== "pending") throw new Error("Yêu cầu này đã được xử lý trước đó");
  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("Quyết định không hợp lệ");
  }

  if (decision === "approved") {
    const enrollment = DB.findById("enrollments", req.enrollmentId);
    if (!enrollment || enrollment.status !== "active") {
      throw new Error("Lớp này không còn đăng ký — không thể hủy");
    }
    cancelEnrollment(req.enrollmentId); // ném lỗi nếu lớp đã có buổi học
  }

  return DB.update(REQ_ENTITY, requestId, {
    status: decision,
    decidedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------- dựng thông báo

// Gom session của các lớp mà học sinh đã/đang đăng ký để tra nhanh
// (mỗi buổi học chỉ thuộc 1 lớp).
function sessionsIndexOfStudent(studentId) {
  const map = new Map();
  const classIds = [
    ...new Set(
      DB.getAll("enrollments")
        .filter((e) => e.studentId === studentId)
        .map((e) => e.classId)
    ),
  ];
  classIds.forEach((id) => listSessionsByClass(id).forEach((s) => map.set(s.id, s)));
  return map;
}

// Thông báo điểm danh: đỏ = vắng mặt · xanh = có mặt hoặc đến trễ.
// Buổi chưa được giáo viên điểm danh không có bản ghi trong btm_attendance
// nên không phát sinh thông báo.
function attendanceNotices(studentId) {
  const sessions = sessionsIndexOfStudent(studentId);

  return listAttendanceOfStudent(studentId)
    .map((a) => {
      const sess = sessions.get(a.sessionId);
      if (!sess) return null;
      const cls = getClassById(sess.classId);
      const where = `môn ${subjectLabel(cls?.subject)}${cls ? ` (${cls.className})` : ""}`;
      const when = `${formatDate(sess.date)}${sess.title ? ` · buổi “${sess.title}”` : ""}`;
      const absent = a.status === "absent";
      const reason = a.note?.trim()
        ? ` Lý do: ${a.note.trim()}.`
        : absent
          ? " Giáo viên không ghi lý do."
          : "";

      return {
        id: `att-${a.id}`,
        kind: "attendance",
        tone: absent ? "danger" : "success",
        icon: absent ? "!" : "✓",
        title: absent
          ? "Con bạn vắng mặt buổi học"
          : `Con bạn đã được điểm danh: ${ATTENDANCE_LABELS[a.status]}`,
        message: `${where}, ${when}.${reason}`,
        when: sess.date,
        sortKey: sess.date,
        request: null,
        canApprove: false,
        blockedReason: "",
      };
    })
    .filter(Boolean);
}

// Yêu cầu còn có thể được duyệt không: đăng ký phải còn hiệu lực và lớp phải chưa
// có buổi học. Trường hợp "lớp đã có buổi học" xảy ra khi học sinh gửi yêu cầu lúc
// lớp còn trống, sau đó giáo viên tạo buổi học đầu tiên. Khi đó không thể hủy, nhưng
// phụ huynh vẫn phải có đường để dọn yêu cầu (bấm "Không đồng ý") thay vì bị kẹt.
function canApprove(r) {
  const enrollment = DB.findById("enrollments", r.enrollmentId);
  if (!enrollment || enrollment.status !== "active") return false;
  return listSessionsByClass(r.classId).length === 0;
}

function requestNotices(studentId) {
  return listRequestsOfStudent(studentId).map((r) => {
    const cls = getClassById(r.classId);
    const className = cls?.className || "lớp đã bị xoá";
    const subject = cls ? ` (${subjectLabel(cls.subject)})` : "";
    const when = ` ngày ${formatDate(dateOf(r.createdAt))}`;
    const pending = r.status === "pending";

    return {
      id: `req-${r.id}`,
      kind: "cancel-request",
      tone: pending ? "danger" : r.status === "approved" ? "success" : "neutral",
      icon: pending ? "?" : r.status === "approved" ? "✓" : "×",
      title: pending
        ? `Con bạn muốn hủy môn ${className}`
        : r.status === "approved"
          ? `Đã hủy môn ${className} theo yêu cầu`
          : `Đã từ chối yêu cầu hủy môn ${className}`,
      message: pending
        ? `Con gửi yêu cầu hủy đăng ký môn ${className}${subject}${when}. ` +
          `Bạn cần xác nhận để môn này bị hủy khỏi danh sách đăng ký của cả con và phụ huynh.`
        : r.status === "approved"
          ? `Môn ${className}${subject} đã bị hủy khỏi danh sách đăng ký.`
          : `Môn ${className}${subject} vẫn được giữ nguyên trong danh sách đăng ký của con.`,
      when: dateOf(r.createdAt),
      // Sắp xếp theo thời điểm xử lý (nếu đã xử lý) để yêu cầu vừa duyệt
      // luôn nằm trên cùng, kể cả khi phát sinh cùng một ngày.
      sortKey: r.decidedAt || r.createdAt,
      request: r,
      canApprove: pending && canApprove(r),
      blockedReason:
        pending && !canApprove(r)
          ? "Lớp đã có buổi học nên không thể hủy — bạn có thể bấm “Không đồng ý” để đóng yêu cầu này."
          : "",
    };
  });
}

export function buildStudentNotifications(studentId) {
  return [...attendanceNotices(studentId), ...requestNotices(studentId)].sort(
    (a, b) =>
      String(b.sortKey).localeCompare(String(a.sortKey)) ||
      String(b.id).localeCompare(String(a.id))
  );
}