// modules/classes/class-requests.service.js — Phụ trách: Thành viên B
// Luồng nghiệp vụ: Giáo viên gửi yêu cầu → Admin phê duyệt / từ chối.
// Lớp học KHÔNG được đóng trực tiếp bởi Admin, mọi thay đổi trạng thái lớp
// (mở / đóng) đều phải đi qua một yêu cầu được Admin phê duyệt.
import { DB } from "../../core/db.js";
import { normalizeSchedule, setClassStatus } from "./classes.service.js";

const ENTITY = "class_requests";

export const CLASS_REQUEST_TYPES = {
  register: "Đăng ký lớp mới",
  reschedule: "Đổi lịch học",
  reopen: "Mở lại lớp học",
  close: "Đóng lớp học",
};

export function listClassRequests() {
  const classes = DB.getAll("classes");
  const users = DB.getAll("users");

  return DB.getAll(ENTITY)
    .map((r) => {
      const cls = classes.find((c) => c.id === r.classId);
      if (!cls) return null;
      const teacher = users.find((u) => u.id === (r.teacherId || cls.teacherId)) || null;
      return { ...r, cls, teacher };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) ||
        String(b.createdAt).localeCompare(String(a.createdAt))
    );
}

export function listPendingClassRequests() {
  return listClassRequests().filter((r) => r.status === "pending");
}

// Tìm yêu cầu đang chờ duyệt của một lớp (tuỳ chọn lọc theo loại yêu cầu)
export function findPendingRequest(classId, type = null) {
  return (
    DB.getAll(ENTITY).find(
      (r) => r.classId === classId && r.status === "pending" && (!type || r.type === type)
    ) || null
  );
}

// Tạo yêu cầu mới (mọi loại yêu cầu đều qua đây để có quy tắc thống nhất)
export function createClassRequest({ type, classId, teacherId, ...payload }) {
  if (!CLASS_REQUEST_TYPES[type]) throw new Error("Loại yêu cầu không hợp lệ");
  const cls = DB.findById("classes", classId);
  if (!cls) throw new Error("Lớp học không tồn tại");

  // Lịch học mới phải tuân thủ quy tắc 1 - 2 buổi/tuần, mỗi ngày 1 buổi
  if (type === "reschedule") {
    payload.newSchedule = normalizeSchedule(payload.newSchedule);
  }

  return DB.insert(ENTITY, {
    type,
    classId,
    teacherId,
    status: "pending",
    createdAt: new Date().toISOString(),
    ...payload,
  });
}

function assertTeacherOwnsClass(teacher, classId) {
  const cls = DB.findById("classes", classId);
  if (!cls) throw new Error("Lớp học không tồn tại");
  if (!teacher || cls.teacherId !== teacher.id) {
    throw new Error("Chỉ giáo viên phụ trách lớp mới được gửi yêu cầu này");
  }
  return cls;
}

function assertNoPendingRequest(classId) {
  if (findPendingRequest(classId)) {
    throw new Error("Lớp này đang có yêu cầu chờ Admin duyệt");
  }
}

// Giáo viên yêu cầu đóng lớp — Admin phê duyệt thì lớp mới đóng.
export function requestCloseClass(teacher, classId) {
  const cls = assertTeacherOwnsClass(teacher, classId);
  if (cls.status !== "open") throw new Error("Chỉ lớp đang mở mới có thể gửi yêu cầu đóng");
  assertNoPendingRequest(classId);
  return createClassRequest({ type: "close", classId, teacherId: teacher.id });
}

// Giáo viên yêu cầu mở lại lớp đã đóng — Admin phê duyệt thì lớp mới mở.
export function requestReopenClass(teacher, classId) {
  const cls = assertTeacherOwnsClass(teacher, classId);
  if (cls.status !== "closed") throw new Error("Chỉ lớp đã đóng mới có thể gửi yêu cầu mở lại");
  assertNoPendingRequest(classId);
  return createClassRequest({ type: "reopen", classId, teacherId: teacher.id });
}

export function approveClassRequest(requestId) {
  const req = DB.findById(ENTITY, requestId);
  if (!req) throw new Error("Yêu cầu không tồn tại");
  if (req.status !== "pending") throw new Error("Yêu cầu này đã được xử lý trước đó");

  const cls = DB.findById("classes", req.classId);
  if (!cls) throw new Error("Lớp học của yêu cầu này không còn tồn tại");

  if (req.type === "register") {
    setClassStatus(cls.id, "open");
  } else if (req.type === "reschedule") {
    const newSchedule = normalizeSchedule(req.newSchedule);
    DB.update("classes", cls.id, { schedule: newSchedule });
  } else if (req.type === "reopen") {
    if (cls.status !== "closed") throw new Error("Lớp học này hiện không ở trạng thái đã đóng");
    setClassStatus(cls.id, "open");
  } else if (req.type === "close") {
    if (cls.status !== "open") throw new Error("Lớp học này hiện không mở để đóng");
    setClassStatus(cls.id, "closed");
  } else {
    throw new Error("Loại yêu cầu không hợp lệ");
  }

  return DB.update(ENTITY, requestId, {
    status: "approved",
    decidedAt: new Date().toISOString(),
  });
}

export function rejectClassRequest(requestId, reason = "") {
  const req = DB.findById(ENTITY, requestId);
  if (!req) throw new Error("Yêu cầu không tồn tại");
  if (req.status !== "pending") throw new Error("Yêu cầu này đã được xử lý trước đó");

  return DB.update(ENTITY, requestId, {
    status: "rejected",
    rejectReason: String(reason || "").trim(),
    decidedAt: new Date().toISOString(),
  });
}
