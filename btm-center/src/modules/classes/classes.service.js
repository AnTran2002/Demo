// modules/classes/classes.service.js — Phụ trách: Thành viên B
import { DB } from "../../core/db.js";

export function createClass(teacher, { className, schedule, maxSlot }) {
  return DB.insert("classes", {
    className,
    subject: teacher.subject, // môn tự động lấy theo giáo viên
    grade: 9,
    teacherId: teacher.id,
    maxSlot,
    schedule, // [{ dayOfWeek, start, end }]
    status: "open",
  });
}

export function listClassesByTeacher(teacherId) {
  return DB.getAll("classes").filter((c) => c.teacherId === teacherId);
}

export function listOpenClasses(subject = null) {
  const classes = DB.getAll("classes").filter((c) => c.status === "open");
  return subject ? classes.filter((c) => c.subject === subject) : classes;
}
