// Escape chuỗi trước khi nhúng vào HTML.
// Bắt buộc với mọi dữ liệu người dùng nhập (tên, lý do, nhận xét...) vì
// dự án render bằng innerHTML: thiếu bước này thì ký tự " sẽ phá vỡ thẻ,
// còn ký tự <script> sẽ chạy mã.
const MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (ch) => MAP[ch]);
}
