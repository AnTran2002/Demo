// modules/grades/grades.service.js — Phụ trách: Thành viên D
import { DB } from "../../core/db.js";

function normalizeGradeArgs(args) {
  if (args.length === 1 && args[0] && typeof args[0] === "object") {
    const d = args[0];
    return {
      classId: d.classId,
      studentId: d.studentId,
      type: d.type,
      score: d.score,
      note: d.note,
    };
  }
  if (args.length >= 3 && typeof args[2] === "string") {
    return {
      classId: args[0],
      studentId: args[1],
      type: args[2],
      score: args[3],
      note: args[4],
    };
  }
  const [classId, studentId, data] = args;
  return {
    classId,
    studentId,
    type: data?.type,
    score: data?.score,
    note: data?.note,
  };
}

export function addGrade(...args) {
  const { classId, studentId, type, score, note } = normalizeGradeArgs(args);

  // Lớp đã đóng/chưa duyệt => không thể nhập điểm
  const cls = DB.findById("classes", classId);
  if (cls && cls.status !== "open") {
    throw new Error(cls.status === "closed" ? "Lớp đã đóng" : "Lớp chưa được Admin duyệt");
  }

  return DB.insert("grades", { classId, studentId, type, score, note });
}

export function listGradesByStudentInClass(classId, studentId) {
  return DB.getAll("grades").filter(
    (g) => g.classId === classId && g.studentId === studentId
  );
}

export function listGradesByClass(classId) {
  return DB.getAll("grades").filter((g) => g.classId === classId);
}