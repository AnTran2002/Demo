// modules/users/users.service.js — Phụ trách: Thành viên B (Admin quản lý tài khoản)
import { DB } from "../../core/db.js";
import { hashPassword } from "../../core/hash.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function listUsers(filterRole = null) {
  const users = DB.getAll("users");
  return filterRole ? users.filter((u) => u.role === filterRole) : users;
}

export function toggleActive(userId) {
  const user = DB.findById("users", userId);
  if (!user) return null;
  return DB.update("users", userId, { active: !user.active });
}

export function updateUserCredentials(userId, { email, password }) {
  const user = DB.findById("users", userId);
  if (!user) throw new Error("Tài khoản không tồn tại");
  if (user.role === "admin") throw new Error("Không thể sửa tài khoản quản trị viên");

  if (!email || !EMAIL_RE.test(email)) throw new Error("Gmail không hợp lệ");
  const duplicated = DB.getAll("users").some(
    (u) => u.id !== userId && u.email && u.email.toLowerCase() === email.toLowerCase()
  );
  if (duplicated) throw new Error("Gmail đã được sử dụng");

  const patch = { email };
  const nextPassword = typeof password === "string" ? password.trim() : "";
  if (nextPassword) {
    if (nextPassword.length < 6) throw new Error("Mật khẩu phải có ít nhất 6 ký tự");
    patch.password = hashPassword(nextPassword);
  }

  return DB.update("users", userId, patch);
}
