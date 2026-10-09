// modules/classes/class-requests.service.js — Phụ trách: Thành viên B
import { DB } from "../../core/db.js";

const ENTITY = "class_requests";

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

export function approveClassRequest(requestId) {
  const req = DB.findById(ENTITY, requestId);
  if (!req) throw new Error("Yêu cầu không tồn tại");
  if (req.status !== "pending") throw new Error("Yêu cầu này đã được xử lý trước đó");

  const cls = DB.findById("classes", req.classId);
  if (!cls) throw new Error("Lớp học của yêu cầu này không còn tồn tại");

  if (req.type === "register") {
    DB.update("classes", cls.id, { status: "open" });
  } else if (req.type === "reschedule") {
    if (!req.newSchedule || !req.newSchedule.length) throw new Error("Yêu cầu thiếu lịch học mới");
    DB.update("classes", cls.id, { schedule: req.newSchedule });
  } else {
    throw new Error("Loại yêu cầu không hợp lệ");
  }

  return DB.update(ENTITY, requestId, {
    status: "approved",
    decidedAt: new Date().toISOString(),
  });
}

export function rejectClassRequest(requestId) {
  const req = DB.findById(ENTITY, requestId);
  if (!req) throw new Error("Yêu cầu không tồn tại");
  if (req.status !== "pending") throw new Error("Yêu cầu này đã được xử lý trước đó");

  return DB.update(ENTITY, requestId, {
    status: "rejected",
    decidedAt: new Date().toISOString(),
  });
}
