// modules/users/users.service.js — Phụ trách: Thành viên B (Admin quản lý tài khoản)
import { DB } from "../../core/db.js";

export function listUsers(filterRole = null) {
  const users = DB.getAll("users");
  return filterRole ? users.filter((u) => u.role === filterRole) : users;
}

export function toggleActive(userId) {
  const user = DB.findById("users", userId);
  if (!user) return null;
  return DB.update("users", userId, { active: !user.active });
}
