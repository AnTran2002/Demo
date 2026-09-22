// modules/comments/comments.service.js — Phụ trách: Thành viên D
import { DB } from "../../core/db.js";

export function addComment({ classId, studentId, teacherId, content }) {
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
