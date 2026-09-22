// modules/auth/auth.service.js — Phụ trách: Thành viên A
// Xử lý logic đăng ký / đăng nhập.

import { DB } from "../../core/db.js";

export function registerTeacher({ username, password, fullName, subject }) {
  const users = DB.getAll("users");
  if (users.some((u) => u.username === username)) {
    throw new Error("Username đã tồn tại");
  }
  return DB.insert("users", {
    username,
    password,
    fullName,
    role: "teacher",
    subject,
    active: true,
  });
}

export function registerStudent({ username, password, fullName }) {
  const users = DB.getAll("users");
  if (users.some((u) => u.username === username)) {
    throw new Error("Username đã tồn tại");
  }
  return DB.insert("users", {
    username,
    password,
    fullName,
    role: "student",
    active: true,
  });
}

export function login(username, password) {
  const users = DB.getAll("users");
  const user = users.find((u) => u.username === username && u.password === password);
  if (!user) throw new Error("Sai tài khoản hoặc mật khẩu");
  if (!user.active) throw new Error("Tài khoản đã bị khoá");
  return user;
}
