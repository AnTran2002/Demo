// core/hash.js
// Hash mật khẩu (đồng bộ, khớp kết quả mỗi lần chạy) — dùng cho demo môn học.
// Không lưu mật khẩu dạng văn bản thuần trong LocalStorage.

export function hashPassword(password) {
  const data = `${String(password)}::btm::2026`;
  let state = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    state ^= data.charCodeAt(i);
    state = Math.imul(state, 0x01000193);
  }
  let seed = state >>> 0;
  let out = "";
  while (out.length < 64) {
    seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) | 0) >>> 0;
    seed = (Math.imul(seed ^ (seed >>> 12), 0x297a2d39) | 0) >>> 0;
    seed ^= seed >>> 15;
    seed >>>= 0;
    out += seed.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}