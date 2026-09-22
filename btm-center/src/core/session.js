// core/session.js
// Quản lý phiên đăng nhập hiện tại (currentUser) lưu trong LocalStorage.

const SESSION_KEY = "btm_current_user";

function login(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
}

function getCurrentUser() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function requireRole(role) {
  const user = getCurrentUser();
  return user && user.role === role ? user : null;
}

export const Session = { login, logout, getCurrentUser, requireRole };
