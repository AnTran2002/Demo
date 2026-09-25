// modules/grades/grades.service.js — Phụ trách: Thành viên D
import { DB } from "../../core/db.js";

export function addGrade({ classId, studentId, type, score, note }) {
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
