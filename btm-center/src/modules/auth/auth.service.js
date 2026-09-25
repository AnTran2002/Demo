// modules/auth/auth.service.js — Phụ trách: Thành viên A
// Xử lý logic đăng ký / đăng nhập.

import { DB } from "../../core/db.js";
import { hashPassword } from "../../core/hash.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/;
const HASH_RE = /^[0-9a-f]{64}$/i;

function validateRegistration({ username, password, email, fullName, gender, dob }) {
  if (!fullName || !fullName.trim()) throw new Error("Vui lòng nhập họ tên");
  if (!username || !username.trim()) throw new Error("Vui lòng nhập tài khoản");

  const users = DB.getAll("users");
  if (users.some((u) => u.username === username)) {
    throw new Error("Tài khoản đã tồn tại");
  }

  if (!email || !EMAIL_RE.test(email)) {
    throw new Error("Gmail không hợp lệ");
  }
  if (users.some((u) => u.email && u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("Gmail đã được sử dụng");
  }

  if (!gender) throw new Error("Vui lòng chọn giới tính");
  if (!dob) throw new Error("Vui lòng chọn ngày sinh");
  if (!PASSWORD_RE.test(String(password))) {
    throw new Error("Mật khẩu phải 8–16 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt");
  }
}

export function registerTeacher({ username, password, email, fullName, gender, dob, subject }) {
  validateRegistration({ username, password, email, fullName, gender, dob });
  return DB.insert("users", {
    username,
    password: hashPassword(password),
    email,
    fullName,
    gender,
    dob,
    role: "teacher",
    subject,
    active: true,
  });
}

export function registerStudent({ username, password, email, fullName, gender, dob }) {
  validateRegistration({ username, password, email, fullName, gender, dob });
  return DB.insert("users", {
    username,
    password: hashPassword(password),
    email,
    fullName,
    gender,
    dob,
    role: "student",
    active: true,
  });
}

export function login(username, password) {
  const users = DB.getAll("users");
  const user = users.find(
    (u) => u.username === username && u.password === hashPassword(password)
  );
  if (!user) throw new Error("Sai tài khoản hoặc mật khẩu");
  if (!user.active) throw new Error("Tài khoản đã bị khoá");
  return user;
}

export { HASH_RE };