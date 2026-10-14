// modules/comments/comments.service.js — Phụ trách: Thành viên D
import { DB } from "../../core/db.js";

function normalizeCommentArgs(args) {
  if (args.length === 1 && args[0] && typeof args[0] === "object") {
    const d = args[0];
    return {
      classId: d.classId,
      studentId: d.studentId,
      teacherId: d.teacherId,
      content: d.content,
    };
  }
  if (args.length === 4) {
    return {
      classId: args[0],
      studentId: args[1],
      teacherId: args[2],
      content: args[3],
    };
  }
  // positional: (classId, studentId, content)
  const [classId, studentId, content] = args;
  return { classId, studentId, teacherId: undefined, content };
}

export function addComment(...args) {
  const { classId, studentId, teacherId, content } = normalizeCommentArgs(args);

  // Lớp đã đóng/chưa duyệt => không thể ghi nhận xét
  const cls = DB.findById("classes", classId);
  if (cls && cls.status !== "open") {
    throw new Error(cls.status === "closed" ? "Lớp đã đóng" : "Lớp chưa được Admin duyệt");
  }

  return DB.insert("comments", {
    classId,
    studentId,
    teacherId,
    content,
    createdAt: new Date().toISOString(),
  });
}

export function listCommentsByStudent(classId, studentId) {
  return DB.getAll("comments").filter(
    (c) => c.classId === classId && c.studentId === studentId
  );
}

export function listCommentsByClass(classId) {
  return DB.getAll("comments").filter((c) => c.classId === classId);
}